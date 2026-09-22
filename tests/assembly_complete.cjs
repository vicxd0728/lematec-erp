const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const path=require('node:path');
const worker=fs.readFileSync(path.join(__dirname,'../cloudflare-worker-green-wave-c22f-FULL-UPDATED.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const orderId='11111111-1111-8111-8111-111111111111', insId='22222222-2222-8222-8222-222222222222', matId='33333333-3333-4333-8333-333333333333';
function setup(options={}){
 let balance=10,writes=0;const transactions=new Map();
 const order={object:'page',parent:{database_id:'orders'},properties:{'狀態':{select:{name:options.status||'待檢驗'}},'訂單類型':{select:{name:'半成品'}},'訂購數量':{number:1},'成品':{relation:options.noParent?[]:[{id:matId}]}}};
 const inspection={object:'page',parent:{database_id:'48f1a7b9-1e89-4f9c-a4db-6df8e5ee7e5f'},properties:{'檢驗結果':{select:{name:'通過'}},'關聯訂單號':{rich_text:[{plain_text:(options.wrongLink?insId:orderId)+'|SFG-test'}]},'實檢數量':{number:options.partial?0:1},'不良數量':{number:0}}};
 if(options.legacy)transactions.set('legacy',{id:'legacy',material_id:matId,quantity_delta:1,quantity_before:9,quantity_after:10});
 const c=vm.createContext({Request,Response,encodeURIComponent,BOARD_DB:{orders:'orders'},cleanText:v=>String(v||'').trim(),erpBearerToken:()=> 'offline-token',
  fetch:async url=>Response.json(url.endsWith(orderId)?order:inspection),getSupabaseInventoryContext:async()=>({organization:{id:'org'},warehouse:{id:'wh'}}),
  supabaseSingle:async(env,url)=>url.includes('/materials?')?(options.missingMaterial?Promise.reject(Error('missing')):{id:matId,sku:'F-test'}):{quantity:balance},
  supabaseFetch:async(env,url,req)=>{
   if(url.includes('/pick_lists?'))return options.noPick?[]:[{id:'pick',status:options.pickStatus||'已領料',production_quantity:1}];
   if(url.includes('/pick_items?'))return [{required_quantity:2,picked_quantity:options.shortPick?0:2}];
   if(url.includes('/inventory_transactions?'))return [...transactions.values()];
   assert.equal(url,'/rest/v1/rpc/apply_inventory_transaction');
   if(options.rpcFail)throw Error('transaction rejected');
   const body=JSON.parse(req.body);const key=body.p_idempotency_key;
   if(!transactions.has(key)){writes++;transactions.set(key,{id:'tx',material_id:matId,quantity_delta:body.p_quantity_delta,quantity_before:balance,quantity_after:balance+body.p_quantity_delta});balance+=body.p_quantity_delta;}
   return transactions.get(key);
  },respOK:(cors,data)=>Response.json(data),resp400:(cors,error)=>Response.json({error},{status:400})});
 vm.runInContext(worker.slice(worker.indexOf('async function erpAssemblyComplete('),worker.indexOf('async function erpInventoryAdjust(')),c);
 const run=()=>c.erpAssemblyComplete(new Request('https://offline.invalid/api/assembly/complete',{method:'POST',body:JSON.stringify({order_id:orderId,inspection_id:insId})}),{},{});
 return {run,order,get balance(){return balance},get writes(){return writes}};
}
test('assembly pass adds parent once across retries and concurrent completion entrances',async()=>{
 const h=setup();const responses=await Promise.all([h.run(),h.run()]);
 for(const r of responses)assert.equal(r.status,200);
 h.order.properties['狀態'].select.name='已完成';
 assert.equal((await h.run()).status,200);assert.equal(h.writes,1);assert.equal(h.balance,11);
});
test('assembly rejects incomplete, cancelled, unlinked, missing and partial cases without stock writes',async()=>{
 for(const options of [{status:'取消'},{status:'待排程'},{status:'生產中'},{status:'已完成'},{noPick:true},{pickStatus:'待回料確認'},{shortPick:true},{partial:true},{wrongLink:true},{noParent:true},{missingMaterial:true},{rpcFail:true}]){
  const h=setup(options);assert.equal((await h.run()).status,400,JSON.stringify(options));assert.equal(h.writes,0);assert.equal(h.balance,10);
 }
});
test('legacy accepted assembly entry is recognized without repeating stock-in',async()=>{
 const h=setup({legacy:true,status:'已完成'});assert.equal((await h.run()).status,200);assert.equal(h.writes,0);assert.equal(h.balance,10);
});
test('assembly status menu cannot bypass stock-in or cancel consumed components',()=>{
 let active=[{status:'已領料',items:[{pickedQty:1}]}],reversed=false;
 const c=vm.createContext({isSfgProductionOrder:()=>true,isShopeeProductionOrder:()=>false,orderActivePickingRecords:()=>active,completedOrderPickingRows:r=>r.filter(p=>p.status==='已領料'),orderCanCancelAfterPickingReversal:()=>reversed,canProductionToQcRole:()=>true});
 vm.runInContext(html.slice(html.indexOf('function canMoveOrderStatus('),html.indexOf('async function doUpdateStatus(')),c);
 for(const from of ['待排程','生產中','待檢驗'])assert.equal(c.canMoveOrderStatus(from,'已完成',{id:orderId}).ok,false);
 assert.equal(c.canMoveOrderStatus('生產中','取消',{id:orderId}).ok,false);
 assert.equal(c.canMoveOrderStatus('生產中','待檢驗',{id:orderId}).ok,true);
 active=[];assert.equal(c.canMoveOrderStatus('生產中','待檢驗',{id:orderId}).ok,false);
 assert.equal(c.canMoveOrderStatus('待排程','取消',{id:orderId}).ok,true);
 reversed=true;assert.equal(c.canMoveOrderStatus('生產中','取消',{id:orderId}).ok,true);
 assert.equal(c.canMoveOrderStatus('已完成','取消',{id:orderId}).ok,false);
});
test('both inspection entrances use shared completion and preserve uncertain accepted inspection',()=>{
 assert.ok(html.includes('completeAssemblyAndMirror(o,createdInspection.id)'));
 assert.ok(html.includes('completeAssemblyAndMirror(targetOrder,insId)'));
 assert.ok(!html.includes("sourceType:'sfg_qc_pass'"));
 assert.ok(!html.includes("sourceType:'sfg_inspection_result_pass'"));
 assert.ok(html.includes('if(!assemblyAttempted)await archiveNotionPageQuietly'));
});

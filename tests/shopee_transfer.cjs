const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=require('node:path').join(__dirname,'..');
const worker=fs.readFileSync(root+'/cloudflare-worker-green-wave-c22f-FULL-UPDATED.js','utf8');
const html=fs.readFileSync(root+'/index.html','utf8');
const id='11111111-1111-8111-8111-111111111111';
test('actual transfer and batch handlers preserve real Notion UUIDv8 through the RPC boundary',async()=>{
 const oid='3e2ff6f4-24bb-815d-9f70-f2de721feed7';
 const src={id:'raw',sku:'Y-VH-01',notion_page_id:'raw-page'},dst={id:'s',sku:'S-Y-VH-01',notion_page_id:'s-page'};
 let rpc;
 const c=vm.createContext({Request,Response,encodeURIComponent,BOARD_DB:{orders:'orders'},canonicalNotionId:x=>x,
  cleanText:x=>String(x||'').trim(),cleanSku:x=>x,erpBearerToken:()=>'',taipeiISOString:()=>'',inventoryTransactionType:()=> '轉庫',
  getSupabaseInventoryContext:async()=>({organization:{id:'org'},warehouse:{id:'wh'}}),
  fetch:async()=>Response.json({object:'page',parent:{database_id:'orders'},properties:{'訂單類型':{select:{name:'蝦皮'}},'狀態':{select:{name:'待排程'}},'訂購數量':{number:30},'成品':{relation:[{id:'s-page'}]},'訂單號':{title:[{plain_text:'ORD-2609-S01-608'}]}}}),
  supabaseSingle:async(e,url)=>url.includes('notion_page_id=eq.')?dst:src,
  resolveSupabaseMaterial:async(e,o,item)=>item.sku===src.sku?src:dst,
  supabaseFetch:async(e,url,options)=>{
   if(url.includes('/materials?'))return [src];
   if(url.includes('/pick_lists?'))return [{status:'待領料'}];
   if(!url.includes('/rpc/'))return [];
   rpc=JSON.parse(options.body);
   if(!rpc.p_source_id)throw Error('Missing order identity for stock handoff');
   return {items:rpc.p_items.map(x=>({...x,after_stock:100}))};
  },respOK:(c,x)=>Response.json(x),resp400:(c,error)=>Response.json({error},{status:400}),resp500:(c,error)=>Response.json({error},{status:500})});
 for(const [start,end] of [['function isUuid(','function inventoryTransactionType('],['async function erpInventoryBatchAdjust(','function canonicalNotionId('],['async function erpShopeeTransfer(','async function erpAssemblyComplete(']])vm.runInContext(worker.slice(worker.indexOf(start),worker.indexOf(end)),c);
 const res=await c.erpShopeeTransfer(new Request('https://test/api/shopee/transfer',{method:'POST',body:JSON.stringify({payload:{source_id:oid,items:[{sku:src.sku,delta:-30},{sku:dst.sku,delta:30}]}})}),{},{});
 assert.equal(res.status,200,JSON.stringify(await res.json()));
 assert.equal(rpc.p_source_id,oid);assert.equal(rpc.p_source_number,'ORD-2609-S01-608');
 assert.equal(rpc.p_idempotency_key,'shopee_transfer:'+oid);
 assert.equal(c.isUuid('not-an-id'),false);assert.equal(c.isUuid(oid.replace('-815d-','-f15d-')),false);
});
test('sales can transfer Shopee stock but cannot complete legacy production',()=>{
 const c=vm.createContext({ROLE:'sales',isAdminRole:()=>false});
 vm.runInContext(html.slice(html.indexOf('function canCompleteShopeeProductionRole'),html.indexOf('function isShopeeProductionOrder')),c);
 assert.equal(c.canTransferShopeeStockRole(),true);
 assert.equal(c.canCompleteShopeeProductionRole(),false);
 c.ROLE='viewer';assert.equal(c.canTransferShopeeStockRole(),false);
 assert(html.includes("isShopeeProductionOrder(o)?canTransferShopeeStockRole():"));
});
function setup(opts={}){
 const target={id:'s',sku:opts.targetSku||'S-LEI-18',notion_page_id:'sp'},source={id:'w',sku:opts.sourceSku||'LEI-18',notion_page_id:'wp'};
 const order={object:'page',parent:{database_id:'orders'},properties:{'訂單類型':{select:{name:'蝦皮'}},'狀態':{select:{name:opts.status||'待排程'}},'訂購數量':{number:3},'成品':{relation:[{id:'sp'}]}}};
 let calls=0,balance=opts.short?2:10,sbalance=2;const tx=[];
 const c=vm.createContext({Request,Response,encodeURIComponent,BOARD_DB:{orders:'orders'},canonicalNotionId:x=>x,cleanText:x=>String(x||'').trim(),cleanSku:x=>String(x||'').trim().toUpperCase(),erpBearerToken:()=>'',fetch:async()=>Response.json(order),getSupabaseInventoryContext:async()=>({organization:{id:'org'},warehouse:{id:'wh'}}),getSupabaseBalance:async(e,o,w,id)=>({quantity:id==='w'?balance:sbalance}),
  supabaseSingle:async(e,url)=>url.includes('notion_page_id=eq.')?target:opts.missing?null:source,
  supabaseFetch:async(e,url)=>url.includes('/materials?')?(opts.missing?[]:opts.ambiguous?[source,{...source,id:'other',sku:source.sku.toUpperCase()}]:[source]):url.includes('/pick_lists?')?(opts.picked?[{status:'已領料'}]:opts.pending?[{status:'待領料'}]:[]):tx,
  erpInventoryBatchAdjust:async req=>{const p=(await req.json()).payload;assert.equal(p.idempotency_key,'shopee_transfer:'+id);assert.equal(p.source_type,'shopee_transfer');assert.equal(p.items.reduce((s,x)=>s+x.delta,0),0);calls++;const duplicate=tx.length>0;
   if(!tx.length){if(balance<3)throw Error('short');balance-=3;sbalance+=3;tx.push({material_id:'w',quantity_delta:-3},{material_id:'s',quantity_delta:3});}
   return Response.json({ok:true,duplicate,items:tx.map(x=>({...x,delta:x.quantity_delta}))});},respOK:(c,data)=>Response.json(data),resp400:(c,error)=>Response.json({error},{status:400})});
 vm.runInContext(worker.slice(worker.indexOf('async function erpShopeeTransfer('),worker.indexOf('async function erpAssemblyComplete(')),c);
 const run=(items=[{sku:source.sku,delta:-3},{sku:target.sku,delta:3}])=>c.erpShopeeTransfer(new Request('https://test/api/shopee/transfer',{method:'POST',body:JSON.stringify({payload:{source_id:id,items,idempotency_key:'caller-changed'}})}),{},{});
 return {run,order,tx,get calls(){return calls},get balances(){return [balance,sbalance]}};
}
test('transfer uses fixed server key and preserves total across concurrent retries',async()=>{
 const h=setup();for(const r of await Promise.all([h.run(),h.run()]))assert.equal(r.status,200);
 h.order.properties['狀態'].select.name='已完成';assert.equal((await h.run()).status,200);assert.deepEqual(h.balances,[7,5]);assert.equal(h.tx.length,2);
});
test('changed client demand, old picks, missing source and legacy completed orders block writes',async()=>{
 for(const opts of [{picked:true},{missing:true},{status:'生產中'},{status:'取消'},{status:'已完成'}]){const h=setup(opts);assert.equal((await h.run()).status,400);assert.equal(h.calls,0);assert.deepEqual(h.balances,[10,2]);}
 const h=setup();assert.equal((await h.run([{sku:'LEI-18',delta:-4},{sku:'S-LEI-18',delta:4}])).status,400);assert.equal(h.calls,0);
});
test('insufficient source never partially adds destination',async()=>{const h=setup({short:true});assert.equal((await h.run()).status,400);assert.deepEqual(h.balances,[2,2]);});
test('pending legacy pick reaches atomic database handoff without separate cancellation writes',async()=>{const h=setup({pending:true});assert.equal((await h.run()).status,200);assert.equal(h.calls,1);assert.deepEqual(h.balances,[7,5]);});
test('mixed-case warehouse source transfers to canonical S stock without guessing a duplicate',async()=>{
 const h=setup({sourceSku:'F-DTC-16-43cm',targetSku:'S-F-DTC-16-43CM'});
 assert.equal((await h.run()).status,200);assert.deepEqual(h.balances,[7,5]);
 const duplicate=setup({sourceSku:'F-DTC-16-43cm',targetSku:'S-F-DTC-16-43CM',ambiguous:true});
 assert.equal((await duplicate.run()).status,400);assert.equal(duplicate.calls,0);
});
test('changed order quantity after accepted transfer is rejected',async()=>{const h=setup();await h.run();h.order.properties['訂購數量'].number=4;assert.equal((await h.run([{sku:'LEI-18',delta:-4},{sku:'S-LEI-18',delta:4}])).status,400);assert.deepEqual(h.balances,[7,5]);});
test('replenishment ignores BOM while requiring an exact single S counterpart',()=>{
 const c=vm.createContext({mats:[{id:'raw',code:'LEI-18',stock:10}],boms:[{parentId:'s',childId:'other',qty:999}]});
 vm.runInContext(html.slice(html.indexOf('function getShopeeBomItems'),html.indexOf('async function deductShopeeBom')),c);
 const plan=c.getShopeeBomItems({code:'S-LEI-18'},3);assert.equal(plan.length,1);assert.equal(plan[0].id,'raw');assert.equal(plan[0].needed,3);
 assert.throws(()=>c.getShopeeBomItems({code:'S-S-LEI-18'},1));assert.throws(()=>c.getShopeeBomItems({code:'LEI-18'},1));
 assert(c.getShopeeBomItems({code:'S-MISSING'},1)[0].missing);
 c.mats=[{id:'mixed',code:'F-DTC-16-43cm',stock:10}];
 assert.equal(c.getShopeeBomItems({code:'S-F-DTC-16-43CM'},3)[0].id,'mixed');
});

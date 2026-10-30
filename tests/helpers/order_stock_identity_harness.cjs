const fs=require('node:fs'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
const worker=fs.readFileSync('cloudflare-worker-green-wave-c22f-FULL-UPDATED.js','utf8');
function harness(options={}){
 const ids=['100501','AU100501','IT100501','CN100501'].map((no,i)=>({no,id:`11111111-1111-4111-8111-${String(i+1).padStart(12,'0')}`}));
 const mat='22222222-2222-4222-8222-222222222222';
 const pages=new Map(ids.map(o=>[o.id,{id:o.id,parent:{database_id:'orders-db'},archived:false,properties:{訂單號:{title:[{text:{content:o.no}}]},訂購數量:{number:1},成品:{relation:[{id:mat}]},狀態:{select:{name:'待排程'}}}}]));
 const txs=ids.slice(options.owned?0:1).map((o,i)=>({id:randomUUID(),organization_id:'org',source_id:o.id,source_type:'order_pick_batch',source_number:'PK-TEST-'+o.no,material_id:mat,warehouse_id:'wh',quantity_delta:-1,quantity_before:10,quantity_after:9,idempotency_key:'old-'+o.id,occurred_at:'2026-10-30T00:00:00Z',materials:{sku:'S-QA',name:'隔離料件',notion_page_id:mat}}));
 const picks=txs.map(t=>({id:randomUUID(),pick_number:t.source_number,source_order_notion_page_id:t.source_id,status:'待回料確認',notion_page_id:null,archived_at:null}));
 const state={txs,picks,pages,balance:9,moves:0,logs:new Map(),receipts:new Map(),closed:new Set(),faultUsed:false,requests:[],production_requests:0};
 const copy=structuredClone,fail=x=>options.failure===x&&!state.faultUsed;
 const context=vm.createContext({Request,Response,URL,console,BOARD_DB:{orders:'orders-db'},isUuid:s=>/^[0-9a-f-]{36}$/.test(s||''),canonicalNotionId:s=>String(s||'').replaceAll('-','').toLowerCase(),cleanText:s=>String(s||'').trim(),erpClientAuthorized:async()=>options.auth!==false,unauthorizedErpClient:()=>Response.json({error:'auth'},{status:401}),erpBearerToken:()=> 'isolated',getSupabaseInventoryContext:async()=>({organization:{id:'org'},warehouse:{id:'wh'}}),jh:()=>({'Content-Type':'application/json'}),respOK:(_,b)=>Response.json(b),taipeiDateFromTimestamp:()=> '2026-10-30',
 corderRecoveryNotion:async(_t,id,props)=>{const p=pages.get(id);if(!p)throw Error('wrong page');if(props){if(fail('patchFail')){state.faultUsed=true;throw Error('測試：原單狀態寫入失敗');}Object.assign(p.properties,props);}return copy(p);},
 fetch:async(url,req={})=>{const id=url.split('/').at(-1);if(!pages.has(id))throw Error('external network forbidden');if(req.method==='PATCH'){const body=JSON.parse(req.body);if(body.properties){if(fail('patchFail')){state.faultUsed=true;throw Error('測試：原單狀態寫入失敗');}Object.assign(pages.get(id).properties,body.properties);}if(body.archived===true){pages.get(id).archived=true;if(fail('archiveLost')){state.faultUsed=true;throw Error('測試：封存回覆遺失');}}}return Response.json(copy(pages.get(id)));},
 supabaseAll:async(_e,path)=>{
  if(options.readFail)throw Error('測試：正式憑證讀取不完整');
  if(path.includes('/pick_lists?')){
   if(path.includes('pick_number=in.')){const refs=path.match(/pick_number=in\.\(([^)]+)\)/)[1].split(',');return copy(state.picks.filter(p=>refs.includes(p.pick_number)));}
   const id=path.match(/source_order_notion_page_id=eq\.([^&]+)/)?.[1];if(!id)throw Error('unscoped pick query');return copy(state.picks.filter(p=>p.source_order_notion_page_id===id));
  }
  if(path.includes('/inventory_transactions?')){
   if(path.includes('source_id=is.null'))return options.legacy?[{id:'legacy',source_type:'order_pick_reversal'}]:[];
   const id=path.match(/source_id.eq.([0-9a-f-]{36})/)?.[1];if(!id)throw Error('unscoped inventory query');
   const refs=state.picks.filter(p=>p.source_order_notion_page_id===id).map(p=>p.pick_number);
   return copy(state.txs.filter(t=>t.source_id===id||refs.includes(t.source_number)));
  }throw Error('unexpected scoped query '+path);
 },
 supabaseFetch:async(_e,path,req={})=>{
  if(path.includes('/pick_items?'))return [];
  if(!req.method&&(path.includes('/pick_lists?')||path.includes('/inventory_transactions?')))return context.supabaseAll(_e,path);
  const b=req.body?JSON.parse(req.body):null;
  if(path.endsWith('/rpc/reverse_order_stock_receipt')){
   const t=state.txs.find(t=>t.id===b.p_transaction);if(!t||t.source_id!==b.p_order||state.closed.has(b.p_order))throw Error('wrong original transaction order');
   const key='order-undo:'+t.id+':'+t.material_id;
   if(state.receipts.has(key))return {...copy(state.receipts.get(key)),duplicate:true};
   if(state.balance-t.quantity_delta<0)throw Error('Insufficient inventory');
   const before=state.balance;state.balance-=t.quantity_delta;state.moves++;
   const back={...copy(t),id:randomUUID(),quantity_delta:-t.quantity_delta,quantity_before:before,quantity_after:state.balance,source_type:'order_identity_reversal',idempotency_key:key};state.txs.push(back);
   const receipt={duplicate:false,items:[{material_id:t.material_id,transaction_id:back.id,delta:back.quantity_delta,before_stock:before,after_stock:state.balance}]};state.receipts.set(key,receipt);
   if(fail('lostResponse')){state.faultUsed=true;throw Error('測試：回料回覆遺失');}return copy(receipt);
  }
  if(path.endsWith('/rpc/close_order_stock_identity')){
   if(!state.closed.has(b.p_order)){
    const own=state.txs.filter(t=>t.source_id===b.p_order&&t.source_type!=='order_identity_reversal');
    if(own.some(t=>!state.receipts.has('order-undo:'+t.id+':'+t.material_id)))throw Error('原訂單仍有未沖銷交易');
    if(state.picks.some(p=>p.source_order_notion_page_id===b.p_order&&!['取消','已沖銷'].includes(p.status)))throw Error('仍有未處理領料');
    state.closed.add(b.p_order);
   }return {closed:true};
  }
  if(path.includes('/erp_stock_logs?')){const id=path.match(/client_trace_id=eq\.([^&]+)/)[1];return state.logs.has(id)?[{id}]:[];}
  if(path==='/rest/v1/erp_stock_logs'){if(fail('logFail')){state.faultUsed=true;throw Error('測試：明細儲存失敗');}state.logs.set(b.client_trace_id,b);return [];}
  if(path.includes('/erp_mirror_jobs?'))return [];
  if(path.includes('/pick_lists?')&&req.method==='PATCH'){const id=path.match(/&id=eq\.([^&]+)/)[1];const pick=state.picks.find(p=>p.id===id);if(!path.includes('source_order_notion_page_id=eq.'+pick.source_order_notion_page_id))throw Error('unscoped pick write');Object.assign(pick,b);return [];}
  throw Error('unexpected isolated write '+path);
 }});
 // Use the production receipt validator too.
 vm.runInContext(worker.slice(worker.indexOf('function assertCorderRecoveryReceipt('),worker.indexOf('async function assertCorderShipOriginal(')),context);
 vm.runInContext(worker.slice(worker.indexOf('async function orderStockAll('),worker.indexOf('function corderReversalRichText(')),context);
 const run=async(method,id,body={},role='warehouse')=>{state.requests.push({method,id,action:body.action});return context.erpOrderStockAction(new Request('http://isolated/api/orders/stock-audit?order_id='+id,{method,headers:{'X-ERP-Role':role},...(method==='POST'?{body:JSON.stringify({order_id:id,...body})}:{})}),{},{});};
 const action=async(id,a,role='warehouse')=>{const read=await (await run('GET',id,{},role)).json();return run('POST',id,{action:a,expected_signature:read.signature},role);};
 return {ids,mat,state,context,run,action,snapshot:()=>({moves:state.moves,balance:state.balance,closed:[...state.closed],archived:ids.filter(o=>pages.get(o.id).archived).map(o=>o.no),logs:state.logs.size,production_requests:0})};
}
module.exports={harness};

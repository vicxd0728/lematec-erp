const fs=require('node:fs'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
const worker=fs.readFileSync('cloudflare-worker-green-wave-c22f-FULL-UPDATED.js','utf8');
const transactionCheck=fs.readFileSync('supabase/migrations/20260717_001_initial_erp_schema.sql','utf8').match(/constraint inventory_transaction_type_check check \(transaction_type in \(([^\n]+)\)\)/)[1];
const allowedTransactionTypes=new Set([...transactionCheck.matchAll(/'([^']+)'/g)].map(x=>x[1]));
const pageId='11111111-1111-4111-8111-111111111111',a='22222222-2222-4222-8222-222222222222',b='33333333-3333-4333-8333-333333333333';
const rich=s=>({rich_text:[{text:{content:s}}]});
function harness(options={}){
 const state={page:{id:pageId,parent:{database_id:'qa-db'},archived:false,properties:{訂單號碼:{title:[{text:{content:'SHPTW20000'}}]},品名:rich('S-QA-KIT'),數量:{number:3},料件ID:rich(`${a}:3;${b}:6`),備註:rich('QA original'),狀態:{select:{name:options.status||'已完成'}},蝦皮訂單號碼:rich('QA-SHOP'),買家帳號:rich('QA-BUY')}},ledger:null,stocks:{[a]:9,[b]:8},receipts:new Map(),logs:new Map(),moves:0,requests:0,faultUsed:false,production_requests:0};
 const copy=x=>structuredClone(x),fail=mode=>options.failure===mode&&!state.faultUsed;
 const c=vm.createContext({Request,Response,console,BOARD_DB:{corders:'qa-db'},canonicalNotionId:s=>String(s||'').replaceAll('-','').toLowerCase(),isUuid:s=>/^[0-9a-f-]{36}$/.test(s||''),cleanText:s=>String(s||'').trim(),erpClientAuthorized:async()=>options.auth!==false,unauthorizedErpClient:()=>Response.json({error:'auth'},{status:401}),erpBearerToken:()=> 'qa-only',jh:()=>({'Content-Type':'application/json'}),resp400:(_,error)=>Response.json({error},{status:400}),respOK:(_,x)=>Response.json(x),getSupabaseInventoryContext:async()=>({organization:{id:'qa-org'},warehouse:{id:'qa-wh'}}),taipeiDateFromTimestamp:()=> '2026-10-20',
 fetch:async(url,req)=>{if(url.includes('/databases/'))return Response.json({results:[copy(state.page)],has_more:false});if(!url.startsWith('https://api.notion.com/v1/pages/'))throw Error('External network forbidden');if(req.method==='PATCH'){if(fail('patchFail')){state.faultUsed=true;return Response.json({message:'測試：原單狀態暫時無法儲存'},{status:503});}const body=JSON.parse(req.body);if(body.archived)state.page.archived=true;if(body.properties)Object.assign(state.page.properties,body.properties);}return Response.json(copy(state.page));},
 supabaseSingle:async(_e,p)=>{if(p.includes('/inventory_transactions?'))return {occurred_at:'2026-10-20T12:00:00Z'};const id=decodeURIComponent((p.match(/notion_page_id=eq\.([^&]+)/)||[])[1]||'');return [a,b].includes(id)?{id,notion_page_id:id,sku:id===a?'S-QA-A':'S-QA-B',name:'隔離測試零件'}:null;},
 supabaseAll:async()=>state.ledger?.pending?[{page_id:pageId,pending:copy(state.ledger.pending)}]:[],
 supabaseFetch:async(_e,p,req={})=>{
  if(p.startsWith('/rest/v1/erp_corder_reversals')){
   if(!req.method)return state.ledger?[copy(state.ledger)]:[];
   const body=JSON.parse(req.body);
   if(req.method==='POST'){if(!state.ledger)state.ledger={...body,version:0,pending:null,completed:[]};return [];}
   if(req.method==='PATCH'){const v=Number((p.match(/version=eq\.(\d+)/)||[])[1]);if(!state.ledger||state.ledger.version!==v||(p.includes('pending=is.null')&&state.ledger.pending)||(p.includes('pending->>id=eq.')&&state.ledger.pending?.id!==p.split('pending->>id=eq.')[1]))return [];Object.assign(state.ledger,body);return [copy(state.ledger)];}
  }
  if(p.startsWith('/rest/v1/inventory_transactions?'))return options.legacy?[{id:'old'}]:[];
  if(p==='/rest/v1/rpc/apply_inventory_batch'){
   const body=JSON.parse(req.body),key=body.p_idempotency_key;
   if(fail('typeConstraint')||!allowedTransactionTypes.has(body.p_transaction_type)){state.faultUsed=true;throw Error('new row for relation "inventory_transactions" violates check constraint "inventory_transaction_type_check"');}
   if(state.receipts.has(key))return {...copy(state.receipts.get(key)),duplicate:true};
   state.moves++;const items=body.p_items.map(x=>{const before=state.stocks[x.material_id];state.stocks[x.material_id]+=x.delta;return {material_id:x.material_id,delta:x.delta,before_stock:before,after_stock:state.stocks[x.material_id],transaction_id:randomUUID()};});
   const receipt={items,duplicate:false};state.receipts.set(key,copy(receipt));
   if(fail('lostResponse')){state.faultUsed=true;throw Error('測試：回料已提交但回覆遺失');}return receipt;
  }
  if(p.startsWith('/rest/v1/erp_stock_logs?')){const trace=decodeURIComponent((p.match(/client_trace_id=eq\.([^&]+)/)||[])[1]||'');return state.logs.has(trace)?[{id:trace}]:[];}
  if(p==='/rest/v1/erp_stock_logs'){if(fail('logFail')){state.faultUsed=true;throw Error('測試：回料明細暫時無法儲存');}const body=JSON.parse(req.body);state.logs.set(body.client_trace_id,body);return [];}
  if(p.startsWith('/rest/v1/erp_mirror_jobs?'))return [];
  throw Error('Unsupported isolated adapter '+p);
 }});
 vm.runInContext(worker.slice(worker.indexOf('function corderRecoverySnapshot('),worker.indexOf('async function erpCorderNumberState(')),c);
 const run=async(body,role='sales')=>{state.requests++;return c.erpCorderReversal(new Request('http://qa.local/api/corder/reversal',{method:'POST',headers:{'X-ERP-Role':role},body:JSON.stringify(body)}),{},{});};
 const snapshot=()=>({status:state.page.properties.狀態.select.name,note:state.page.properties.備註.rich_text.map(x=>x.text?.content||'').join(''),stocks:state.stocks,moves:state.moves,transactions:[...state.receipts.values()].reduce((n,r)=>n+r.items.length,0),logs:state.logs.size,pending:!!state.ledger?.pending,completed:state.ledger?.completed.length||0,requests:state.requests,production_requests:0});
 const intent=(extra={})=>({page_id:pageId,operation_id:randomUUID(),action:'return',stock_mode:'return',qty:1,reason:'測試退貨',expected:{qty:3,returned:0,status:state.page.properties.狀態.select.name,refs:`${a}:3;${b}:6`},...extra});
 return {state,c,run,snapshot,intent,pageId,a,b,options};
}
module.exports={harness,pageId,a,b};

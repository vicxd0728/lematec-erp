const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const worker=fs.readFileSync('cloudflare-worker-green-wave-c22f-FULL-UPDATED.js','utf8'),html=fs.readFileSync('index.html','utf8');
const pageId='11111111-1111-4111-8111-111111111111',matId='22222222-2222-4222-8222-222222222222',notionMat='33333333-3333-4333-8333-333333333333',txId='44444444-4444-4444-8444-444444444444';
test('resume UI prevents double submission, retains network failure and clears it on retry without navigating away',async()=>{
 let reject,resolve,calls=0;const renders=[],messages=[];
 const c=vm.createContext({window:{corders:[{id:pageId,status:'需確認'}]},CURRENT_TAB:'corders',isViewOnly:()=>false,renderTab:t=>renders.push(t),showToast:m=>messages.push(m),requestCorderResume:()=>{calls++;return new Promise((r,j)=>{resolve=r;reject=j;});},refreshAffectedData:async()=>{}});
 vm.runInContext(html.slice(html.indexOf('async function resumeCorder('),html.indexOf('async function applyCorderImportPreflight(')),c);
 const first=c.resumeCorder(pageId);assert(c.window._corderResuming.has(pageId));await c.resumeCorder(pageId);assert.equal(calls,1);
 reject(Error('Failed to fetch'));await first;assert(!c.window._corderResuming.has(pageId));assert.match(c.window._corderResumeErrors[pageId],/連線中斷.*不能據此判斷是否已扣料/);assert.equal(c.window.corders[0].status,'需確認');
 const retry=c.resumeCorder(pageId);assert.equal(c.window._corderResumeErrors[pageId],undefined);c.CURRENT_TAB='orders';const before=renders.length;
 resolve({duplicate:true});await retry;assert.equal(renders.length,before);assert.equal(c.window.corders[0].status,'出貨中');assert.match(messages.at(-1),/未重複扣料/);
});
const rich=s=>({rich_text:[{text:{content:s}}]});
function harness(options={}){
 const page={id:pageId,parent:{database_id:'db'},properties:{訂單號碼:{title:[{text:{content:'SHPTW20000'}}]},品名:rich('S-X'),數量:{number:1},料件ID:rich(notionMat+':1'),備註:rich('[ERP_CORDER_V2] pending'),狀態:{select:{name:'需確認'}}}};
 const state={page,tx:[],logs:[],moves:0,patches:0,keys:[],calls:[]};
 const c=vm.createContext({Response,Request,console,BOARD_DB:{corders:'db'},canonicalNotionId:s=>String(s||'').replaceAll('-','').toLowerCase(),isUuid:s=>/^[0-9a-f-]{36}$/.test(s||''),cleanText:s=>String(s||''),erpClientAuthorized:async()=>options.auth!==false,unauthorizedErpClient:()=>Response.json({error:'auth'},{status:401}),resp400:(_,error)=>Response.json({error},{status:400}),respOK:(_,data)=>Response.json(data),jh:()=>({'Content-Type':'application/json'}),erpBearerToken:()=> 'test',getSupabaseInventoryContext:async()=>({organization:{id:'org'},warehouse:{id:'wh'}}),taipeiDateFromTimestamp:()=> '2026-10-20',
 fetch:async(url,request)=>{
   if(request.method==='PATCH'){state.patches++;if(options.patchFail){options.patchFail=false;return Response.json({message:'patch unavailable'},{status:503});}Object.assign(page.properties,JSON.parse(request.body).properties);}
   return Response.json(page);
 },supabaseSingle:async(_e,path)=>path.includes('/materials?')?{id:matId,sku:options.nonS?'Y-X':'S-X',notion_page_id:notionMat,name:'X'}:{occurred_at:'2026-10-20T12:00:00Z'},
 supabaseFetch:async(_e,path,request={})=>{
   state.calls.push(path);
   if(path.includes('/inventory_transactions?'))return state.tx;
   if(path.includes('/rpc/apply_inventory_batch')){
     const body=JSON.parse(request.body);state.keys.push(body.p_idempotency_key);state.moves++;
     state.tx=[{id:txId,material_id:matId,quantity_delta:-1,quantity_before:12,quantity_after:11}];
     if(options.lostResponse){options.lostResponse=false;throw Error('response lost after commit');}
     return {duplicate:false,items:[{transaction_id:txId,material_id:matId,delta:-1,before_stock:12,after_stock:11}]};
   }
   if(path.includes('/erp_stock_logs?'))return state.logs;
   if(path==='/rest/v1/erp_stock_logs'){if(options.logFail){options.logFail=false;throw Error('log unavailable');}state.logs=[{id:1}];}
   return [];
 }});
 vm.runInContext(worker.slice(worker.indexOf('function corderRecoverySnapshot('),worker.indexOf('async function erpCorderNumberState(')),c);
 const run=()=>c.erpCorderResume(new Request('https://local/api/corder/resume',{method:'POST',headers:{'X-ERP-Role':'sales'},body:JSON.stringify({page_id:pageId})}),{},{});
 return {c,state,run};
}
for(const failure of ['lostResponse','patchFail','logFail'])test(`${failure}: original transaction is reused and pending order resumes without a second deduction`,async()=>{
 const h=harness({[failure]:true});const first=await h.run();assert.equal(first.status,409);assert.equal(h.state.moves,1);assert.equal(h.state.page.properties.狀態.select.name,'需確認');
 const result=await (await h.run()).json();assert.equal(result.ok,true);assert.equal(result.duplicate,true);assert.equal(h.state.moves,1);assert.equal(h.state.logs.length,1);assert.equal(h.state.page.properties.狀態.select.name,'出貨中');
 assert.equal((await (await h.run()).json()).ok,true);assert.equal(h.state.moves,1);assert.equal(h.state.logs.length,1);
});
test('normal resume is atomic for the saved snapshot and uses a stable page key',async()=>{
 const h=harness();assert.equal((await (await h.run()).json()).ok,true);assert.equal(h.state.moves,1);assert.equal(h.state.keys[0],'erp-corder-page:'+pageId.replaceAll('-',''));
});
test('changed quantity after a committed transaction blocks status promotion and never deducts again',async()=>{
 const h=harness({lostResponse:true});await h.run();h.state.page.properties.料件ID=rich(notionMat+':2');
 assert.equal((await h.run()).status,409);assert.equal(h.state.moves,1);assert.equal(h.state.page.properties.狀態.select.name,'需確認');
});
test('legacy, cancelled, non-S, invalid refs and unauthorized cases cannot start inventory changes',async()=>{
 for(const mode of ['legacy','cancelled','nonS','refs','auth']){
  const h=harness({nonS:mode==='nonS',auth:mode!=='auth'});
  if(mode==='legacy')h.state.page.properties.備註=rich('庫存交易處理中');
  if(mode==='cancelled')h.state.page.properties.狀態.select.name='已取消';
  if(mode==='refs')h.state.page.properties.料件ID=rich(notionMat+':0');
  assert.notEqual((await h.run()).status,200);assert.equal(h.state.moves,0);
 }
});
test('receipt with wrong material, invalid quantity, repeated or missing lines is rejected',()=>{
 const h=harness(),items=[{material_id:matId,delta:-1}];
 for(const rows of [[],[{material_id:matId,delta:-2,transaction_id:txId}],[{material_id:'other',delta:-1,transaction_id:txId}]])assert.throws(()=>h.c.assertCorderRecoveryReceipt(items,{items:rows}));
});
test('unknown response never reports that inventory was definitely untouched',async()=>{
 const h=harness({lostResponse:true});const result=await (await h.run()).json();assert.equal(result.inventory_committed,null);
});
test('reimport of a pending row resumes instead of skipping, creating a page or reserving a new number',async()=>{
 let resumes=0,creates=0,reserves=0,loads=0;
 const report={incoming:[{sourceRow:2,shopeeNo:'SHOP',buyer:'buyer',sku:'S-X'}],stockImpact:[]},row={id:pageId,no:'SHPTW20000',shopeeNo:'SHOP',buyer:'buyer',matCode:'S-X',status:'需確認'};
 const c=vm.createContext({window:{_corderImportPreflight:report,corders:[row]},loadCoreEssentials:async()=>{},buildCorderImportPreflight:()=>({stockImpact:[],newOrderKeys:[]}),loadCorders:async o=>{assert.equal(o.skipAutoComplete,true);assert.equal(o.mode,'all');loads++;},requestCorderResume:async id=>{assert.equal(id,pageId);resumes++;},reserveCorderNumbers:async()=>{reserves++;},notionAPI:async()=>{creates++;},corderSameOrderKey:()=> 'SHOP|buyer',corderExistingNoByShopeeAndBuyer:()=> 'SHPTW20000',assertCorderInternalNoForIdentity:async()=>{},normalizeSku:s=>s,showToast:()=>{},closeModal:()=>{},refreshAffectedData:async()=>{},renderTab:()=>{},CURRENT_TAB:'corders',alert:()=>{},console});
 vm.runInContext(html.slice(html.indexOf('async function applyCorderImportPreflightOnce('),html.indexOf('async function importShopeeExcel(')),c);
 await c.applyCorderImportPreflightOnce();assert.equal(resumes,1);assert.equal(loads,1);assert.equal(creates,0);assert.equal(reserves,0);assert.equal(row.status,'出貨中');
});

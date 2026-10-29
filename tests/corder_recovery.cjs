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
 const page={id:pageId,created_time:'2026-10-29T00:00:00Z',parent:{database_id:'db'},properties:{訂單號碼:{title:[{text:{content:'SHPTW20000'}}]},品名:rich('S-X'),數量:{number:1},料件ID:rich(notionMat+':1'),備註:rich('[ERP_CORDER_V2] pending'),狀態:{select:{name:'需確認'}}}};
 const state={page,tx:[],logs:[],moves:0,patches:0,keys:[],calls:[]};
 const c=vm.createContext({Response,Request,console,BOARD_DB:{corders:'db'},canonicalNotionId:s=>String(s||'').replaceAll('-','').toLowerCase(),isUuid:s=>/^[0-9a-f-]{36}$/.test(s||''),cleanText:s=>String(s||''),erpClientAuthorized:async()=>options.auth!==false,unauthorizedErpClient:()=>Response.json({error:'auth'},{status:401}),resp400:(_,error)=>Response.json({error},{status:400}),respOK:(_,data)=>Response.json(data),jh:()=>({'Content-Type':'application/json'}),erpBearerToken:()=> 'test',getSupabaseInventoryContext:async()=>({organization:{id:'org'},warehouse:{id:'wh'}}),taipeiDateFromTimestamp:()=> '2026-10-20',
 fetch:async(url,request)=>{
   if(url.includes('/databases/'))return Response.json(options.queryFail?{message:'unavailable'}:{results:options.original?[options.original,page]:[page],has_more:!!options.incomplete});
   if(request.method==='PATCH'){state.patches++;if(options.patchFail){options.patchFail=false;return Response.json({message:'patch unavailable'},{status:503});}Object.assign(page.properties,JSON.parse(request.body).properties);}
   return Response.json(page);
 },supabaseAll:async()=>options.legacy||[],supabaseSingle:async(_e,path)=>path.includes('/materials?')?{id:matId,sku:options.nonS?'Y-X':'S-X',notion_page_id:notionMat,name:'X'}:{occurred_at:'2026-10-20T12:00:00Z'},
 supabaseFetch:async(_e,path,request={})=>{
   state.calls.push(path);
   if(path.includes('/inventory_transactions?'))return state.tx;
   if(path.includes('/rpc/apply_corder_ship_once')){
     if(options.rpcMissing)throw Error('identity RPC unavailable');
     if(options.identityConflict)return {identity_conflict:true,original_order_number:'SHPTW16428'};
     const body=JSON.parse(request.body);state.keys.push('erp-corder-page:'+body.p_page_id.replaceAll('-',''));
     if(state.tx.length){if(body.p_items[0].delta!==state.tx[0].quantity_delta)throw Error('snapshot changed');return {duplicate:true,items:state.tx.map(t=>({material_id:t.material_id,delta:t.quantity_delta,before_stock:t.quantity_before,after_stock:t.quantity_after,transaction_id:t.id}))};}
     state.moves++;
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

test('changed internal number and buyer cannot bypass an existing platform/SKU record',async()=>{
 const original={id:'55555555-5555-4555-8555-555555555555',created_time:'2026-08-25T03:17:00Z',properties:{品名:rich('S-X'),訂單號碼:{title:[{text:{content:'SHPTW16428'}}]}}};
 const h=harness({original});h.state.page.properties.蝦皮訂單號碼=rich('26082235KY7K7M');h.state.page.properties.買家帳號=rich('changed-buyer');
 const r=await h.run();assert.equal(r.status,409);assert.match((await r.json()).error,/SHPTW16428/);assert.equal(h.state.moves,0);
});

test('legacy receipt remains detectable without its old page, and a DB claim protects against query-index lag',async()=>{
 const old=harness({legacy:[{idempotency_key:`erp:corder_ship:excel:SHPTW16428:SHOP:row-3:${notionMat}:${notionMat}:-1`}]});old.state.page.properties.蝦皮訂單號碼=rich('SHOP');
 assert.equal((await old.run()).status,409);assert.equal(old.state.moves,0);
 const concurrent=harness({identityConflict:true});concurrent.state.page.properties.蝦皮訂單號碼=rich('SHOP');
 const result=await concurrent.run();assert.equal(result.status,409);assert.match((await result.json()).error,/SHPTW16428/);assert.equal(concurrent.state.moves,0);
});

test('missing claim RPC or incomplete original query fails closed; custom manual numbers use V3 and preserve notes',async()=>{
 for(const options of [{rpcMissing:true},{queryFail:true},{incomplete:true}]){const h=harness(options);assert.equal((await h.run()).status,409);assert.equal(h.state.moves,0);}
 const h=harness();h.state.page.properties.訂單號碼.title[0].text.content='BUSTW-NEW';h.state.page.properties.備註=rich('[ERP_CORDER_V3] 客戶備註');
 assert.equal((await h.run()).status,200);assert.match(h.state.page.properties.備註.rich_text[0].text.content,/客戶備註/);
});

test('old generic C-end shipment routes are rejected before any material or balance mutation',async()=>{
 const c=vm.createContext({Response,cleanSku:s=>String(s||''),resp400:(_,error)=>Response.json({error},{status:400}),resp500:(_,error)=>Response.json({error},{status:500})});
 vm.runInContext(worker.slice(worker.indexOf('async function erpInventoryAdjust('),worker.indexOf('async function erpInventoryBatchAdjust(')),c);
 vm.runInContext(worker.slice(worker.indexOf('async function erpInventoryBatchAdjust('),worker.indexOf('async function erpPickingSummary(')),c);
 for(const fn of ['erpInventoryAdjust','erpInventoryBatchAdjust'])for(const source_type of ['corder_ship','corder_ship_bundle','corder_ship_recoverable']){
   const request={json:async()=>({payload:{source_type}})};assert.equal((await c[fn](request,{},{})).status,400);
 }
});
test('reimport of a pending row resumes instead of skipping, creating a page or reserving a new number',async()=>{
 let resumes=0,creates=0,reserves=0,loads=0;
 const report={incoming:[{sourceRow:2,shopeeNo:'SHOP',buyer:'buyer',sku:'S-X'}],stockImpact:[]},row={id:pageId,no:'SHPTW20000',shopeeNo:'SHOP',buyer:'buyer',matCode:'S-X',status:'需確認'};
 const c=vm.createContext({window:{_corderImportPreflight:report,corders:[row]},loadCoreEssentials:async()=>{},buildCorderImportPreflight:()=>({stockImpact:[],newOrderKeys:[]}),loadCorders:async o=>{assert.equal(o.skipAutoComplete,true);assert.equal(o.mode,'all');loads++;},requestCorderResume:async id=>{assert.equal(id,pageId);resumes++;},reserveCorderNumbers:async()=>{reserves++;},notionAPI:async()=>{creates++;},corderSameOrderKey:()=> 'SHOP|buyer',corderExistingNoByShopeeAndBuyer:()=> 'SHPTW20000',assertCorderInternalNoForIdentity:async()=>{},normalizeSku:s=>s,showToast:()=>{},closeModal:()=>{},refreshAffectedData:async()=>{},renderTab:()=>{},CURRENT_TAB:'corders',alert:()=>{},console});
 vm.runInContext(html.slice(html.indexOf('async function applyCorderImportPreflightOnce('),html.indexOf('async function importShopeeExcel(')),c);
 await c.applyCorderImportPreflightOnce();assert.equal(resumes,1);assert.equal(loads,1);assert.equal(creates,0);assert.equal(reserves,0);assert.equal(row.status,'出貨中');
});

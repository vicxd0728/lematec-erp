const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf("const CORDER_IMPORT_RESULT_KEY="),html.indexOf('async function importShopeeExcel('));
const incoming=[0,1,2].map(i=>({sourceRow:i+2,shopeeNo:'SHOP'+i,buyer:'BUYER'+i,sku:'S-X'+i,qty:1}));
test('lost C-order create response is never retried, while read queries can retry',async()=>{
 let calls=0;
 const c=vm.createContext({DB:{corders:'11111111-1111-1111-1111-111111111111'},PROXY:'test',NOTION_MAX_RETRIES:2,waitNotionTurn:async()=>{},sleep:async()=>{},notionRetryDelay:()=>0,isNotionRateLimit:()=>false,showToast:()=>{},fetch:async()=>{calls++;throw Error('connection lost');}});
 vm.runInContext(html.slice(html.indexOf('async function notionProxyRequest('),html.indexOf('function advancesNotionCacheEpoch(')),c);
 const created=await c.notionProxyRequest({method:'POST',endpoint:'pages',body:{parent:{database_id:'11111111111111111111111111111111'}}});
 assert.equal(calls,1);assert.equal(created.code,'corder_create_unknown');
 calls=0;await c.notionProxyRequest({method:'POST',endpoint:'databases/x/query',body:{}});assert.equal(calls,3);
});
function setup(options={}){
 const store=options.store||new Map(),local=options.local||new Map(),events={},pages=[],calls=[],toasts=[];let created=0,deducted=0,reserved=0,storageWrites=0;
 const put=(target,k,v)=>{storageWrites++;if(options.storageFail||storageWrites>(options.failStorageAfter??Infinity))throw Error('disabled');target.set(k,v);};
 const c=vm.createContext({window:{corders:[],addEventListener:(name,fn)=>events[name]=fn},CURRENT_TAB:'corders',DB:{corders:'db'},console:{error(){}},sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>put(store,k,v)},
   localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>put(local,k,v)},
   normalizeSku:s=>String(s||'').toUpperCase(),escapeHtml:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
   getTitle:(p,k)=>p[k]?.title?.[0]?.text?.content||'',getRichText:(p,k)=>p[k]?.rich_text?.[0]?.text?.content||'',
   loadCoreEssentials:async()=>{},buildCorderImportPreflight:()=>({errors:0,stockImpact:[],newOrderKeys:incoming.map(x=>x.shopeeNo+'|||'+x.buyer)}),
   loadCorders:async()=>{},ensureCorderSequenceReady:async()=>{},reserveCorderNumbers:async()=>{reserved++;return {start_number:16679};},
   formatCorderNo:n=>'SHPTW'+n,corderSameOrderKey:(s,b)=>s+'|||'+b,corderExistingNoByShopeeAndBuyer:()=>'',assertCorderInternalNoForIdentity:async()=>{},
   closeModal(){},showToast:s=>toasts.push(s),openCorderImportPreflightModal(){},renderTab(){},alert(){},parseMoneyNumber:()=>0,
   findMatBySku:sku=>({id:sku,code:sku}),resolveCorderShipPlan:()=>({items:[{stock:10,needed:1}],refs:[{id:'mat',qty:1}]}),corderStockRefs:()=> 'mat:1',
   refreshAffectedData:async()=>{if(options.refreshFail)throw Error('refresh failed');},
   notionAPI:async(method,path,body)=>{
     calls.push([method,path]);
     if(method==='POST'&&path==='pages'){
       created++;
       const page={id:'page'+created,parent:{database_id:'db'},properties:body.properties};
       if(created===(options.failAt??3)){if(options.lostResponse)pages.push(page);throw Error('third create connection lost');}
       pages.push(page);return page;
     }
     if(method==='GET')return pages.find(p=>p.id===path.slice(6));
     if(path.endsWith('/query'))return {results:options.queryMissing?[]:pages.filter(p=>p.properties.訂單號碼.title[0].text.content===body.filter.title.equals),has_more:!!options.incomplete};
     throw Error('unexpected call');
   },
   requestCorderResume:async()=>{deducted++;if(options.failResumeAt===deducted)throw Error('stock response unknown');if(options.pauseAfter===deducted)c.requestCorderImportStop();return {ok:true};},
 });
 vm.runInContext(code,c);c.window._corderImportPreflight={incoming:JSON.parse(JSON.stringify(incoming)),stockImpact:[],errors:0};
 return {c,store,local,events,pages,calls,toasts,counts:()=>({created,deducted,reserved})};
}
test('three executable rows: third create failure remains visible with reserved number and exact error',async()=>{
 const h=setup();await h.c.applyCorderImportPreflight();const r=h.c.window._corderImportResult;
 assert.equal(r.rows.length,3);assert.equal(r.rows[0].state,'完成');assert.equal(r.rows[1].state,'完成');
 assert.equal(r.rows[2].no,'SHPTW16681');assert.equal(r.rows[2].state,'建檔結果未確認');assert.match(r.rows[2].message,/third create/);
 assert.match(h.c.renderCorderImportResult(),/2\/3/);assert.match(h.c.renderCorderImportResult(),/SHPTW16681/);
 assert.deepEqual(h.counts(),{created:3,deducted:2,reserved:1});
});
test('uncertain middle create stops subsequent rows and retains the unexecuted line',async()=>{
 const h=setup({failAt:2,lostResponse:true});await h.c.applyCorderImportPreflight();
 const r=h.c.window._corderImportResult;
 assert.deepEqual(h.counts(),{created:2,deducted:1,reserved:1});
 assert.equal(r.rows[1].state,'建檔結果未確認');assert.equal(r.rows[2].state,'尚未執行');
 assert.match(r.error,/停止處理後續品項/);assert.match(h.c.renderCorderImportResult(),/尚有 2 筆待處理/);
 const before=h.counts();await h.c.verifyCorderImportResult();assert.deepEqual(h.counts(),before);
});
test('unknown stock outcome stops later lines and preserves the exact original page',async()=>{
 const h=setup({failResumeAt:1});await h.c.applyCorderImportPreflight();
 const r=h.c.window._corderImportResult;
 assert.deepEqual(h.counts(),{created:1,deducted:1,reserved:1});
 assert.equal(r.rows[0].pageId,'page1');assert.equal(r.rows[0].state,'原單待續接');
 assert.equal(r.rows[1].state,'尚未執行');assert.equal(r.rows[2].state,'尚未執行');
 assert.match(r.error,/停止處理後續品項/);
});
test('reload restores all three outcomes and a list-refresh failure cannot erase the missing row',async()=>{
 const h=setup({refreshFail:true});await h.c.applyCorderImportPreflight();
 const reloaded=setup({store:h.store});assert.equal(reloaded.c.corderImportResult().rows.length,3);
 assert.match(reloaded.c.renderCorderImportResult(),/third create/);assert.match(reloaded.c.renderCorderImportResult(),/SHPTW16681/);
});
test('unknown create retry is blocked before new reservation, page creation or deduction',async()=>{
 const h=setup();await h.c.applyCorderImportPreflight();const before=h.counts();h.c.window._corderImportPreflight={incoming,stockImpact:[],errors:0};await h.c.applyCorderImportPreflight();
 assert.deepEqual(h.counts(),before);assert.match(h.toasts.at(-1),/未保留新號碼/);
});
test('finding a lost-response page does not permit recreation while the complete list still lags',async()=>{
 const h=setup({lostResponse:true});await h.c.applyCorderImportPreflight();await h.c.verifyCorderImportResult();const before=h.counts();
 h.c.window._corderImportPreflight={incoming,stockImpact:[],errors:0};await h.c.applyCorderImportPreflight();
 assert.deepEqual(h.counts(),before);assert.match(h.toasts.at(-1),/未保留新號碼/);
});
test('read-only recovery finds a lost-response page by reserved number and exact identity, never resumes',async()=>{
 const h=setup({lostResponse:true});await h.c.applyCorderImportPreflight();const before=h.counts();
 h.calls.length=0;await h.c.verifyCorderImportResult();assert.deepEqual(h.counts(),before);
 assert.equal(h.c.window._corderImportResult.rows[2].pageId,'page3');
 assert.match(h.c.window._corderImportResult.rows[2].readback,/需確認/);
 assert(h.calls.every(([m,p])=>m==='GET'||m==='POST'&&p.endsWith('/query')));
});
test('empty or incomplete queries never declare the missing order safe to recreate',async()=>{
 for(const opt of [{queryMissing:true},{incomplete:true}]){
   const h=setup(opt);await h.c.applyCorderImportPreflight();await h.c.verifyCorderImportResult();
   const row=h.c.window._corderImportResult.rows[2];assert.equal(row.state,'建檔結果未確認');assert.equal(row.pageId,'');
   assert.match(row.readback,/不能|未完整/);
 }
});
test('mismatched direct page cannot be accepted as original order',async()=>{
 const h=setup();await h.c.applyCorderImportPreflight();h.pages[0].properties.數量.number=99;
 await h.c.verifyCorderImportResult();assert.match(h.c.window._corderImportResult.rows[0].readback,/身分或數量不符/);
});
test('both unavailable journals stop before any page creation or stock request',async()=>{
 const h=setup({storageFail:true});await h.c.applyCorderImportPreflight();
 assert.equal(h.counts().created,0);assert.equal(h.counts().deducted,0);assert.match(h.toasts.at(-1),/無法保存/);
});
test('journal failure before create stops that request; failure after create stops deduction',async()=>{
 for(const [limit,expectedCreates] of [[2,0],[4,1]]){
  const h=setup({failStorageAfter:limit});await h.c.applyCorderImportPreflight();
  assert.equal(h.counts().created,expectedCreates);assert.equal(h.counts().deducted,0);
 }
});
test('public rendering escapes error content',async()=>{
 const h=setup();await h.c.applyCorderImportPreflight();
 h.c.window._corderImportResult.rows[2].message='<img src=x onerror=alert(1)>';
 const view=h.c.renderCorderImportResult();assert(!view.includes('<img'));assert(view.includes('&lt;img'));assert.equal(h.counts().deducted,2);
});
test('pause after two completed rows preserves every unexecuted row after closing the tab',async()=>{
 const h=setup({pauseAfter:2});await h.c.applyCorderImportPreflight();
 assert.deepEqual(h.counts(),{created:2,deducted:2,reserved:1});
 assert.equal(h.c.window._corderImportResult.rows[2].state,'尚未執行');
 const reopened=setup({local:h.local});const saved=reopened.c.corderImportResult();
 assert.equal(saved.rows.length,3);assert.equal(saved.rows[2].state,'尚未執行');
 assert.match(reopened.c.renderCorderImportResult(),/尚有 1 筆待處理/);
});
test('unknown create stays blocked in a new tab, even after a different completed batch',async()=>{
 const h=setup();await h.c.applyCorderImportPreflight();
 h.c.window._corderImportResult={version:1,startedAt:'2099-01-01T00:00:00Z',rows:[{sourceRow:2,shopeeNo:'OTHER',sku:'S-OTHER',qty:1,state:'完成'}]};h.c.saveCorderImportResult();
 const reopened=setup({local:h.local});await reopened.c.applyCorderImportPreflight();
 assert.deepEqual(reopened.counts(),{created:0,deducted:0,reserved:0});assert.match(reopened.toasts.at(-1),/建檔結果未確認/);
});
test('a multi-item order counts as complete only after all its lines are complete',()=>{
 const h=setup();h.c.window._corderImportResult={version:1,rows:[
  {shopeeNo:'SHOP1',sourceRow:2,sku:'S-X',qty:1,state:'完成'},
  {shopeeNo:'SHOP1',sourceRow:3,sku:'S-Y',qty:1,state:'尚未執行'},
  {shopeeNo:'SHOP2',sourceRow:4,sku:'S-Z',qty:1,state:'完成'}]};
 assert.match(h.c.renderCorderImportResult(),/1\/2 張訂單完整.*2\/3 筆品項/);
});
test('leaving the page warns only while importing; no unload handler sends stock requests',()=>{
 const h=setup();let prevented=0;const event={preventDefault(){prevented++;}};
 h.events.beforeunload(event);assert.equal(prevented,0);
 h.c.window._corderImportBusy=true;h.events.beforeunload(event);assert.equal(prevented,1);
 assert.deepEqual(h.counts(),{created:0,deducted:0,reserved:0});
});

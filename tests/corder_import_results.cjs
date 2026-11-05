const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf("const CORDER_IMPORT_RESULT_KEY="),html.indexOf('async function importShopeeExcel('));
const incoming=[0,1,2].map(i=>({sourceRow:i+2,shopeeNo:'SHOP'+i,buyer:'BUYER'+i,sku:'S-X'+i,qty:1}));
function setup(options={}){
 const store=options.store||new Map(),pages=[],calls=[],toasts=[];let created=0,deducted=0,reserved=0;
 const c=vm.createContext({window:{corders:[]},CURRENT_TAB:'corders',DB:{corders:'db'},console:{error(){}},sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>{if(options.storageFail)throw Error('disabled');store.set(k,v);}},
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
       if(created===3){if(options.lostResponse)pages.push(page);throw Error('third create connection lost');}
       pages.push(page);return page;
     }
     if(method==='GET')return pages.find(p=>p.id===path.slice(6));
     if(path.endsWith('/query'))return {results:options.queryMissing?[]:pages.filter(p=>p.properties.訂單號碼.title[0].text.content===body.filter.title.equals),has_more:!!options.incomplete};
     throw Error('unexpected call');
   },
   requestCorderResume:async()=>{deducted++;return {ok:true};},
 });
 vm.runInContext(code,c);c.window._corderImportPreflight={incoming:JSON.parse(JSON.stringify(incoming)),stockImpact:[],errors:0};
 return {c,store,pages,calls,toasts,counts:()=>({created,deducted,reserved})};
}
test('three executable rows: third create failure remains visible with reserved number and exact error',async()=>{
 const h=setup();await h.c.applyCorderImportPreflight();const r=h.c.window._corderImportResult;
 assert.equal(r.rows.length,3);assert.equal(r.rows[0].state,'完成');assert.equal(r.rows[1].state,'完成');
 assert.equal(r.rows[2].no,'SHPTW16681');assert.equal(r.rows[2].state,'建檔結果未確認');assert.match(r.rows[2].message,/third create/);
 assert.match(h.c.renderCorderImportResult(),/2\/3/);assert.match(h.c.renderCorderImportResult(),/SHPTW16681/);
 assert.deepEqual(h.counts(),{created:3,deducted:2,reserved:1});
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
test('unavailable session storage does not interrupt business results; public rendering escapes error content',async()=>{
 const h=setup({storageFail:true});await h.c.applyCorderImportPreflight();
 h.c.window._corderImportResult.rows[2].message='<img src=x onerror=alert(1)>';
 const view=h.c.renderCorderImportResult();assert(!view.includes('<img'));assert(view.includes('&lt;img'));assert.equal(h.counts().deducted,2);
});

const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function setup(extra={}){
 const buttons={qcBatchPassBtn:{disabled:false},qcBatchCount:{textContent:''},modalInner:{innerHTML:''}};
 let calls=0,refresh=0;const rows=['a','b'].map(id=>({id,no:'IB-'+id,matId:'m',matCode:'Y-M',supplier:'廠商',qty:2,supabaseId:id,qcStatus:'待品檢',stStatus:'待入庫'}));
 const c=vm.createContext({window:{_inboundsLoaded:true},inbounds:rows,mats:[],ROLE:'qc',CURRENT_TAB:'qc',QC_SUB:'pending',isViewOnly:()=>false,isAdminRole:()=>false,
 document:{getElementById:id=>buttons[id]||null,querySelectorAll:()=>rows.map(r=>({value:r.id,checked:true}))},escapeHtml:s=>String(s).replaceAll('<','&lt;'),
 showToast:()=>{},openSharedModal:()=>{},closeModal:()=>{},renderTab:()=>{},sleep:async()=>{},approveQC:async()=>{calls++;return {ok:true}},refreshAffectedData:async()=>{refresh++},...extra});
 require('./helpers/operational_read_context.cjs')(c,html);
 vm.runInContext(cut('function renderQCBatchResult(','function qcHistorySearchState(')+cut('function selectedQCBatchInboundIds(','function openInboundApprovePreflight('),c);
 return {c,buttons,calls:()=>calls,refresh:()=>refresh};
}
test('preview requires explicit confirmation, freezes source rows and rejects changed quantity without a write',async()=>{
 const f=setup();await f.c.batchApproveInboundQC();assert.equal(f.calls(),0);assert.match(f.buttons.modalInner.innerHTML,/IB-a/);assert.match(f.buttons.modalInner.innerHTML,/Y-M/);
 f.c.inbounds[0].qty=9;await f.c.batchApproveInboundQC({confirmed:true});assert.equal(f.calls(),0);assert.equal(f.c.window._qcBatchRun,undefined);
});
test('one global batch lock survives selection changes and prevents a second batch while awaiting a result',async()=>{
 let resolve;const blocked=new Promise(r=>resolve=r);let approvals=0;const f=setup({approveQC:async()=>{approvals++;await blocked;return {ok:true}}});
 await f.c.batchApproveInboundQC();const run=f.c.batchApproveInboundQC({confirmed:true});await f.c.batchApproveInboundQC();f.c.updateQCBatchButton();assert.equal(f.buttons.qcBatchPassBtn.disabled,true);assert.equal(approvals,1);
 resolve();await run;assert.equal(approvals,2);assert.equal(f.c.window._qcBatchRun.running,false);
});
test('accepted results and post-commit warnings survive refresh failure; read-only retry never calls approval again',async()=>{
 let refresh=0;const f=setup({approveQC:async id=>({ok:true,duplicate:id==='b',warning:id==='a'?'<mirror unavailable>':''}),refreshAffectedData:async()=>{if(++refresh===1)throw Error('offline')}});
 await f.c.batchApproveInboundQC();await f.c.batchApproveInboundQC({confirmed:true});const run=f.c.window._qcBatchRun;assert.equal(run.results.length,2);assert.equal(run.refreshError,'offline');assert.equal(run.running,false);
 const before=JSON.stringify(run.results);await f.c.batchApproveInboundQC();assert.equal(JSON.stringify(run.results),before);
 await f.c.refreshQCBatchResults();assert.equal(refresh,2);assert.equal(run.refreshError,'');assert.equal(JSON.stringify(run.results),before);
 const out=f.c.renderQCBatchResult();assert.match(out,/先前已入庫/);assert.match(out,/&lt;mirror/);
});
test('unconfirmed response is never counted as successful and remains visible after the list reload',async()=>{
 const f=setup({approveQC:async id=>{if(id==='a')throw Error('response lost');return {ok:true}}});await f.c.batchApproveInboundQC();await f.c.batchApproveInboundQC({confirmed:true});
 const out=f.c.renderQCBatchResult();assert.match(out,/已確認處理 1 筆 · 未確認 1 筆/);assert.match(out,/未確認不代表未入庫/);assert.match(out,/IB-a/);
});
test('read-only role, fallback data and loading cannot open a write preview',async()=>{
 for(const extra of [{isViewOnly:()=>true},{ROLE:'sales'},{window:{_inboundsLoaded:true,_inboundDataSource:'notion-fallback'}},{window:{_inboundsLoaded:true,_operationalReads:{inbounds:{loading:true}}}}]){
  const f=setup(extra);await f.c.batchApproveInboundQC();assert.equal(f.calls(),0);assert.equal(f.c.window._qcBatchPreview,undefined);
 }
});
test('batch progress never redraws a different QC subpage while the operator is reading or editing there',()=>{
 let renders=0;const f=setup({QC_SUB:'inspect',renderTab:()=>renders++});f.c.window._qcBatchRun={running:true,total:2,results:[]};
 f.c.renderQCBatchProgress();assert.equal(renders,0);f.c.QC_SUB='pending';f.c.renderQCBatchProgress();assert.equal(renders,1);
});

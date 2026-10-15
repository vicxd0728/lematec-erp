const fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
function setup(role='warehouse'){
 const els={inboundCancelButton:{disabled:false},inboundCancelMessage:{textContent:''},inboundCancelReason:{value:'重複建立'},inboundCancelBatchButton:{disabled:false},inboundCancelBatchMessage:{textContent:'',innerHTML:''},inboundCancelBatchReason:{value:'重複建立'},modalInner:{innerHTML:''}},calls=[],toasts=[];
 const row={id:'r',supabaseId:'uuid',qcStatus:'待品檢',stStatus:'待入庫',no:'IB-test',matCode:'Y-test',qty:1};
 const c=vm.createContext({window:{},ROLE:role,CURRENT_TAB:'inbound',inbounds:[row],operationalReadState:()=>({ready:true}),document:{getElementById:id=>els[id]},escapeHtml:String,openSharedModal(){},closeModal(){},renderTab(){},showToast:(...v)=>toasts.push(v),mapSupabaseInbound:r=>({...row,qcStatus:r.qc_status,stStatus:'已取消'}),updateInboundNotionMirror:async()=>({pending:false}),pickingWorkerRequest:async(...args)=>{calls.push(args);return {row:{id:'uuid',qc_status:'已取消'}};}});
 vm.runInContext(html.slice(html.indexOf('function canCancelInbound('),html.indexOf('function renderInbound(){')),c);return {c,els,calls,toasts,row};
}
test('only allowed operational roles can cancel unstocked primary receipts',()=>{
 for(const role of ['warehouse','purchase','manager','vic']){const f=setup(role);assert(f.c.canCancelInbound(f.row));}
 for(const role of ['ai','viewer','qc','sales']){const f=setup(role);assert(!f.c.canCancelInbound(f.row));}
 for(const patch of [{fallback:true},{inventoryTransactionId:'tx'},{stStatus:'已入庫'},{qcStatus:'已取消'},{supabaseId:''}]){const f=setup();assert(!f.c.canCancelInbound({...f.row,...patch}));}
});
test('empty reason prevents request; accepted cancellation updates record once',async()=>{
 const f=setup();f.els.inboundCancelReason.value=' ';await f.c.submitCancelInbound('r');assert.equal(f.calls.length,0);assert.match(f.els.inboundCancelMessage.textContent,/原因/);
 f.els.inboundCancelReason.value='重複建立';await f.c.submitCancelInbound('r');await f.c.submitCancelInbound('r');assert.equal(f.calls.length,1);assert.equal(f.calls[0][1].method,'POST');assert.equal(f.calls[0][1].body.inbound_id,'uuid');assert.equal(f.c.inbounds[0].qcStatus,'已取消');assert.match(f.toasts[0][0],/紀錄已保留/);
});
test('failed API never changes record; accepted cancellation distinguishes mirror failure',async()=>{
 const f=setup();f.c.pickingWorkerRequest=async()=>{throw Error('offline')};await f.c.submitCancelInbound('r');assert.equal(f.c.inbounds[0].qcStatus,'待品檢');assert.equal(f.els.inboundCancelButton.disabled,false);assert.match(f.els.inboundCancelMessage.textContent,/取消未確認/);
 const g=setup();g.c.updateInboundNotionMirror=async()=>{throw Error('mirror')};await g.c.submitCancelInbound('r');assert.equal(g.c.inbounds[0].qcStatus,'已取消');assert.match(g.toasts[0][0],/已取消.*同步未完成/);
});
test('cancelled receipts do not count as incoming shortage supply',()=>{
 const f=setup();f.c.pickShortageMaterialMatch=()=>true;
 vm.runInContext(html.slice(html.indexOf('function pickShortageActiveInbound('),html.indexOf('function pickShortageActiveAssemblies(')),f.c);
 f.c.inbounds=[f.row,{...f.row,qcStatus:'已取消',stStatus:'已取消'},{...f.row,qcStatus:'品檢通過',stStatus:'已入庫'}];
 assert.equal(f.c.pickShortageActiveInbound({}).length,1);
});
test('batch cancellation reports partial success and retries only unresolved records',async()=>{
 const f=setup();f.c.inbounds=[f.row,{...f.row,id:'b',supabaseId:'uuid-b',no:'IB-B'}];
 f.c.window._inboundCancelSelected=['r','b'];f.c.openCancelInboundBatch();let attempts=0;
 f.c.pickingWorkerRequest=async(path,opts)=>{f.calls.push(opts.body.inbound_id);if(opts.body.inbound_id==='uuid-b'&&attempts++===0)throw Error('already stocked');return {row:{id:opts.body.inbound_id,qc_status:'已取消'}};};
 f.c.mapSupabaseInbound=r=>({...f.row,id:r.id==='uuid'?'r':'b',supabaseId:r.id,qcStatus:r.qc_status,stStatus:'已取消'});
 await f.c.submitCancelInboundBatch();
 assert.equal(f.c.inbounds[0].qcStatus,'已取消');assert.equal(f.c.inbounds[1].qcStatus,'待品檢');
 assert.deepEqual([...f.c.window._inboundCancelBatchIds],['b']);assert.deepEqual([...f.c.window._inboundCancelSelected],['b']);assert.match(f.els.inboundCancelBatchMessage.innerHTML,/已取消 1 筆.*未完成／未確認 1 筆/);
 await f.c.submitCancelInboundBatch();assert.deepEqual(f.calls,['uuid','uuid-b','uuid-b']);assert.equal(f.els.inboundCancelBatchButton.disabled,true);
});
test('batch empty reason, stale source and concurrent clicks cannot send extra requests',async()=>{
 const f=setup();f.c.window._inboundCancelBatchIds=['r'];f.els.inboundCancelBatchReason.value='';await f.c.submitCancelInboundBatch();assert.equal(f.calls.length,0);
 f.els.inboundCancelBatchReason.value='duplicate';f.c.operationalReadState=()=>({ready:true,error:'offline'});await f.c.submitCancelInboundBatch();assert.equal(f.calls.length,0);
 f.c.operationalReadState=()=>({ready:true});let resolve;f.c.pickingWorkerRequest=()=>new Promise(r=>{resolve=r;f.calls.push(1);});
 const first=f.c.submitCancelInboundBatch();await f.c.submitCancelInboundBatch();assert.equal(f.calls.length,1);resolve({row:{id:'uuid',qc_status:'已取消'}});await first;
});
test('select page respects filtered page boundaries and excludes stocked receipts',()=>{
 const f=setup();f.c.inbounds=Array.from({length:105},(_,i)=>({...f.row,id:String(i)}));f.c.inbounds[102].stStatus='已入庫';
 f.c.inboundListFilters=()=>({page:2});f.c.filterInboundRows=rows=>rows;f.c.applySort=(_key,rows)=>rows;
 f.c.toggleInboundCancelPage(true);assert.deepEqual([...f.c.window._inboundCancelSelected],['100','101','103','104']);f.c.toggleInboundCancelPage(false);assert.equal(f.c.window._inboundCancelSelected.length,0);
});

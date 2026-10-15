const fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
function setup(role='warehouse'){
 const els={inboundCancelButton:{disabled:false},inboundCancelMessage:{textContent:''},inboundCancelReason:{value:'重複建立'},modalInner:{innerHTML:''}},calls=[],toasts=[];
 const row={id:'r',supabaseId:'uuid',qcStatus:'待品檢',stStatus:'待入庫',no:'IB-test',matCode:'Y-test',qty:1};
 const c=vm.createContext({ROLE:role,CURRENT_TAB:'inbound',inbounds:[row],document:{getElementById:id=>els[id]},escapeHtml:String,openSharedModal(){},closeModal(){},renderTab(){},showToast:(...v)=>toasts.push(v),mapSupabaseInbound:r=>({...row,qcStatus:r.qc_status,stStatus:'已取消'}),updateInboundNotionMirror:async()=>({pending:false}),pickingWorkerRequest:async(...args)=>{calls.push(args);return {row:{id:'uuid',qc_status:'已取消'}};}});
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

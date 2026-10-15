const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setup(extra={}){
 let renders=0;
 const ctx=vm.createContext({window:{_coreLoaded:true,_qcInspections:[]},CURRENT_TAB:'qc',QC_SUB:'pending',QC_DATE:'0',QC_KIND:'all',QC_FILTER:'all',ROLE:'qc',
  inbounds:[{id:'ib',no:'IB-DEMO',matId:'mat',matCode:'Y-DEMO',matName:'接頭',supplier:'示範廠',qty:20,date:'2026-10-15',qcStatus:'待品檢'}],orders:[{id:'ord',no:'ORD-DEMO',customer:'示範客戶',product:'Z-DEMO',qty:5,status:'待檢驗'}],mats:[{id:'mat',code:'Y-DEMO',name:'接頭'}],
  isViewOnly:()=>false,isAdminRole:()=>false,qcInspectionRangeDays:()=>30,qcLoadTimeLabel:()=> '本機合成資料',qcInspectionsReady:()=>true,_qcInspectionsLoading:false,_qcInspectionsError:'',escapeHtml,
  applySort:(_k,rows)=>rows,TH:(_scope,_key,label)=>`<th>${label}</th>`,pill:v=>`<span>${escapeHtml(v)}</span>`,orderProductName:o=>o.product,
  document:{getElementById:()=>null},renderTab:()=>renders++,...extra});
 ctx.getInspectionOrders=()=>ctx.orders;
 require('./helpers/operational_read_context.cjs')(ctx,source);
 vm.runInContext(source.slice(source.indexOf('function qcPendingSearchState('),source.indexOf('function orderAuditLogText(')),ctx);
 return {ctx,renders:()=>renders};
}
test('unloaded QC sources never claim there are no pending inspections',()=>{
 const {ctx}=setup({inbounds:[],orders:[]});delete ctx.window._inboundsLoaded;ctx.window._coreLoaded=false;
 let out=ctx.renderQCTab();assert.match(out,/待載入/);assert.match(out,/尚未載入/);assert.doesNotMatch(out,/✅ 目前.*沒有/);
 ctx.QC_SUB='order_qc';out=ctx.renderQCTab();assert.match(out,/訂單資料尚未載入/);assert.doesNotMatch(out,/✅ 目前.*沒有/);
});
test('loaded empty QC can report zero while a failed read cannot imply an all-clear',()=>{
 const {ctx}=setup({inbounds:[]});assert.match(ctx.renderQCTab(),/✅ 目前已載入資料沒有入料待品檢/);
 ctx.window._operationalReads={inbounds:{error:'<offline>',loading:false}};const out=ctx.renderQCTab();assert.match(out,/&lt;offline&gt;/);assert.match(out,/最新正式狀態仍須確認/);assert.doesNotMatch(out,/✅ 目前已載入資料沒有/);
});
test('inbound pending search uses exact source fields and loaded material code without changing records',()=>{
 const {ctx}=setup();const before=JSON.stringify(ctx.inbounds);
 for(const q of ['ib-demo','y-demo','示範廠','接頭']){ctx.qcPendingSearchState('inbound').q=q;assert.match(ctx.renderQCTab(),/符合 1／已載入待檢 1/);}
 ctx.inbounds[0].matCode='';ctx.qcPendingSearchState('inbound').q='y-demo';assert.match(ctx.renderQCTab(),/Y-DEMO/);ctx.inbounds[0].matCode='Y-DEMO';assert.equal(JSON.stringify(ctx.inbounds),before);
});
test('searches remain separate and clearing inbound retains the order query',()=>{
 const {ctx}=setup();Object.assign(ctx.qcPendingSearchState('inbound'),{q:'missing',draft:'missing'});Object.assign(ctx.qcPendingSearchState('orders'),{q:'ORD',draft:'ORD'});
 assert.match(ctx.renderQCTab(),/不代表沒有其他待辦/);assert.doesNotMatch(ctx.renderQCTab(),/✅ 目前.*沒有/);ctx.applyQCPendingSearch('inbound',true);
 assert.equal(ctx.qcPendingSearchState('inbound').q,'');assert.equal(ctx.qcPendingSearchState('orders').q,'ORD');
});
test('fallback or updating inbound offers no approval controls but keeps pending rows visible',()=>{
 for(const state of ['fallback','loading','error']){
  const {ctx}=setup();if(state==='fallback')ctx.window._inboundDataSource='notion-fallback';else ctx.window._operationalReads={inbounds:state==='loading'?{loading:true}:{error:'offline'}};
  const out=ctx.renderQCTab();assert.match(out,/IB-DEMO/);assert.doesNotMatch(out,/onclick="approveQC|onclick="batchApproveInboundQC|onclick="openInboundRejectModal/);
 }
 const {ctx}=setup();assert.match(ctx.renderQCTab(),/onclick="approveQC/);ctx.isViewOnly=()=>true;assert.doesNotMatch(ctx.renderQCTab(),/onclick="approveQC/);
});
test('order pending search finds customer/product and displays customer field without a legacy cust value',()=>{
 const {ctx}=setup({QC_SUB:'order_qc'});for(const q of ['ord-demo','示範客戶','z-demo']){ctx.qcPendingSearchState('orders').q=q;assert.match(ctx.renderQCTab(),/符合 1／已載入待檢 1/);assert.match(ctx.renderQCTab(),/示範客戶/);}
});
test('pending card content is escaped and order identifiers use data attributes',()=>{
 const {ctx}=setup();ctx.inbounds[0].no='<img src=x>';ctx.inbounds[0].supplier='<script>';let out=ctx.renderQCTab();assert.match(out,/&lt;img src=x&gt;/);assert.match(out,/&lt;script&gt;/);assert.doesNotMatch(out,/<img src=x>|<script>/);assert.match(out,/data-label="日期"/);assert.match(out,/2026-10-15/);
 ctx.QC_SUB='order_qc';ctx.orders[0].no="O'\"><img>";out=ctx.renderQCTab();assert.match(out,/data-order-no="O&#39;&quot;&gt;&lt;img&gt;"/);assert.match(out,/openInspectionModal\(this.dataset.orderId,this.dataset.orderNo\)/);
});
test('pending query draft does not render or make requests and Enter respects composition',()=>{
 const f=setup();f.ctx.qcPendingSearchState('inbound').draft='接';assert.equal(f.renders(),0);
 const markup=f.ctx.renderQCPendingToolbar('inbound',1,1),handler=markup.match(/onkeydown="([^"]+)"/)[1];let calls=0;f.ctx.applyQCPendingSearch=()=>calls++;
 f.ctx.event={key:'Enter',isComposing:true,preventDefault(){}};vm.runInContext(`(function(){${handler}}).call({_composing:false})`,f.ctx);assert.equal(calls,0);
 f.ctx.event.isComposing=false;vm.runInContext(`(function(){${handler}}).call({_composing:false})`,f.ctx);assert.equal(calls,1);
});
test('applying a query during displayed batch progress does not replace progress or selection',()=>{
 const f=setup();f.ctx.document.getElementById=id=>id==='qcBatchProgress'?{textContent:'處理 1/2'}:null;let notices=0;f.ctx.showToast=()=>notices++;
 f.ctx.qcPendingSearchState('inbound').draft='new query';f.ctx.applyQCPendingSearch('inbound');assert.equal(f.renders(),0);assert.equal(f.ctx.qcPendingSearchState('inbound').q,'');assert.equal(notices,1);
});

const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=source.indexOf('function qcHistorySearchState()');
const end=source.indexOf('function orderAuditLogText(',start);
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function context(inspections=[],inbounds=[],options={}){
 let renders=0;
 const ctx=vm.createContext({window:{_qcInspections:inspections},QC_SUB:'inspect',QC_DATE:'0',QC_KIND:'all',QC_FILTER:'all',ROLE:'ai',inbounds,orders:[],mats:[],isViewOnly:()=>true,isAdminRole:()=>false,getInspectionOrders:()=>[],qcInspectionRangeDays:()=>30,qcLoadTimeLabel:()=> '已載入',qcInspectionsReady:()=>true,_qcInspectionsLoading:false,_qcInspectionsError:'',escapeHtml,applySort:(_k,rows)=>rows,document:{getElementById:()=>null},renderTab:()=>renders++,...options});
 vm.runInContext(source.slice(start,end),ctx);return {ctx,renders:()=>renders};
}
test('failure filter excludes passed legacy inbound supplements',()=>{
 const {ctx}=context([],[{no:'IB-PASS',qty:1,qcStatus:'品檢通過'},{no:'IB-FAIL',qty:1,qcStatus:'品檢不合格'}],{QC_FILTER:'fail'});
 const out=ctx.renderQCTab();assert.match(out,/IB-FAIL/);assert.doesNotMatch(out,/IB-PASS/);assert.match(out,/舊入料補充 1 筆/);
});
test('filtered-out formal inspection never reappears as legacy supplement',()=>{
 const {ctx}=context([{id:'i',no:'QC-1',orderRef:'IB-PASS',result:'通過'}],[{no:'IB-PASS',qcStatus:'品檢不合格'}],{QC_FILTER:'fail'});
 const out=ctx.renderQCTab();assert.doesNotMatch(out,/入料已檢測補充/);assert.match(out,/正式檢驗 0 筆／舊入料補充 0 筆/);
});
test('query finds formal inspection by number SKU linked order and inspector',()=>{
 const record={id:'i',no:'QC-1',orderRef:'ORD-1',matCode:'Y-GAH-08',inspector:'王小明',result:'通過'};
 const {ctx}=context([record,{id:'j',no:'OTHER',orderRef:'IB-2',result:'通過'}]);
 for(const q of ['qc-1','y-gah','ord-1','小明']){ctx.window._qcHistorySearch={q,draft:q};const out=ctx.renderQCTab();assert.match(out,/QC-1/);assert.doesNotMatch(out,/>OTHER</);assert.match(out,/正式檢驗 1 筆／舊入料補充 0 筆/);}
});
test('legacy query can resolve its material master and obey pass/fail filters',()=>{
 const {ctx}=context([],[{no:'IB-OLD',matId:'m',qcStatus:'品檢通過'}],{mats:[{id:'m',code:'Y-LEGACY',name:'接頭'}],QC_FILTER:'pass'});
 ctx.window._qcHistorySearch={q:'y-legacy',draft:'y-legacy'};assert.match(ctx.renderQCTab(),/IB-OLD/);
 ctx.QC_FILTER='fail';assert.doesNotMatch(ctx.renderQCTab(),/>IB-OLD</);
});
test('query/result text are escaped and searching does not mutate business rows',()=>{
 const rows=[{id:'i',no:'QC-X',result:'<img src=x>'}];const before=JSON.stringify(rows);const {ctx}=context(rows);
 ctx.window._qcHistorySearch={q:'',draft:'"<img>'};const out=ctx.renderQCTab();assert.match(out,/&quot;&lt;img&gt;/);assert.match(out,/&lt;img src=x&gt;/);assert.doesNotMatch(out,/<img src=x>/);assert.equal(JSON.stringify(rows),before);
});
test('apply search trims the draft; reset clears only query result/type and retains date scope',()=>{
 const f=context([] ,[],{QC_DATE:'90'});f.ctx.window._qcHistorySearch={q:'',draft:' Y-GAH '};f.ctx.applyQCHistorySearch();assert.equal(f.ctx.window._qcHistorySearch.q,'Y-GAH');assert.equal(f.renders(),1);
 f.ctx.QC_FILTER='fail';f.ctx.QC_KIND='inbound';f.ctx.resetQCHistoryFilters();assert.equal(f.ctx.QC_DATE,'90');assert.equal(f.ctx.QC_FILTER,'all');assert.equal(f.ctx.QC_KIND,'all');assert.equal(f.ctx.window._qcHistorySearch.q,'');
});
test('no-match search provides recovery without implying an empty source',()=>{
 const {ctx}=context([{id:'i',no:'QC-1',result:'通過'}]);ctx.window._qcHistorySearch={q:'NOT-FOUND',draft:'NOT-FOUND'};
 const out=ctx.renderQCTab();assert.match(out,/目前沒有符合條件/);assert.match(out,/清除搜尋與結果／類型篩選/);assert.match(out,/已載入正式檢驗 1 筆/);
});

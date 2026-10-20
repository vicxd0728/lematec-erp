const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync('index.html','utf8');
function setup(){
 const writes=[],messages=[],ctx=vm.createContext({CURRENT_TAB:'other',window:{corders:[],_cordersLoaded:true},DATA_LOAD_MODE:{corders:'recent'},DATA_LOAD_DAYS:{corders:30},FIRST_LOAD_DAYS:30,renderTab(){},showToast:(...x)=>messages.push(x),ensureXlsxLoaded:async()=>{},taipeiDateKey:()=> '2026-10-18',XLSX:{utils:{book_new:()=>({}),aoa_to_sheet:rows=>({rows}),book_append_sheet:(book,sheet,name)=>{book[name]=sheet}},writeFile:(...x)=>writes.push(x)}});
 const a=html.indexOf('function corderSelectionIds('),b=html.indexOf('function renderCorders(){',a);
 if(a>=0&&b>a)vm.runInContext(html.slice(a,b),ctx);return {ctx,writes,messages};
}
test('pagination clamps bounds, resets on filter changes and preserves selection across pages',()=>{
 const {ctx:c}=setup(),rows=Array.from({length:121},(_,i)=>({id:String(i),no:'SHARED-NO'}));c.window.corders=rows;
 let v=c.corderPageView(rows);assert.equal(v.rows.length,50);assert.equal(v.pages,3);
 c.toggleCorderSelection('0',true);c.changeCorderPage(1);v=c.corderPageView(rows);assert.equal(v.rows[0].id,'50');assert.deepEqual([...c.corderSelectionIds()],['0']);
 c.selectCorderVisible(true);assert.equal(c.corderSelectionIds().size,51);c.window._CO_Q='other';v=c.corderPageView(rows);assert.equal(v.page,1);assert.equal(c.corderSelectionIds().size,51);
});
test('selecting filtered results does not select hidden rows and duplicate numbers retain separate IDs',()=>{
 const {ctx:c}=setup();c.window.corders=[{id:'a',no:'same'},{id:'b',no:'same'},{id:'hidden'}];c.corderPageView(c.window.corders.slice(0,2));c.selectCorderFiltered();
 assert.deepEqual([...c.corderSelectionIds()],['a','b']);c.clearCorderSelection();assert.equal(c.corderSelectionIds().size,0);
});
test('export freezes selected rows before async load and retains text, quantities and scope',async()=>{
 const f=setup(),c=f.ctx;c.window.corders=[{id:'a',no:'=1+1',qty:2.5,matCode:'S-X',status:'出貨中'},{id:'b',no:'B',qty:0}];c.toggleCorderSelection('a',true);
 let resolve;c.ensureXlsxLoaded=()=>new Promise(r=>resolve=r);const task=c.exportSelectedCorders();c.window.corders[0].no='changed';c.toggleCorderSelection('b',true);resolve();await task;
 assert.equal(f.writes.length,1);const book=f.writes[0][0],rows=book['訂單明細'].rows;assert.equal(rows.length,2);assert(rows[1].includes('=1+1'));assert(rows[1].includes(2.5));assert.match(JSON.stringify(book['匯出說明'].rows),/近30天/);
});
test('missing selected records or unready data never produce a misleading partial export',async()=>{
 const f=setup(),c=f.ctx;c.window._corderSelected=['missing'];await c.exportSelectedCorders();assert.equal(f.writes.length,0);assert.match(f.messages.at(-1)[0],/重新/);
 c.window._cordersLoaded=false;await c.exportSelectedCorders();assert.equal(f.writes.length,0);
});
test('real renderer paginates desktop and mobile with actionable checkboxes; unloaded is not empty',()=>{
 const {ctx:c}=setup();Object.assign(c,{ROLE:'ai',isViewOnly:()=>true,isAdminRole:()=>false,CORDER_SEQUENCE_STATE:{next_number:17000},getCorderSearchDraft:()=>'',nextCorderInternalNo:()=> 'SHPTW17000',corderSequenceReady:()=>true,limitedDataHint:()=>'<div>近30天及未結案</div>',corderReturnStatusColor:()=>({bg:'black',fg:'white'}),escapeHtml:v=>String(v??'').replaceAll('<','&lt;').replaceAll('"','&quot;'),searchIncludesAll:(s,q)=>s.includes(q)});
 vm.runInContext(html.slice(html.indexOf('function renderCorders(){'),html.indexOf('function pickShortageMaterialMatch(')),c);
 c.window.innerWidth=1400;c.window.corders=Array.from({length:121},(_,i)=>({id:String(i),no:'ORDER-'+i,matCode:'S-X',qty:1,matId:'m',status:'已完成'}));
 let out=c.renderCorders();assert.equal((out.match(/<tr>/g)||[]).length,51);assert.match(out,/changeCorderPage\(1\)/);assert.match(out,/toggleCorderSelection/);assert.doesNotMatch(out,/premium-page-dots/);
 c.window.innerWidth=390;out=c.renderCorders();assert.equal((out.match(/class="corder-row-mobile"/g)||[]).length,50);assert.equal((out.match(/勾選此筆/g)||[]).length,50);assert.match(out,/C端訂單每頁筆數/);assert.match(out,/changeCorderPage\(1\)/);assert.match(out,/第 1 \/ 3 頁/);
 c.window.corders=[{id:'pending',no:'SHPTW1',matCode:'S-X',qty:1,matId:'m',status:'需確認'},{id:'old-unlinked',no:'OLD',status:'已完成'}];c.isViewOnly=()=>false;
 out=c.renderCorders();assert.match(out,/需確認 <b>1<\/b>/);assert.match(out,/資料待補 <b>1<\/b>/);assert.match(out,/核對並續接/);
 const pendingCard=out.slice(out.indexOf('data-id="pending"'),out.indexOf('data-id="old-unlinked"'));assert.match(pendingCard,/resumeCorder/);assert.doesNotMatch(pendingCard,/openEditCorder|deleteCorder/);
 for(const width of [1280,390]){
  c.window.innerWidth=width;c.window._corderResuming=new Set(['pending']);out=c.renderCorders();assert.match(out,/disabled aria-busy="true"/);assert.match(out,/核對中，請稍候/);
  c.window._corderResuming.clear();c.window._corderResumeErrors={pending:'憑證不符 <script>'};out=c.renderCorders();assert.match(out,/role="alert"/);assert.match(out,/憑證不符 &lt;script>/);assert.match(out,/連線恢復或問題排除後/);assert.doesNotMatch(out,/憑證不符 <script>/);
  if(width===1280)assert.match(out,/<tr class="corder-recovery-feedback-row"><td colspan="8">/);else assert.doesNotMatch(out,/corder-recovery-feedback-row/);
 }
 c.isViewOnly=()=>true;assert.doesNotMatch(c.renderCorders(),/核對並續接/);
 c.window._cordersLoaded=false;out=c.renderCorders();assert.match(out,/尚未成功載入/);assert.doesNotMatch(out,/已選|尚無/);
});

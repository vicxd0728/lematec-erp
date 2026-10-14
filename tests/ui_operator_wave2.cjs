const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {test}=require('node:test');const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function inventory(rows,state={}){
 const ctx=vm.createContext({window:{_invState:{q:'',type:'all',stockMin:'',stockMax:'',stockStatus:'all',quick:'all',page:1,pageSize:100,...state}},boms:[],ROLE:'ai',escapeHtml,
 getInventoryReadSet:()=>({rows,label:'Supabase'}),getInventoryReadSource:()=> 'supabase',_supabaseInventoryState:{loaded:true},isViewOnly:()=>true,isAdminRole:()=>false,
 applySort:(_k,x)=>x,normalizeSku:x=>String(x),invSelectionSet:()=>new Set(),invSelectedMaterials:()=>[],renderInventorySourceSwitch:()=>'',canAuditBomRole:()=>false,canImportBomRole:()=>false,TH:()=>'<th>欄</th>',pill:x=>escapeHtml(x)});
 vm.runInContext(section('function renderErpVisualRows(rows){','function renderInventoryInsightPanel('),ctx);return ctx;
}
function inbound(rows,canAdd=false){
 const ctx=vm.createContext({window:{},SORT:{},inbounds:rows,mats:[],escapeHtml,document:{getElementById:()=>null},dashboardCanCreateInbound:()=>canAdd,
 applyDateFilterValue:(_v,x)=>x,applySort:(_k,x)=>x,TH:()=>'<th>欄</th>',pill:x=>escapeHtml(x),shortageSourceOrderLink:()=>'',renderTab:()=>{}});
 vm.runInContext(section('function inboundListFilters()','function openResubmitInbound('),ctx);return ctx;
}
test('inventory missing values remain unknown in rows and counters; zero stays zero',()=>{
 const ctx=inventory([{id:'a',name:'unknown',stock:null,safe:5},{id:'b',name:'zero',stock:0,safe:5}]);
 const out=ctx.renderInventory();assert.match(out,/待確認/);assert.match(out,/數值不明/);assert.match(out,/缺貨／零庫存 <b>1<\/b>/);assert.match(out,/>0<\/span>/);
});
test('numeric stock bounds exclude unknown rows instead of treating them as zero',()=>{
 const ctx=inventory([{id:'a',name:'unknown',stock:undefined,safe:5},{id:'b',name:'zero',stock:0,safe:5}],{stockMin:'0',stockMax:'0'});
 const out=ctx.renderInventory();assert.match(out,/共 <b[^>]*>1<\/b> 筆/);assert.doesNotMatch(out,/>unknown</);
});
test('inventory empty results never display inverted page ranges and offer reset',()=>{
 const out=inventory([{id:'a',name:'part',stock:1}],{q:'no-match'}).renderInventory();
 assert.doesNotMatch(out,/顯示 1–0/);assert.match(out,/清除篩選並顯示全部/);
});
test('inventory names and SKU input remain escaped',()=>{
 const out=inventory([{id:'a',name:'<img src=x>',code:'<b>SKU</b>',stock:1}],{q:'<'}).renderInventory();
 assert.match(out,/&lt;img src=x&gt;/);assert.doesNotMatch(out,/<img src=x>/);assert.match(out,/value="&lt;"/);
});
test('long inbound notes retain their beginning and end inside escaped disclosure',()=>{
 const ctx=inbound([]);const note='<img>START'+ '長'.repeat(100)+'END';const out=ctx.renderInboundNote(note);
 assert.match(out,/<details/);assert.match(out,/&lt;img&gt;START/);assert.match(out,/END/);assert.doesNotMatch(out,/<img>/);
 assert.doesNotMatch(ctx.renderInboundNote('short'),/<details/);
});
test('inbound card labels retain supplier date and stock state with original permissions',()=>{
 const row={id:'x',no:'IB-X',date:'2026-10-14',supplier:'甲',matCode:'Y-X',qty:2,qcStatus:'品檢不合格',stStatus:'退回倉管'};
 const out=inbound([row]).renderInbound();for(const label of ['供應商','日期','入庫','數量'])assert.ok(out.includes(`data-label="${label}"`));
 assert.match(out,/inbound-list-table/);assert.doesNotMatch(out,/重新提交<\/button>/);assert.match(inbound([row],true).renderInbound(),/重新提交<\/button>/);
});
test('inbound mobile sorting validates fields, numeric ordering type and keeps search',()=>{
 const ctx=inbound([]);const filters=ctx.inboundListFilters();filters.q='Y-X';filters.page=3;
 ctx.setInboundMobileSort('qty:asc');assert.equal(ctx.SORT.inbound.type,'num');assert.equal(filters.page,1);assert.equal(filters.q,'Y-X');
 ctx.setInboundMobileSort('__proto__:asc');assert.equal(ctx.SORT.inbound.col,'qty');ctx.setInboundMobileSort('date:bad');assert.equal(ctx.SORT.inbound.dir,'asc');
 ctx.setInboundMobileSort('');assert.equal(ctx.SORT.inbound,undefined);assert.equal(filters.q,'Y-X');
});

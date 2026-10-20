const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function setup(mats=[]){let rendered=0;const c=vm.createContext({window:{},mats,clearTimeout,escapeHtml:s=>String(s).replaceAll('<','&lt;').replaceAll('>','&gt;'),renderTab:()=>rendered++});
 vm.runInContext(cut('function getOrderFilters(','function getCorderSearchDraft(')+cut('function renderOrderProduct(','function _renderOrdersList(')+cut('function getInventoryFilterState(','function _invQuick('),c);
 return {c,rendered:()=>rendered};}
test('unresolved relation retains original order product and code, clearly labeled and escaped',()=>{
 const {c}=setup();const out=c.renderOrderProduct({productId:'missing',product:'<sample>',matCode:'Y-123'});
 assert.match(out,/&lt;sample&gt;/);assert.match(out,/Y-123/);assert.match(out,/主檔關聯待核對/);assert.doesNotMatch(out,/<sample>/);
});
test('resolved master remains preferred; no name or code is invented for a blank order',()=>{
 const {c}=setup([{id:'a',name:'master',code:'Y-A'}]);assert.match(c.renderOrderProduct({productId:'a',product:'old'}),/master/);
 assert.doesNotMatch(c.renderOrderProduct({productId:'a'}),/待核對/);assert.match(c.renderOrderProduct({}),/品項未填/);
});
test('reset clears all independent order filters and draft, preserves sort outside filter state',()=>{
 const {c,rendered}=setup();Object.assign(c.getOrderFilters(),{q:'a',type:'sfg',status:'已完成',date:'7d',hide:true,deadline:'overdue'});c.setOrderSearchDraft('unsent');
 c.resetOrderListFilters();assert.equal(c.getOrderSearchDraft(),'');assert.equal(c.getOrderFilters().date,'0');assert.equal(c.getOrderFilters().type,'all');
 assert.equal(c.getOrderFilters().status,'all');assert.equal(c.getOrderFilters().hide,false);assert.equal(c.getOrderFilters().deadline,'');assert.equal(rendered(),1);
});
test('clear range preserves SKU/type/selection context and never calls any inventory write',()=>{
 const {c}=setup();let renders=0;c._invRender=()=>renders++;c.window._invState={q:'Y-A',type:'零件',stockMin:10,stockMax:2,page:5,pageSize:50};
 c.clearInventoryRange();assert.equal(c.window._invState.q,'Y-A');assert.equal(c.window._invState.type,'零件');assert.equal(c.window._invState.stockMin,'');assert.equal(c.window._invState.page,1);assert.equal(renders,1);
 assert.equal(c.inventoryRangeError({stockMin:'Infinity',stockMax:''}),'庫存範圍需填有效數字。');
});
test('delayed order search never replaces another tab or steals focus after navigation',()=>{
 const {c}=setup();const timers=[];let renders=0,focused=0;
 Object.assign(c,{CURRENT_TAB:'orders',setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout:()=>{},renderTab:()=>renders++,document:{getElementById:()=>({value:'Y-A',focus:()=>focused++,setSelectionRange(){}})}});
 vm.runInContext(cut('function updateOrderFilter(','function normalizeSearchText('),c);
 c.updateOrderFilter('q','Y-A','ordSearchQ');c.CURRENT_TAB='inventory';timers.shift()();assert.equal(renders,0);assert.equal(c.getOrderFilters().q,'Y-A');
 c.CURRENT_TAB='orders';c.updateOrderFilter('q','Y-B','ordSearchQ');timers.shift()();assert.equal(renders,1);
 c.CURRENT_TAB='inventory';timers.shift()();assert.equal(focused,0);
});

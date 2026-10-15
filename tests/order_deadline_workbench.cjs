const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function setup(){
 const storage=new Map(),input={value:'14',focus(){this.focused=true}};
 const ctx=vm.createContext({window:{_coreLoaded:true},orders:[],todayStr:()=> '2026-10-15',
  document:{getElementById:()=>input},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
  showToast:()=>{},renderTab:()=>{},escapeHtml:v=>String(v??'').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  isFresh:()=>true,orderCustomerLabel:o=>o.customer||'—',getOrderFilters:()=>ctx.filters,setOrderSearchDraft:q=>ctx.draft=q,filters:{}});
 vm.runInContext(html.slice(html.indexOf('function orderDeadlineDays('),html.indexOf('function renderOrders(')),ctx);
 vm.runInContext(html.slice(html.indexOf('function _renderDeadlineTab('),html.indexOf('function _renderOrderCalendar(')),ctx);
 return {ctx,input,storage};
}
test('deadline queue includes overdue, today and inclusive range, excludes closed and invalid dates',()=>{
 const {ctx}=setup();
 const rows=[['past','2026-10-14'],['today','2026-10-15'],['edge','2026-10-29'],['later','2026-10-30'],['invalid','2026-02-30'],['missing','']].map(([no,deadline])=>({no,deadline,status:'待排程'}));
 rows.push({no:'closed',deadline:'2026-10-10',status:'已完成'},{no:'cancel',deadline:'2026-10-10',status:'取消'});
 assert.deepEqual(Array.from(ctx.orderDeadlineQueue(rows,14),x=>x.order.no),['past','today','edge']);
});
test('invalid reminder input never changes preference or silently rounds; boundaries persist',()=>{
 const {ctx,input,storage}=setup();ctx.window._deadlineWarn=14;
 for(const value of ['', '0','-1','91','2.5','abc']){input.value=value;assert.equal(ctx.saveOrderDeadlineDays(),false);assert.equal(ctx.window._deadlineWarn,14);assert.equal(storage.size,0);assert.equal(ctx.orderDeadlineDays(value),14);}
 for(const value of ['1','90']){input.value=value;assert.equal(ctx.saveOrderDeadlineDays(),true);assert.equal(storage.get('_deadlineWarn'),value);}
});
test('unloaded and stale data are not presented as confirmed all-clear',()=>{
 const {ctx}=setup();ctx.window._coreLoaded=false;assert.match(ctx._renderDeadlineTab('',[],14),/尚未載入/);
 assert.doesNotMatch(ctx._renderDeadlineTab('',[],14),/目前此範圍沒有訂單/);
 ctx.window._coreLoaded=true;ctx.isFresh=()=>false;assert.match(ctx._renderDeadlineTab('',[],14),/訂單快照/);
});
test('scope counts share the queue and actual order state replaces ephemeral business status',()=>{
 const {ctx}=setup();ctx.orders=[{id:'a',no:'OLD',deadline:'2026-10-14',status:'生產中',qty:10},{id:'b',no:'NEXT',deadline:'2026-10-16',status:'待出貨',qty:20}];
 let out=ctx._renderDeadlineTab('',[],14);assert.match(out,/逾期 1 天/);assert.match(out,/訂單狀態：生產中/);assert.match(out,/定位訂單/);assert.doesNotMatch(out,/_deadlineStatus|業務狀態更新/);
 ctx.window._deadlineScope='overdue';out=ctx._renderDeadlineTab('',[],14);assert.match(out,/OLD/);assert.doesNotMatch(out,/NEXT/);
 ctx.window._deadlineScope='upcoming';out=ctx._renderDeadlineTab('',[],14);assert.match(out,/NEXT/);assert.doesNotMatch(out,/OLD/);
});
test('locating an order clears conflicting filters and preserves business data',()=>{
 const {ctx}=setup();ctx.orders=[{id:'a',no:'ORD-X',status:'生產中'}];Object.assign(ctx.filters,{type:'domestic',status:'取消',date:'7d',hide:true,deadline:'overdue'});
 const before=JSON.stringify(ctx.orders);ctx.locateDeadlineOrder('a');assert.equal(ctx.draft,'ORD-X');assert.equal(ctx.filters.status,'all');assert.equal(ctx.filters.date,'0');assert.equal(ctx.filters.hide,false);assert.equal(ctx.filters.deadline,'');assert.equal(ctx.window._ORD_SUB,'list');assert.equal(JSON.stringify(ctx.orders),before);
});

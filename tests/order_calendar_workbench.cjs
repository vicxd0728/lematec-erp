const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function setup(){
 const host={innerHTML:''};let opens=0;
 const ctx=vm.createContext({window:{_coreLoaded:true,_ORD_CAL_YEAR:2026,_ORD_CAL_MONTH:12,_ORD_CAL_MONTHS:2},orders:[],
  todayStr:()=> '2026-10-15',isFresh:()=>true,orderCustomerLabel:o=>o.customer||'—',pill:s=>s,
  escapeHtml:v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  document:{getElementById:()=>host},showToast:()=>{},openSharedModal:()=>opens++});
 vm.runInContext(html.slice(html.indexOf('function orderCalendarData('),html.indexOf('const VIDEO_LIBRARY_SEED')),ctx);
 return {ctx,host,opens:()=>opens};
}
test('calendar keeps all valid active dated records, counts missing dates and excludes closed orders',()=>{
 const {ctx}=setup();const rows=[{deadline:'2026-10-15',status:'待出貨'},{deadline:'2026-10-15T12:00:00',status:'生產中'},{deadline:'',status:'待排程'},{deadline:'2026-02-30',status:'待排程'},{deadline:'2026-10-15',status:'取消'},{deadline:'2026-10-15',status:'已完成'}];
 const before=JSON.stringify(rows),result=ctx.orderCalendarData(rows);assert.equal(result.days['2026-10-15'].length,2);assert.equal(result.undated,2);assert.equal(JSON.stringify(rows),before);
});
test('date dialog shows every record with full identity and escaped text, never only first two previews',()=>{
 const {ctx,host,opens}=setup();ctx.orders=Array.from({length:12},(_,i)=>({id:'id'+i,no:'FULL-ORDER-'+i,deadline:'2026-10-15',customer:'<client>',product:'<part>',qty:i+1,status:'待排程'}));
 ctx.openOrderCalendarDay('2026-10-15');assert.equal(opens(),1);assert.match(host.innerHTML,/交期訂單 12 筆/);assert.match(host.innerHTML,/FULL-ORDER-11/);assert.match(host.innerHTML,/&lt;part&gt; × 12/);assert.doesNotMatch(host.innerHTML,/<client>/);assert.equal((host.innerHTML.match(/<article/g)||[]).length,12);assert.match(host.innerHTML,/closeModal\(\);locateDeadlineOrder/);
});
test('calendar loading is unknown, while a loaded empty day has a recovery action',()=>{
 const {ctx,host,opens}=setup();ctx.window._coreLoaded=false;assert.match(ctx._renderOrderCalendar('tabs'),/尚未載入/);ctx.openOrderCalendarDay('2026-10-15');assert.equal(opens(),0);
 ctx.window._coreLoaded=true;ctx.openOrderCalendarDay('2026-10-15');assert.match(host.innerHTML,/沒有已載入/);assert.match(host.innerHTML,/關閉/);
 ctx.isFresh=()=>false;assert.match(ctx._renderOrderCalendar('tabs'),/快照/);
});
test('calendar crosses year boundaries and date controls expose complete date and actual count',()=>{
 const {ctx}=setup();ctx.orders=[{id:'a',no:'A-LONG-ORDER-NUMBER',deadline:'2027-01-01',qty:5,status:'待排程'}];
 const out=ctx._renderOrderCalendar('tabs');assert.match(out,/2027 年 1 月/);assert.match(out,/aria-label="2027-01-01，1 筆未結案訂單"/);assert.match(out,/onclick="openOrderCalendarDay/);assert.match(out,/A-LONG-ORDER-NUMBER/);assert.match(out,/前 10 個有交期的日期/);
});

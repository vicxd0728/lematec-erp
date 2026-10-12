const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert(a>=0&&b>a,`missing ${start}`);return html.slice(a,b);}
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function context(overrides={}){
 const ctx=vm.createContext({window:{},mats:[],orders:[],inbounds:[],picks:[],ROLE:'AI',ROLES:{AI:{tabs:['orders','picking','inbound']}},
 canonicalPageId:v=>String(v||'').replaceAll('-',''),escapeHtml,document:{getElementById:()=>null},
 renderTab:()=>{},closeModal:()=>{},switchTab:()=>{},showToast:()=>{},setOrderSearchDraft:()=>{},analyticsNum:v=>String(v),
 applyDateFilterValue:(_v,rows)=>rows,applySort:(_key,rows)=>rows,TH:()=>'<th>欄</th>',pill:escapeHtml,
 dashboardCanCreateInbound:()=>false,shortageSourceOrderLink:()=>'',isFresh:()=>true,
 isShopeeProductionOrder:o=>o.orderType==='shopee',isSfgProductionOrder:o=>o.orderType==='sfg',
 ...overrides});
 vm.runInContext(section('function analyticsIsCompleted(','function analyticsReturnReasonLabel('),ctx);
 vm.runInContext(section('function analyticsShowMoreDemand(){','function analyticsOrderActionPanel('),ctx);
 vm.runInContext(section('function pickingSearchRows(','function renderPicking(){'),ctx);
 vm.runInContext(section('function inboundListFilters(){','const _resubmitInboundPending='),ctx);
 return ctx;
}
test('picking search matches source order, customer, parent SKU and picked child SKU',()=>{
 const ctx=context({orders:[{id:'order-1',no:'ORD-TEST',customer:'客戶甲',productId:'m1'}],mats:[{id:'m1',code:'Z-PARENT'}]});
 const rows=[{id:'p1',no:'PK-ONE',orderId:'order1',items:[{code:'Y-CHILD',name:'子件名稱'}]},{id:'p2',no:'PK-TWO'}];
 for(const query of ['ord-test','客戶甲','z-parent','y-child','子件名稱','pk-one'])assert.equal(ctx.pickingSearchRows(rows,query)[0]?.id,'p1',query);
 assert.equal(ctx.pickingSearchRows(rows,'not-found').length,0);
 assert.equal(ctx.pickingSearchRows(rows,' ').length,2);
});
test('picking search resets pagination and preserves caret after rendering',()=>{
 const input={value:'PK',selectionStart:1},next={focus(){this.focused=true;},setSelectionRange(a,b){this.range=[a,b];}};
 const ctx=context({window:{_PICK_PAGE:3},document:{getElementById:()=>next}});
 ctx.updatePickingSearch(input);assert.equal(ctx.window._PICK_Q,'PK');assert.equal(ctx.window._PICK_PAGE,1);assert.equal(next.focused,true);assert.deepEqual(next.range,[1,1]);
});
test('picking source order lookup resets conflicting filters without writes',()=>{
 const filters={q:'old',type:'sfg',status:'已完成',date:'7d',hide:true,deadline:'overdue'};let tab;
 const ctx=context({orders:[{id:'o-1',no:'ORD-ONE'}],getOrderFilters:()=>filters,switchTab:v=>tab=v});
 ctx.openPickingSourceOrder('o1');assert.equal(tab,'orders');assert.equal(filters.q,'ORD-ONE');assert.equal(filters.type,'all');assert.equal(filters.date,'0');assert.equal(filters.status,'all');assert.equal(filters.hide,false);assert.equal(filters.deadline,'');
});
test('source order lookup respects navigation access and stale identity',()=>{
 let switched=false;const ctx=context({ROLES:{AI:{tabs:['picking']}},switchTab:()=>switched=true});
 ctx.openPickingSourceOrder('unknown');assert.equal(switched,false);
});
test('inbound reset clears all conflicting filters including date and page',()=>{
 const ctx=context({window:{_INBOUND_FILTERS:{q:'old',status:'returned',date:'7d',page:8}}});
 ctx.resetInboundFilters();assert.deepEqual(JSON.parse(JSON.stringify(ctx.inboundListFilters())),{q:'',status:'all',date:'0',page:1});
});
test('inbound quick counts share the filtered list scope and show reset for empty results',()=>{
 const ctx=context({inbounds:[{no:'IN-1',qcStatus:'待品檢',stStatus:'待入庫'},{no:'IN-2',qcStatus:'品檢通過',stStatus:'已入庫'},{no:'IN-3',qcStatus:'品檢不合格',stStatus:'退回供應商'}]});
 const markup=ctx.renderInbound();assert.match(markup,/待品檢／入庫 1/);assert.match(markup,/已入庫 1/);assert.match(markup,/品檢退回 1/);
 ctx.inboundListFilters().q='missing';assert.match(ctx.renderInbound(),/清除篩選並顯示全部/);
});
test('combined demand detects two individually covered orders sharing one balance',()=>{
 const ctx=context();
 const result=ctx.analyticsOrderActionInsight([{id:'a',productId:'m',qty:6,status:'待排程'},{id:'b',productId:'m',qty:6,status:'待排程'}],[{id:'m',code:'Y-X',stock:10}],'2026-10-12');
 assert.equal(result.blocked.length,0);assert.equal(result.materialDemand.length,1);
 assert.equal(result.materialDemand[0].needed,12);assert.equal(result.materialDemand[0].short,2);assert.equal(result.materialDemand[0].orders.length,2);
});
test('combined demand excludes cancelled, already picked and internal production orders',()=>{
 const ctx=context();const rows=['取消','已完成','生產中','待排程'].map((status,i)=>({id:String(i),productId:'m',qty:4,status}));
 rows.push({id:'s',orderType:'sfg',productId:'m',qty:100,status:'待排程'},{id:'sh',orderType:'shopee',productId:'m',qty:100,status:'待排程'});
 const result=ctx.analyticsOrderActionInsight(rows,[{id:'m',code:'Y-X',stock:1}],'2026-10-12');assert.equal(result.materialDemand[0].needed,4);
});
test('unknown balances stay outside computed demand and equal SKU text does not merge identities',()=>{
 const ctx=context();const result=ctx.analyticsOrderActionInsight([{id:'a',productId:'m1',qty:2,status:'待排程'},{id:'b',productId:'m2',qty:3,status:'待排程'},{id:'c',productId:'m3',qty:4,status:'待排程'}],[{id:'m1',code:'DUP',stock:1},{id:'m2',code:'DUP',stock:2},{id:'m3',code:'UNKNOWN',stock:null}],'2026-10-12');
 assert.equal(result.unknown.length,1);assert.equal(result.materialDemand.length,2);assert.equal(result.materialDemand.reduce((n,r)=>n+r.needed,0),5);
});
test('demand view escapes source labels and labels stale snapshots without exposing write actions',()=>{
 const ctx=context({isFresh:()=>false});
 const result=ctx.analyticsOrderActionInsight([{id:'o',no:'<img src=x>',productId:'m',qty:2,status:'待排程'}],[{id:'m',code:'<script>X</script>',stock:0}],'2026-10-12');
 const markup=ctx.analyticsMaterialDemandPanel(result);assert.match(markup,/&lt;img src=x&gt;/);assert.doesNotMatch(markup,/<img src=x>/);assert.match(markup,/快照可能已過期/);assert.match(markup,/需求試算/);assert.doesNotMatch(markup,/onclick="(?:submit|deduct|approve)/);
});
test('unsafe summed quantity is flagged rather than presented as a precise shortage',()=>{
 const ctx=context();const result=ctx.analyticsOrderActionInsight([{id:'a',productId:'m',qty:Number.MAX_SAFE_INTEGER,status:'待排程'},{id:'b',productId:'m',qty:1,status:'待排程'}],[{id:'m',code:'Y-X',stock:0}],'2026-10-12');
 assert.equal(result.materialDemand[0].short,null);assert.match(ctx.analyticsMaterialDemandPanel(result),/需求超出安全計算範圍/);
});

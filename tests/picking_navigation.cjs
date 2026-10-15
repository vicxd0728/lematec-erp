const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function section(start,end){const a=html.indexOf(start),b=html.indexOf(end,a+start.length);assert(a>=0&&b>a);return html.slice(a,b);}
const escapeHtml=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function context(overrides={}){
  const ctx=vm.createContext({window:{},ROLE:'warehouse',picks:[],orders:[],inbounds:[],mats:[],escapeHtml,
    canonicalPageId:v=>String(v||'').replaceAll('-',''),closeModal:()=>{},switchTab:()=>{},renderTab:()=>{},
    document:{getElementById:()=>null},applySort:(_n,rows)=>rows,applyDateFilterValue:(_v,rows)=>rows,
    isViewOnly:()=>false,canConfirmOrderReturnRequest:()=>true,buildPickingReversalRows:()=>[],
    ORDER_RETURN_REQUEST_STATUS:'待回料確認',TH:()=>'<th>欄</th>',pill:escapeHtml,
    completedOrderPickingRows:()=>[],dashboardCanCreateInbound:()=>true,shortageSourceOrderLink:()=>'',
    ...overrides});
  require('./helpers/operational_read_context.cjs')(ctx,html);
  vm.runInContext(section('function pickingVisualStage(p){','const _resubmitInboundPending='),ctx);
  vm.runInContext(section('function goToOrderPickingRows(orderId){','function canConfirmOrderReturnRequest(){'),ctx);
  // Chart renderer is outside this module; the tested list behavior does not depend on its HTML.
  ctx.renderErpVisualRows=()=>'';
  return ctx;
}
test('order-to-picking navigation resets conflicting date status and page',()=>{
  const ctx=context({window:{_PICK_DATE:'7d',_PICK_STATUS:'reversed',_PICK_PAGE:4,_PICK_Q:'unrelated search'}});
  ctx.goToOrderPickingRows('order-123');
  assert.equal(ctx.window._PICK_FOCUS_ORDER,'order123');
  assert.equal(ctx.window._PICK_DATE,'0');assert.equal(ctx.window._PICK_STATUS,'all');assert.equal(ctx.window._PICK_PAGE,1);
  assert.equal(ctx.window._PICK_Q,'');
});
test('changing status and subtab returns to the first page without losing order focus',()=>{
  const ctx=context({window:{_PICK_PAGE:4,_PICK_FOCUS_ORDER:'order'}});
  ctx.setPickingView('auto','return');
  assert.equal(ctx.window._PICK_PAGE,1);assert.equal(ctx.window._PICK_STATUS,'return');assert.equal(ctx.window._PICK_FOCUS_ORDER,'order');
  ctx.setPickingView('manual');assert.equal(ctx.window._PICK_FOCUS_ORDER,'');
});
test('fallback picking is visibly read-only even for warehouse role',()=>{
  const ctx=context({window:{_PICK_SUB:'manual',_pickingDataSource:'notion-fallback'},picks:[{id:'p',no:'P',status:'待領料',fallback:true,qty:1}]});
  const markup=ctx.renderPicking();
  assert.match(markup,/Notion 唯讀備援/);assert.doesNotMatch(markup,/onclick="completeManualPick/);assert.doesNotMatch(markup,/onclick="openManualPickModal/);
});
test('empty filtered picking lists do not tell staff to recreate an order',()=>{
  const ctx=context({window:{_PICK_STATUS:'return'},picks:[{id:'p',orderId:'o',status:'已領料'}]});
  assert.match(ctx.renderPicking(),/目前篩選條件沒有領料紀錄/);
});
test('fallback inbound does not offer resubmission and shows the exact SKU',()=>{
  const ctx=context({window:{_inboundDataSource:'notion-fallback'},inbounds:[{id:'i',no:'IN-1',matName:'接頭',matCode:'Y-GAH-08',qcStatus:'品檢不合格',stStatus:'退回供應商',fallback:true}]});
  const markup=ctx.renderInbound();assert.match(markup,/Notion 唯讀備援/);assert.match(markup,/Y-GAH-08/);assert.doesNotMatch(markup,/onclick="openResubmitInbound/);
});
test('primary inbound retains normal authorized resubmission',()=>{
  const ctx=context({window:{_inboundDataSource:'supabase'},inbounds:[{id:'i',no:'IN-1',matCode:'Y-PART',qcStatus:'品檢不合格',stStatus:'退回供應商',supabaseId:'receipt'}]});
  assert.match(ctx.renderInbound(),/onclick="openResubmitInbound\('i'\)/);
});

test('unknown picking snapshot shows load state and a known empty snapshot shows genuine empty state',()=>{
  const ctx=context();delete ctx.window._picksLoaded;
  assert.match(ctx.renderPicking(),/尚未載入/);assert.doesNotMatch(ctx.renderPicking(),/已載入 0|尚無訂單領料記錄/);
  ctx.window._picksLoaded=true;assert.match(ctx.renderPicking(),/尚無訂單領料記錄/);
});
test('failed or refreshing snapshots retain rows but suppress picking and inbound write controls',()=>{
  const ctx=context({window:{_PICK_SUB:'manual'},picks:[{id:'p',no:'P',status:'待領料',qty:1}],inbounds:[{id:'i',no:'IN-1',qcStatus:'品檢不合格',stStatus:'退回供應商'}]});
  for(const state of [{loading:true,error:''},{loading:false,error:'network error'}]){
    ctx.window._operationalReads={picks:state,inbounds:state};
    const pick=ctx.renderPicking(),inbound=ctx.renderInbound();assert.match(pick,/>P</);assert.match(inbound,/IN-1/);
    assert.doesNotMatch(pick,/onclick="openManualPickModal|onclick="completeManualPick/);assert.doesNotMatch(inbound,/onclick="openResubmitInbound|onclick="openModal\('newInbound/);
  }
  ctx.window._operationalReads={};assert.match(ctx.renderPicking(),/onclick="openManualPickModal/);assert.match(ctx.renderInbound(),/onclick="openResubmitInbound/);
});
test('compact overview keeps urgent return access visible and preserves the disclosure choice',()=>{
  const ctx=context({picks:[{id:'p',no:'P',orderId:'order',status:'待回料確認',qty:1}]});
  let out=ctx.renderPicking();assert.match(out,/待回料 1/);assert.match(out,/查看待回料確認/);assert.doesNotMatch(out,/<details class="picking-overview-details" open/);
  ctx.window._pickingOverviewOpen=true;out=ctx.renderPicking();assert.match(out,/<details class="picking-overview-details" open/);assert.match(out,/pickingResults/);
});

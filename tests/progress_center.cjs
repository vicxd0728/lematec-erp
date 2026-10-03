const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const start = html.indexOf('const SUPPLY_WORK_TYPES=');
const end = html.indexOf('let schedules = [];', start);
assert(start >= 0 && end > start, 'progress center module exists');
const moduleCode = html.slice(start, end);

function setup(orders = []) {
  const ctx = vm.createContext({
    orders,
    window: { _coreLoaded: true },
    Date,
    CURRENT_TAB: 'schedule',
    document: { getElementById: () => ({ innerHTML: '' }) },
    renderTab: () => {},
    renderSchedule: () => '<div>legacy schedule</div>',
    loadSchedule: async () => {},
    escapeHtml: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
    pill: status => `<span>${status}</span>`,
    orderProductName: order => order.product,
    mats: [],
    boms: [],
    _bomDataReady: false,
    isShopeeProductionOrder: order => ['shopee','蝦皮'].includes(order.orderType) || (!order.orderType && String(order.matCode||order.product||'').startsWith('S-')),
    isSfgProductionOrder: order => ['sfg','半成品'].includes(order.orderType) || (!order.orderType && String(order.no||'').startsWith('SFG-')),
    todayStr: () => '2026-10-02',
    taipeiDateKey: () => '2026-10-09',
    isFresh: () => true,
    isViewOnly: () => false,
    isAdminRole: () => false,
    ROLE: 'purchase',
  });
  vm.runInContext(moduleCode, ctx);
  return ctx;
}

test('supply view waits for official data and shows recorded jobs without inventing outside stock', () => {
  const ctx = setup();
  vm.runInContext("progressCenterView='supply'", ctx);
  let rendered = ctx.renderProgressCenter();
  assert.match(rendered, /供應鏈資料尚未載入/);
  for (const work of ['電鍍', '噴砂', '攻牙', '清洗', '塑膠射出', '金屬射出', '沖壓', '電子廠', '外包組裝']) {
    assert.match(ctx.supplyStepOptions(), new RegExp(work));
  }
  vm.runInContext("supplyLoaded=true;supplyJobs=[{id:'a',title:'零件加工',work_number:'SC-1',status:'加工中',material_sku:'Y-A',quantity:12,unit:'件',due_date:'2026-10-01',current_step:0,steps:[{type:'電鍍',supplier:'甲廠'}]}]", ctx);
  rendered = ctx.renderProgressCenter();
  assert.match(rendered, /SC-1/);
  assert.match(rendered, /已逾期/);
  assert.match(rendered, /加工流程；已完成 0 關，共 1 關/);
  assert.match(rendered, /完成本關／轉下一關/);
  assert.match(rendered, /supplyOpenAdvance\('a'\)/);
  assert.match(rendered, /送外與轉廠只記錄流程，不扣庫存/);
  assert.match(rendered, /入料經品檢通過才增加庫存/);
});

test('Notion catalog management links and historical selections remain available',()=>{
  const ctx=setup(),modal={innerHTML:''};
  ctx.document.getElementById=()=>modal;ctx.openSharedModal=()=>{};
  vm.runInContext("supplyLoaded=true;supplySuppliers=[{name:'甲廠',work_type_names:['電鍍']}];supplyNotionLinks={suppliers:'https://app.notion.com/p/suppliers',work_types:'https://app.notion.com/p/types'}",ctx);
  assert.match(ctx.renderSupplyChainFoundation(),/管理供應商／工項/);
  ctx.supplyOpenCatalog();
  assert.match(modal.innerHTML,/在 Notion 管理供應商/);
  assert.match(modal.innerHTML,/在 Notion 管理加工工項/);
  assert.match(modal.innerHTML,/甲廠/);
  assert.match(modal.innerHTML,/可承接：電鍍/);
  assert.match(ctx.supplySupplierOptions('舊廠','電鍍'),/value="舊廠" selected/);
  assert.match(ctx.supplyStepOptions('舊工項'),/value="舊工項" selected/);
  vm.runInContext("supplyDisabledWorkTypes=['電鍍']",ctx);
  assert.doesNotMatch(ctx.supplyStepOptions(),/電鍍/);
  assert.match(ctx.supplyStepOptions('電鍍'),/value="電鍍" selected/);
});

test('refreshing Notion catalog inside a work form preserves entered values',async()=>{
  const ctx=setup(),fields={
    supplyType:{value:'沖壓',innerHTML:''},supplyCreateSupplier:{value:'舊廠',innerHTML:''},
    supplyTitle:{value:'已填工作'},supplyQuantity:{value:'100'},supplyDue:{value:'2026-10-10T17:00'},
  };
  ctx.document.getElementById=id=>fields[id]||null;
  ctx.pickingWorkerRequest=async()=>({suppliers:[{name:'新廠',source:'notion',work_type_names:['沖壓']}],work_types:[{name:'沖壓',source:'notion'}],templates:[],disabled_work_types:[],notion_links:{suppliers:'https://app.notion.com/p/new'}});
  ctx.showToast=()=>{};
  await ctx.supplyRefreshCatalogInForm();
  assert.equal(fields.supplyTitle.value,'已填工作');
  assert.equal(fields.supplyQuantity.value,'100');
  assert.equal(fields.supplyDue.value,'2026-10-10T17:00');
  assert.equal(fields.supplyType.value,'沖壓');
  assert.equal(fields.supplyCreateSupplier.value,'舊廠');
  assert.match(fields.supplyCreateSupplier.innerHTML,/新廠/);
  assert.match(ctx.supplySupplierField('supplyCreate'),/在 Notion 新增/);
});

test('removed supply work stays out of daily counts and can be found for restoration', () => {
  const ctx=setup();
  vm.runInContext("supplyLoaded=true;supplyJobs=[{id:'b',title:'誤建加工',work_number:'SC-2',status:'加工中',archived_at:'2026-10-02T00:00:00Z',archived_reason:'建錯',current_step:0,steps:[{type:'噴砂',supplier:'乙廠'}]}]",ctx);
  let rendered=ctx.renderSupplyChainFoundation();
  assert.doesNotMatch(rendered,/SC-2/);
  assert.match(rendered,/進行中<\/div><strong[^>]*>0<\/strong>/);
  vm.runInContext("supplyFilter='archived'",ctx);
  rendered=ctx.renderSupplyChainFoundation();
  assert.match(rendered,/SC-2/);
  assert.match(rendered,/移除原因：建錯/);
  assert.match(rendered,/還原/);
});

test('work detail can open a process route while the default list remains unchanged', () => {
  const ctx=setup(),modal={innerHTML:''};
  ctx.document.getElementById=()=>modal;
  ctx.openSharedModal=()=>{};
  vm.runInContext("supplyJobs=[{id:'a',title:'接頭加工',work_number:'SC-3',status:'加工中',current_step:1,steps:[{type:'沖壓',supplier:'甲廠'},{type:'攻牙',supplier:'乙廠'}],events:[{action:'WORK_CREATED',recorded_at:'2026-10-01T01:00:00Z'},{action:'advance',recorded_at:'2026-10-02T01:00:00Z'}]}]",ctx);
  ctx.supplyOpenFlow('a');
  assert.match(modal.innerHTML,/第 1 站 · 沖壓/);
  assert.match(modal.innerHTML,/第 2 站 · 攻牙/);
  assert.match(modal.innerHTML,/已完成 1／2 站/);
  assert.match(modal.innerHTML,/返回工作詳情/);
  assert.match(modal.innerHTML,/實際起始：/);
  assert.match(modal.innerHTML,/本關預計：未設定/);
});

test('stage deadline marks current work overdue and planned stages do not have actual starts', () => {
  const ctx=setup(),modal={innerHTML:''};
  ctx.document.getElementById=()=>modal;ctx.openSharedModal=()=>{};
  vm.runInContext("supplyLoaded=true;supplyJobs=[{id:'late',title:'加工逾期',work_number:'SC-L',status:'加工中',due_date:'2099-10-10',current_step:0,steps:[{type:'沖壓',supplier:'甲廠',started_at:'2026-10-01T01:00:00Z',due_at:'2026-10-01T02:00:00Z'},{type:'清洗',supplier:'乙廠',due_at:'2099-10-02T01:00:00Z'}]}]",ctx);
  const rendered=ctx.renderSupplyChainFoundation();
  assert.match(rendered,/本關逾期/);
  assert.match(rendered,/已逾期工作/);
  ctx.supplyOpenFlow('late');
  assert.match(modal.innerHTML,/實際起始：/);
  assert.match(modal.innerHTML,/尚未開始/);
  assert.match(modal.innerHTML,/本關逾期/);
});

test('selecting a known SKU automatically fills its saved process and keeps quantity/date editable', () => {
  const ctx=setup(),fields={};
  for(const id of ['supplyType','supplyCreateSupplier','supplyTemplate','supplyAutoFlowHint','supplyCreateSteps','supplyQuantity','supplyDue'])fields[id]={value:'',innerHTML:'',textContent:''};
  fields.supplyQuantity.value='100';fields.supplyDue.value='2026-10-15';
  ctx.document.getElementById=id=>fields[id]||null;
  ctx.mats=[{code:'Y-A'},{code:'Y-B'}];
  vm.runInContext("supplyTemplates=[{id:'template-a',name:'Y-A 固定流程',material_sku:'Y-A',steps:[{type:'沖壓',supplier:'甲廠'},{type:'清洗',supplier:'乙廠'}]}]",ctx);
  ctx.supplyTitleChanged('Y-A');
  assert.equal(fields.supplyType.value,'沖壓');
  assert.equal(fields.supplyCreateSupplier.value,'甲廠');
  assert.match(fields.supplyCreateSteps.innerHTML,/清洗 · 乙廠/);
  assert.equal(fields.supplyQuantity.value,'100');assert.equal(fields.supplyDue.value,'2026-10-15');
  ctx.supplyTitleChanged('Y-B');
  assert.equal(fields.supplyType.value,'');
  assert.doesNotMatch(fields.supplyCreateSteps.innerHTML,/清洗 · 乙廠/);
});

test('supply order choices match exact customer SKU and assembly child without treating customer BOM as picked stock',()=>{
  const ctx=setup([
    {id:'domestic',no:'ORD-D',orderType:'國內',status:'待排程',productId:'mat-a',deadline:'2026-10-05'},
    {id:'foreign',no:'ORD-F',orderType:'國外',status:'生產中',productId:'mat-a',deadline:'2026-10-04'},
    {id:'assembly',no:'SFG-1',orderType:'半成品',status:'待排程',productId:'mat-parent',deadline:'2026-10-06'},
    {id:'finished',no:'ORD-FIN',orderType:'國外',status:'待排程',productId:'mat-parent'},
    {id:'shopee',no:'ORD-S',orderType:'蝦皮',status:'待排程',productId:'mat-a'},
    {id:'done',no:'ORD-DONE',orderType:'國內',status:'已完成',productId:'mat-a'},
    {id:'stale',no:'ORD-STALE',orderType:'國外',status:'待排程',productId:'mat-other',matCode:'Y-A'},
  ]);
  ctx.mats=[{id:'mat-a',code:'Y-A'},{id:'mat-parent',code:'F-A'},{id:'mat-other',code:'Y-B'}];
  ctx.boms=[{parentId:'mat-parent',childId:'mat-a',qty:1}];ctx._bomDataReady=true;
  const matches=ctx.supplyOrderCandidates('Y-A');
  assert.deepEqual(matches.map(row=>row.order.id),['foreign','domestic','assembly']);
  assert.deepEqual(matches.map(row=>row.basis),['訂購料號','訂購料號','組立子件']);
  const markup=ctx.supplyOrderChooser('Y-A');
  assert.match(markup,/ORD-D/);assert.match(markup,/ORD-F/);assert.match(markup,/SFG-1/);
  assert.doesNotMatch(markup,/ORD-FIN|ORD-S|ORD-DONE|ORD-STALE/);
  assert.match(ctx.supplyOrderChooser('Y-A','legacy order text'),/保留既有關聯：legacy order text/);
  assert.equal(ctx.supplyRelatedOrderLabel('foreign'),'ORD-F');
  assert.match(ctx.supplyOrderChooser('Y-A','foreign'),/id="supplyRelatedOrderSummary"/);
  assert.match(ctx.supplyOrderSummary('Y-A','foreign'),/ORD-F.*訂購料號/);
  ctx.mats.push({id:'duplicate',code:'Y-A'});
  assert.equal(ctx.supplyOrderCandidates('Y-A').length,0);
  assert.match(ctx.supplyOrderChooser('Y-A'),/多筆主檔/);
  ctx.mats.pop();ctx.window._coreLoaded=false;
  assert.match(ctx.supplyOrderChooser('Y-A'),/訂單資料尚未載入/);
});

test('changing the supply SKU clears an unrelated order choice, while editing preserves old text',()=>{
  const ctx=setup([{id:'order-a',no:'ORD-A',orderType:'國內',status:'待排程',productId:'mat-a'}]);
  ctx.mats=[{id:'mat-a',code:'Y-A'},{id:'mat-b',code:'Y-B'}];
  const choice={innerHTML:''},selected={value:'order-a'},hint={textContent:''};
  ctx.document.getElementById=id=>({supplyOrderChoices:choice,supplyRelatedOrder:selected,supplyAutoFlowHint:hint})[id]||null;
  ctx.supplyTitleChanged('Y-B');
  assert.doesNotMatch(choice.innerHTML,/ORD-A/);
  assert.match(choice.innerHTML,/找到 0 張/);
  assert.match(ctx.supplyOrderChooser('Y-A','舊訂單備註','supplyEditOrder'),/保留既有關聯：舊訂單備註/);
  assert.match(ctx.supplyOrderChooser('不存在的料號'),/料號尚未建檔/);
  const summary={innerHTML:''};
  ctx.document.getElementById=id=>id==='supplyRelatedOrderSummary'?summary:null;
  ctx.supplyOrderSelectionChanged({id:'supplyRelatedOrder',dataset:{sku:'Y-A'},value:'order-a'});
  assert.match(summary.innerHTML,/ORD-A/);
});

test('editing an existing supply job writes a selected matching order ID and retains a legacy reference',()=>{
  const ctx=setup([{id:'order-a',no:'ORD-A',orderType:'國外',status:'生產中',productId:'mat-a'}]);
  ctx.mats=[{id:'mat-a',code:'Y-A'}];
  vm.runInContext("supplyJobs=[{id:'job-a',title:'Y-A',material_sku:'Y-A',related_order:'舊訂單備註',status:'已結案',due_at:'2026-10-10T09:00:00Z',steps:[]}]",ctx);
  const fields={supplyEditTitle:{value:'Y-A'},supplyEditDue:{value:'2026-10-10T17:00'},supplyEditOrder:{value:'舊訂單備註'},supplyEditQuantity:{value:'3'},supplyEditUnit:{value:'件'},supplyEditNotes:{value:''}};
  ctx.document.getElementById=id=>fields[id]||null;
  ctx.supplyDueIso=()=> '2026-10-10T09:00:00Z';
  let payload=null,notice='';ctx.supplyPerform=(_action,_id,data)=>{payload=data;};ctx.showToast=message=>{notice=message;};
  ctx.supplySubmitEdit('job-a');
  assert.equal(payload.related_order,'舊訂單備註');
  fields.supplyEditOrder.value='order-a';ctx.supplySubmitEdit('job-a');
  assert.equal(payload.related_order,'order-a');
  fields.supplyEditOrder.value='unrelated-id';payload=null;ctx.supplySubmitEdit('job-a');
  assert.equal(payload,null);assert.match(notice,/關聯訂單與料號不符/);
});

test('new supply work saves selected stable order ID and rejects a stale mismatched choice',async()=>{
  const ctx=setup([{id:'formal-order-id',no:'ORD-D',orderType:'國內',status:'待排程',productId:'mat-a'}]);
  ctx.mats=[{id:'mat-a',code:'Y-A'},{id:'mat-b',code:'Y-B'}];
  const fields={supplyTitle:{value:'Y-A'},supplyType:{value:'沖壓'},supplyCreateSupplier:{value:'甲廠'},supplyDue:{value:'2026-10-10T17:00'},supplyQuantity:{value:'4'},supplyRelatedOrder:{value:'formal-order-id'},supplyCreateButton:{disabled:false}};
  ctx.document.getElementById=id=>fields[id]||null;
  ctx.supplyDueIso=()=> '2026-10-10T09:00:00.000Z';
  let payload=null,notice='';
  ctx.supplyWrite=async(_action,_job,data)=>{payload=data;return {id:'job-a'};};
  ctx.closeModal=()=>{};ctx.renderTab=()=>{};ctx.supplyOpenDetail=()=>{};ctx.showToast=message=>{notice=message;};
  await ctx.supplyCreateJob();
  assert.equal(payload.related_order,'formal-order-id');
  assert.equal(fields.supplyCreateButton.disabled,false);
  fields.supplyTitle.value='Y-B';payload=null;
  await ctx.supplyCreateJob();
  assert.equal(payload,null);
  assert.match(notice,/關聯訂單與料號不符/);
});

test('order progress uses only active orders and filters overdue work', () => {
  const ctx = setup([
    { id: 'a', no: 'ORD-A', status: '生產中', deadline: '2026-10-01', customer: '甲', product: 'Y-A', qty: 4 },
    { id: 'b', no: 'ORD-B', status: '待出貨', deadline: '2026-10-08', customer: '乙', product: 'Y-B', qty: 5 },
    { id: 'c', no: 'ORD-C', status: '已完成', deadline: '2026-10-01', customer: '丙', product: 'Y-C', qty: 6 },
  ]);
  let rendered = ctx.renderProgressOrders();
  assert.match(rendered, /ORD-A/);
  assert.match(rendered, /ORD-B/);
  assert.doesNotMatch(rendered, /ORD-C/);
  ctx.setProgressCenterFilter('overdue');
  rendered = ctx.renderProgressOrders();
  assert.match(rendered, /ORD-A/);
  assert.doesNotMatch(rendered, /ORD-B/);
});

test('order progress exposes inspection exceptions, missing deadlines and actionable due labels',()=>{
  const ctx=setup([
    {id:'a',no:'QC-EX',status:'品檢異常',deadline:'2026-10-01',customer:'甲',product:'Y-A',qty:1},
    {id:'b',no:'NO-DUE',status:'待排程',deadline:'',customer:'乙',product:'Y-B',qty:2},
  ]);
  let rendered=ctx.renderProgressOrders();
  assert.match(rendered,/品檢異常/);
  assert.match(rendered,/逾期 1 天/);
  assert.match(rendered,/品管：處理異常並安排重檢/);
  assert.match(rendered,/未填交期/);
  ctx.setProgressCenterFilter('inspection');
  rendered=ctx.renderProgressOrders();
  assert.match(rendered,/QC-EX/);
  assert.doesNotMatch(rendered,/NO-DUE/);
  ctx.setProgressCenterFilter('missingDue');
  rendered=ctx.renderProgressOrders();
  assert.match(rendered,/NO-DUE/);
  assert.doesNotMatch(rendered,/QC-EX/);
});

test('order progress counts domestic and foreign customers but excludes assembly and Shopee work',()=>{
  const ctx=setup([
    {id:'d',no:'ORD-D',orderType:'國內',status:'待排程',deadline:'2026-10-03',product:'Y-D'},
    {id:'f',no:'ORD-F',orderType:'overseas',status:'生產中',deadline:'2026-10-04',product:'Y-F'},
    {id:'legacy',no:'ORD-OLD',status:'待檢驗',deadline:'',product:'Y-OLD'},
    {id:'assembly',no:'SFG-1',orderType:'半成品',status:'待排程',deadline:'2026-10-01',product:'Y-SFG'},
    {id:'shopee',no:'ORD-S',orderType:'蝦皮',status:'待排程',deadline:'2026-10-01',product:'S-Y-S'},
    {id:'legacySfg',no:'SFG-OLD',status:'待排程',deadline:'2026-10-01',product:'Y-SFG'},
    {id:'legacyShopee',no:'ORD-S-OLD',status:'待排程',deadline:'2026-10-01',matCode:'S-Y-S'},
    {id:'unknown',no:'ORD-X',orderType:'other',status:'待排程',deadline:'2026-10-01',product:'Y-X'},
  ]);
  let rendered=ctx.renderProgressOrders();
  assert.match(rendered,/國內／國外訂單待辦/);
  for(const no of ['ORD-D','ORD-F','ORD-OLD'])assert.match(rendered,new RegExp(no));
  for(const no of ['SFG-1','ORD-S','SFG-OLD','ORD-S-OLD','ORD-X'])assert.doesNotMatch(rendered,new RegExp(no));
  assert.match(rendered,/國內訂單/);
  assert.match(rendered,/國外訂單/);
  ctx.setProgressCenterFilter('overdue');
  rendered=ctx.renderProgressOrders();
  assert.match(rendered,/目前沒有符合條件的進行中訂單/);
});

test('progress charts reconcile status, type, and exclusive due-date buckets',()=>{
  const ctx=setup([
    {id:'late',no:'ORD-LATE',orderType:'國內',status:'待排程',deadline:'2026-10-01',customer:'甲'},
    {id:'today',no:'ORD-TODAY',orderType:'國外',status:'生產中',deadline:'2026-10-02',customer:'乙'},
    {id:'soon',no:'ORD-SOON',orderType:'國外',status:'待檢驗',deadline:'2026-10-08',customer:'甲'},
    {id:'later',no:'ORD-LATER',orderType:'國內',status:'待出貨',deadline:'2026-10-10',customer:'乙'},
    {id:'missing',no:'ORD-MISSING',orderType:'國內',status:'品檢異常',deadline:'',customer:'甲'},
    {id:'invalid',no:'ORD-INVALID',orderType:'國外',status:'自訂狀態',deadline:'2026-02-30',customer:'乙'},
    {id:'done',no:'ORD-DONE',orderType:'國內',status:'已完成',deadline:'2026-10-01'},
    {id:'internal',no:'SFG-1',orderType:'半成品',status:'待排程',deadline:'2026-10-01'},
  ]);
  const rows=ctx.orders.filter(order=>ctx.progressIsCustomerOrder(order)&&!['已完成','取消'].includes(order.status));
  const overview=ctx.progressOrderOverview(rows,'2026-10-02','2026-10-09');
  assert.equal(overview.total,6);
  assert.equal(Object.values(overview.stages).reduce((a,b)=>a+b,0),6);
  assert.equal(Object.values(overview.due).reduce((a,b)=>a+b,0),6);
  assert.equal(overview.types.domestic+overview.types.overseas,6);
  for(const key of ['overdue','today','soon','later','missingDue','invalidDue'])assert.equal(overview.due[key],1);
  assert.equal(overview.stages['其他狀態'],1);
  assert.equal(ctx.progressDueDay('2026-02-30'),null);
  assert.equal(ctx.progressDueDay('2026-10-02junk'),null);
  assert.equal(ctx.progressDueDay('2026-10-02T08:00:00+08:00'),'2026-10-02');
  const chart=ctx.renderProgressOrderCharts(overview);
  assert.match(chart,/交期分布：已逾期 1 筆、今天到期 1 筆/);
  assert.match(chart,/其他狀態/);
  ctx.setProgressCenterFilter('invalidDue');
  let rendered=ctx.renderProgressOrders();
  assert.match(rendered,/ORD-INVALID/);
  assert.doesNotMatch(rendered,/ORD-LATE/);
  ctx.setProgressCenterFilter('stageOther');
  rendered=ctx.renderProgressOrders();
  assert.match(rendered,/ORD-INVALID/);
  ctx.setProgressCenterFilter('stage:待檢驗');
  rendered=ctx.renderProgressOrders();
  assert.match(rendered,/ORD-SOON/);
  assert.doesNotMatch(rendered,/ORD-INVALID/);
});

test('progress search keeps headline counts and chart denominator aligned with matching order rows',()=>{
  const ctx=setup([
    {id:'a',no:'ORD-A',orderType:'國內',status:'待排程',deadline:'2026-10-01',customer:'甲'},
    {id:'b',no:'ORD-B',orderType:'國外',status:'待出貨',deadline:'2026-10-08',customer:'乙'},
  ]);
  ctx.setProgressCenterSearch('甲');
  const rendered=ctx.renderProgressOrders();
  assert.match(rendered,/以目前搜尋範圍內 1 筆進行中訂單為分母/);
  assert.match(rendered,/國內 1/);
  assert.match(rendered,/國外 0/);
  assert.match(rendered,/ORD-A/);
  assert.doesNotMatch(rendered,/ORD-B/);
});

test('progress order list can reach records beyond the first 40 and resets after narrowing',()=>{
  const rows=Array.from({length:45},(_,index)=>({
    id:`order-${index+1}`,no:`ORD-${String(index+1).padStart(3,'0')}`,
    orderType:'國內',status:'待排程',deadline:'2026-10-01',created:'2026-10-01',customer:'甲',
  }));
  const ctx=setup(rows);
  let rendered=ctx.renderProgressOrders();
  assert.match(rendered,/已顯示 40／45 筆/);
  assert.match(rendered,/顯示更多訂單/);
  assert.doesNotMatch(rendered,/ORD-045/);
  ctx.progressShowMoreOrders();
  rendered=ctx.renderProgressOrders();
  assert.match(rendered,/ORD-045/);
  assert.doesNotMatch(rendered,/顯示更多訂單/);
  ctx.setProgressCenterFilter('overdue');
  assert.equal(vm.runInContext('progressOrderVisibleLimit',ctx),40);
  ctx.progressShowMoreOrders();
  ctx.setProgressCenterSearch('ORD-001');
  assert.equal(vm.runInContext('progressOrderVisibleLimit',ctx),40);
  rendered=ctx.renderProgressOrders();
  assert.match(rendered,/ORD-001/);
  assert.doesNotMatch(rendered,/ORD-045/);
});

test('view-only supply list offers one honest detail action',()=>{
  const ctx=setup();ctx.ROLE='viewer';
  vm.runInContext("supplyLoaded=true;supplyJobs=[{id:'one',title:'接頭加工',work_number:'SC-1',status:'加工中',current_step:0,steps:[{type:'沖壓',supplier:'甲廠'}]}]",ctx);
  const rendered=ctx.renderSupplyChainFoundation();
  assert.match(rendered,/查看詳情/);
  assert.doesNotMatch(rendered,/onclick="supplyOpenAdvance\('one'\)"/);
  assert.equal((rendered.match(/onclick="supplyOpenDetail\('one'\)"/g)||[]).length,1);
});

test('supply coverage warns when the server has more rows than the loaded page',()=>{
  const ctx=setup();
  vm.runInContext("supplyLoaded=true;supplyCoverage={activeTruncated:true,archivedTruncated:false};supplyJobs=[{id:'one',title:'加工',work_number:'SC-1',status:'加工中',current_step:0,steps:[]}]",ctx);
  const rendered=ctx.renderSupplyChainFoundation();
  assert.match(rendered,/供應鏈資料超過單次讀取上限/);
  assert.match(rendered,/未移除工作至少 1 筆/);
  assert.match(rendered,/（已載入）/);
  assert.match(rendered,/≥1/);
});

test('supply sorting prioritizes due work and retains recent-update alternative',()=>{
  const ctx=setup();
  const rows=[
    {id:'late',due_at:'2026-10-10T00:00:00Z',updated_at:'2026-10-03T00:00:00Z',current_step:0,steps:[{due_at:'2026-10-05T00:00:00Z'}]},
    {id:'soon',due_at:'2026-10-04T00:00:00Z',updated_at:'2026-10-01T00:00:00Z',current_step:0,steps:[{due_at:'2026-10-08T00:00:00Z'}]},
    {id:'missing',updated_at:'2026-10-02T00:00:00Z',current_step:0,steps:[{}]},
  ];
  assert.deepEqual(Array.from(ctx.supplySortRows(rows,'due'),row=>row.id),['soon','late','missing']);
  assert.deepEqual(Array.from(ctx.supplySortRows(rows,'stage'),row=>row.id),['late','soon','missing']);
  assert.deepEqual(Array.from(ctx.supplySortRows(rows,'updated'),row=>row.id),['late','missing','soon']);
});

test('formal order opens from supply work and order can find matching supply work',()=>{
  const ctx=setup([{id:'formal-id',no:'ORD-1',orderType:'國內',status:'生產中'}]);
  vm.runInContext("supplyLoaded=true;supplyJobs=[{id:'one',title:'加工',work_number:'SC-1',status:'加工中',related_order:'formal-id',current_step:0,steps:[]}]",ctx);
  let rendered=ctx.renderSupplyChainFoundation();
  assert.match(rendered,/openOrderTimeline\('formal-id'\)/);
  assert.match(rendered,/訂單 ORD-1/);
  assert.match(ctx.supplyRelatedOrderLink('舊文字'),/關聯待核對/);
  assert.doesNotMatch(ctx.supplyRelatedOrderLink('舊文字'),/openOrderTimeline/);
  let loaded=false;ctx.loadSupplyChain=()=>{loaded=true;};
  ctx.progressOpenSupplyForOrder('formal-id');
  assert.equal(vm.runInContext('progressCenterView',ctx),'supply');
  assert.equal(vm.runInContext('supplySearch',ctx),'');
  assert.equal(vm.runInContext('supplyOrderContext',ctx),'formal-id');
  assert.equal(loaded,true);
  rendered=ctx.renderSupplyChainFoundation();
  assert.match(rendered,/正在查看訂單 ORD-1 的關聯外包工作/);
  assert.match(rendered,/SC-1/);
  assert.doesNotMatch(rendered,/value="formal-id"/);
  vm.runInContext("supplyJobs=[]",ctx);
  rendered=ctx.renderSupplyChainFoundation();
  assert.match(rendered,/此訂單未找到關聯外包工作/);
  assert.doesNotMatch(rendered,/新增第一筆工作/);
  ctx.supplyClearOrderContext();
  assert.equal(vm.runInContext('supplyOrderContext',ctx),'');
  rendered=ctx.renderProgressOrders();
  assert.match(rendered,/查外包工作/);
  assert.match(rendered,/狀態提示：/);
});

test('original production schedule remains available in its own view', () => {
  const ctx = setup();
  vm.runInContext("progressCenterView='legacy'", ctx);
  assert.match(ctx.renderProgressCenter(), /legacy schedule/);
});

test('quality and viewer roles can navigate progress center without supply write permission',()=>{
  const rolesStart=html.indexOf('const ROLES='),rolesEnd=html.indexOf('const TAB_LABELS=',rolesStart);
  assert(rolesStart>=0&&rolesEnd>rolesStart);
  const roleCtx=vm.createContext({});
  vm.runInContext(html.slice(rolesStart,rolesEnd),roleCtx);
  const roles=vm.runInContext('ROLES',roleCtx);
  for(const role of ['qc','viewer'])assert(roles[role].tabs.includes('schedule'),`${role} can navigate`);
  const ctx=setup();
  for(const role of ['qc','viewer','sales','ai']){
    ctx.ROLE=role;
    assert.equal(ctx.canWriteSupplyChain(),false,`${role} cannot write supply jobs`);
  }
  ctx.ROLE='qc';
  assert.doesNotMatch(ctx.renderProgressOrders(),/開啟訂單 →/);
  ctx.ROLE='viewer';
  assert.match(ctx.renderProgressOrders(),/開啟訂單 →/);
  for(const role of ['purchase','warehouse']){
    ctx.ROLE=role;
    assert.equal(ctx.canWriteSupplyChain(),true,`${role} can write supply jobs`);
  }
});

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

test('original production schedule remains available in its own view', () => {
  const ctx = setup();
  vm.runInContext("progressCenterView='legacy'", ctx);
  assert.match(ctx.renderProgressCenter(), /legacy schedule/);
});

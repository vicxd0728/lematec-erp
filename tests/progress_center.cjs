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

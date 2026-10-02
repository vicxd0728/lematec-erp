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
  });
  vm.runInContext(moduleCode, ctx);
  return ctx;
}

test('supply view lists the nine requested processes without inventing outside stock', () => {
  const ctx = setup();
  vm.runInContext("progressCenterView='supply'", ctx);
  const rendered = ctx.renderProgressCenter();
  for (const work of ['電鍍', '噴砂', '攻牙', '清洗', '塑膠射出', '金屬射出', '沖壓', '電子廠', '外包組裝']) {
    assert.match(rendered, new RegExp(work));
  }
  assert.match(rendered, /尚未啟用正式流轉紀錄/);
  assert.match(rendered, /沒有可靠資料可以判定實際在外數量/);
  assert.match(rendered, /送外與轉廠只記錄流程，不扣主倉庫存/);
  assert.match(rendered, /選擇入庫/);
  assert.match(rendered, /料號不存在，可在入料流程直接建檔/);
  assert.match(rendered, /品檢通過才增加庫存/);
  assert.match(rendered, /選擇結案/);
  assert.match(rendered, /不建立入料單，也不變動庫存/);
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

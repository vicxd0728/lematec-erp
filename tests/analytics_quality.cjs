const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const start = html.indexOf('function analyticsRange()');
const end = html.indexOf('function renderStockLog()', start);
assert(start >= 0 && end > start, 'analytics module exists');

function makeContext(overrides = {}) {
  const ctx = vm.createContext({
    window: { corders: [], _ANALYTICS_RANGE: '30', _cordersLoaded: true },
    orders: [], mats: [], boms: [], stockLogs: [],
    DATA_LOAD_MODE: { corders: 'recent', stocklog: 'recent' },
    DATA_LOAD_COUNT: { corders: 0, stocklog: 0 },
    DATA_LOAD_DAYS: { corders: 30, stocklog: 30 },
    stockLogLoadError: '',
    escapeHtml: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    todayStr: () => '2026-09-26',
    isFresh: () => false,
    stockLogIsInventoryMove: () => true,
    stockLogDisplayName: row => row.matCode || row.material_name || '—',
    buildStockLogAuditReport: () => ({ issues: [], errors: 0, warnings: 0 }),
    ...overrides,
  });
  vm.runInContext(html.slice(start, end), ctx);
  return ctx;
}

test('analytics date range uses order creation date, never deadline or ship date', () => {
  const ctx = makeContext();
  const rows = [
    { created: '2026-08-01', deadline: '2026-09-25', shipDate: '2026-09-20' },
    { created: '2026-09-25', deadline: '2026-10-01' },
  ];
  assert.deepEqual(rows.map(row => ctx.analyticsWithinRange(row, '30', 'created')), [false, true]);
});

test('date-limited analytics excludes undated records while all-history retains them', () => {
  const ctx = makeContext();
  const row = { qty: 3 };
  assert.equal(ctx.analyticsWithinRange(row, '30', 'created'), false);
  assert.equal(ctx.analyticsWithinRange(row, 'all', 'created'), true);
});

test('selecting 90 days expands both C-end and inventory-movement source queries', async () => {
  const ctx = makeContext();
  ctx.document = { getElementById: () => ({ innerHTML: '' }) };
  ctx.CURRENT_TAB = 'dashboard';
  const calls = [];
  ctx.loadCorders = async options => { calls.push(['corders', options.days, options.skipAutoComplete]); ctx.DATA_LOAD_DAYS.corders = options.days; };
  ctx.loadStockLog = async options => { calls.push(['stocklog', options.days]); ctx.DATA_LOAD_DAYS.stocklog = options.days; };
  await ctx.setAnalyticsRange('90');
  assert.equal(calls.map(x => `${x[0]}:${x[1]}:${x[2]??false}`).sort().join(','), 'corders:90:true,stocklog:90:false');
});

test('analytics initial source load skips automatic C-end status writes', async () => {
  const ctx = makeContext({ window: { corders: [], _ANALYTICS_RANGE: '30', _cordersLoaded: false } });
  const options = [];
  ctx.loadCorders = async value => options.push(value);
  ctx.loadStockLog = async () => {};
  await ctx.loadAnalyticsData();
  assert.equal(options[0].skipAutoComplete, true);
});

test('completion-rate denominator excludes cancelled orders', () => {
  const ctx = makeContext();
  const rows = [{ status: '已完成' }, { status: '生產中' }, { status: '取消' }, { status: '已取消' }];
  const countable = rows.filter(ctx.analyticsIsCountableOrder);
  assert.equal(countable.length, 2);
});

test('current overdue backlog remains visible when its order predates the selected period', () => {
  const ctx = makeContext({ orders: [
    { status: '生產中', created: '2026-07-01', deadline: '2026-08-01', qty: 1 },
  ] });
  const result = ctx.buildOperationsAnalytics();
  assert.equal(result.orderRows.length, 0);
  assert.equal(result.overdue.length, 1);
});

test('C-end shipped quantity excludes orders that are still shipping or cancelled', () => {
  const ctx = makeContext({
    window: { corders: [
      { status: '已完成', qty: 4, created: '2026-09-20' },
      { status: '部分退貨', qty: 3, created: '2026-09-20' },
      { status: '出貨中', qty: 8, created: '2026-09-20' },
      { status: '已取消', qty: 9, created: '2026-09-20' },
    ], _ANALYTICS_RANGE: '30', _cordersLoaded: true },
  });
  assert.equal(ctx.buildOperationsAnalytics().cSoldQty, 7);
});

test('internal assembly and Shopee rows are separated from customer ranking', () => {
  const ctx = makeContext({ orders: [
    { customer: '甲客戶', status: '待排程', created: '2026-09-20', qty: 2 },
    { customer: '組立單', status: '待排程', created: '2026-09-20', qty: 1 },
    { customer: '蝦皮', status: '待排程', created: '2026-09-20', qty: 1 },
  ] });
  const result = ctx.buildOperationsAnalytics();
  assert.equal([...result.customerTotals.keys()].join(','), '甲客戶');
  assert.equal([...result.orderCategoryTotals.entries()].map(([key, value]) => `${key}:${value}`).join(','), '組立單:1,蝦皮:1');
});

test('operations analytics includes a source-backed order creation trend and load scope', () => {
  const ctx = makeContext();
  const markup = ctx.renderAnalytics();
  assert.match(markup, /訂單建立趨勢/);
  assert.match(markup, /依建立日期/);
  assert.match(markup, /C端.*已載入.*筆/);
  assert.match(markup, /異動.*已載入.*筆/);
});

test('all-data view warns when one source has not completed its full-history load', () => {
  const ctx = makeContext({
    window: { corders: [], _ANALYTICS_RANGE: 'all', _cordersLoaded: true },
    DATA_LOAD_MODE: { corders: 'recent', stocklog: 'all' },
  });
  assert.match(ctx.renderAnalytics(), /歷史資料載入尚未完整/);
});

test('all-history trend preserves empty months instead of implying continuous volume', () => {
  const ctx = makeContext();
  const trend = ctx.analyticsTrendData([
    { created: '2026-01-05' },
    { created: '2026-03-05' },
  ], [], 'all');
  assert.equal(trend.map(x => `${x.key}:${x.formal}`).join(','), '2026-01:1,2026-02:0,2026-03:1');
});

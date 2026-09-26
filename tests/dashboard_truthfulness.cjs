const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const start = html.indexOf('function dashboardTabAvailable(');
const end = html.indexOf('function renderDashboard()', start);
assert(start >= 0 && end > start, 'dashboard metric helpers exist');
const helperEnd = html.indexOf('function dashboardFreshnessStrip()', start);

function makeContext(role, tabs, loaded = []) {
  const window = {};
  for (const key of loaded) window[`_${key}Loaded`] = true;
  window.corders = [];
  return vm.createContext({
    ROLE: role,
    ROLES: { [role]: { tabs } },
    window,
    orders: [], mats: [], picks: [], inbounds: [],
    QC_SUB: 'pending',
    todayStr: () => '2026-09-26',
    isShopeeProductionOrder: order => order.orderType === 'shopee',
    pickingVisualStage: pick => pick.stage || 'other',
  });
}

test('dashboard shows a real zero only after its data is loaded', () => {
  const ctx = makeContext('warehouse', ['picking', 'inbound']);
  vm.runInContext(html.slice(start, end), ctx);
  assert.deepEqual({ ...ctx.dashboardMetric('picking', 'picks', 0) }, { value: '—', state: '資料載入中' });
  ctx.window._picksLoaded = true;
  assert.deepEqual({ ...ctx.dashboardMetric('picking', 'picks', 0) }, { value: 0, state: '資料已載入' });
});

test('dashboard hides metrics for tabs unavailable to the active role', () => {
  const ctx = makeContext('qc', ['qc', 'inbound'], ['core', 'leaves']);
  vm.runInContext(html.slice(start, end), ctx);
  assert.deepEqual({ ...ctx.dashboardMetric('orders', 'core', 23) }, { value: '—', state: '此職務未開放' });
  assert.deepEqual({ ...ctx.dashboardMetric('leave', 'leaves', 2) }, { value: '—', state: '此職務未開放' });
});

test('dashboard navigation refuses links outside the active role', () => {
  const ctx = makeContext('qc', ['qc', 'inbound']);
  let navigated = '';
  ctx.switchTab = tab => { navigated = tab; };
  ctx.showToast = () => {};
  vm.runInContext(html.slice(start, end), ctx);
  assert.equal(ctx.dashboardGo('orders'), false);
  assert.equal(navigated, '');
  assert.equal(ctx.dashboardGo('qc'), true);
  assert.equal(navigated, 'qc');
});

test('role todo list limits work to accessible modules and counts each wait-schedule order once', () => {
  const tabs = ['dashboard', 'orders', 'picking', 'inventory', 'qc', 'corders'];
  const ctx = makeContext('warehouse', tabs, ['core', 'picks']);
  ctx.orders = [{ status: '待出貨' }, { status: '待排程', orderType: 'shopee' }, { status: '待排程' }];
  ctx.picks = [{ stage: 'shortage' }];
  ctx.mats = [{ stock: 0, safe: 2 }];
  vm.runInContext(html.slice(start, helperEnd), ctx);
  const todos = ctx.dashboardTodoItems();
  assert.equal(todos.find(item => item.key === 'ship').count, 1);
  assert.equal(todos.some(item => item.key === 'shopee'), false, 'warehouse sees one combined wait-schedule task');
  assert.equal(todos.find(item => item.key === 'production').count, 2);
  assert.equal(todos.find(item => item.key === 'shortage').count, 1);
  assert.equal(todos.find(item => item.key === 'stock').count, 1);
  assert.ok(!todos.some(item => item.key === 'orderQc'), 'warehouse does not receive QC-only tasks');
  assert.ok(todos.some(item => item.key === 'inboundQc') === false, 'warehouse does not receive QC tasks');
});

test('sales Shopee and C-end tasks remain visibly loading until their own data arrives', () => {
  const ctx = makeContext('sales', ['dashboard', 'orders', 'corders'], ['core']);
  ctx.orders = [{ status: '待排程', orderType: 'shopee' }];
  vm.runInContext(html.slice(start, helperEnd), ctx);
  const todos = ctx.dashboardTodoItems();
  assert.equal(todos.find(item => item.key === 'shopee').count, 1);
  assert.equal(todos.find(item => item.key === 'corderShip').count, null);
});

test('todo routes open the matching order, picking, and QC filters', () => {
  const ctx = makeContext('warehouse', ['dashboard', 'orders', 'picking', 'qc']);
  ctx.getOrderFilters = () => ctx.window.filters || (ctx.window.filters = { q: '', type: 'all', status: 'all', date: '7d', hide: true, deadline: 'overdue' });
  ctx.setOrderSearchDraft = value => { ctx.searchDraft = value; };
  ctx.switchTab = tab => { ctx.currentTab = tab; };
  ctx.showToast = () => {};
  vm.runInContext(html.slice(start, helperEnd), ctx);
  assert.equal(ctx.dashboardOpenTodo('order:status:待出貨'), true);
  assert.equal(ctx.window.filters.status, '待出貨');
  assert.equal(ctx.window.filters.date, '0');
  assert.equal(ctx.dashboardOpenTodo('order:shopee-pending'), true);
  assert.equal(ctx.window.filters.type, 'shopee');
  assert.equal(ctx.window.filters.status, '待排程');
  assert.equal(ctx.dashboardOpenTodo('pick:shortage'), true);
  assert.equal(ctx.window._PICK_STATUS, 'shortage');
  assert.equal(ctx.dashboardOpenTodo('qc:order'), true);
  assert.equal(ctx.QC_SUB, 'order_qc');
});

test('dashboard separates unknown inventory balances from low stock', () => {
  const ctx = vm.createContext({});
  vm.runInContext(html.slice(start, helperEnd), ctx);
  const classify = value => ctx.dashboardStockStatus(value);
  assert.deepEqual([
    classify({ stock: 0, safe: 2 }),
    classify({ stock: 3, safe: 2 }),
    classify({ stock: null, safe: 2 }),
    classify({ stock: 'bad', safe: 2 }),
  ], ['low', 'ok', 'unknown', 'unknown']);
});

test('dashboard reports source freshness and scopes quick entry cards by role', () => {
  const dashboard = html.slice(html.indexOf('function renderDashboard()'), html.indexOf('function renderOrders()'));
  assert.match(dashboard, /dashboardFreshnessStrip\(\)/);
  assert.match(dashboard, /filter\(e=>dashboardTabAvailable\(e\.tab\)\)/);
  assert.match(dashboard, /activeOrders:dashboardMetric\('orders','core',active\.length\)/);
  assert.match(dashboard, /todayShip:dashboardMetric\('ops','core',todayShipOrders\.length\)/);
  assert.doesNotMatch(dashboard, /count:`\$\{active\.length\} 筆進行中`/);
  assert.doesNotMatch(dashboard, /count:`\$\{todayShipOrders\.length\} 筆今日出貨`/);
  assert.match(html.slice(start, html.indexOf('function renderDashboard()')), /Notion · 近30天及未結案/);
  assert.match(html.slice(start, html.indexOf('function renderDashboard()')), /Supabase · 最多5,000筆/);
  assert.doesNotMatch(dashboard, /width:75%|width:60%|width:50%/);
});

test('dashboard highlights overdue orders and routes directly to their filtered list', () => {
  const dashboard = html.slice(html.indexOf('function renderDashboard()'), html.indexOf('function renderOrders()'));
  assert.match(dashboard, /const overdueOrders=orders\.filter/);
  assert.match(dashboard, /deadline:dashboardMetric\('orders','core',overdueOrders\.length\)/);
  assert.match(dashboard, /逾期未完成/);
  assert.match(dashboard, /天內到期 \$\{window\._coreLoaded\?deadlineSoon\.length:'—'\} 筆/);
  assert.match(dashboard, /onclick="dashboardGo\('orders','\$\{overdueOrders\.length\?'overdue':'deadline'\}'\)"/);

  const ctx = makeContext('sales', ['orders'], ['core']);
  const start = html.indexOf('function dashboardTabAvailable(');
  const end = html.indexOf('function dashboardMetric(', start);
  let navigated = '';
  ctx.getOrderFilters = () => ctx.window._ORDER_FILTERS || (ctx.window._ORDER_FILTERS = { q: '', type: 'all', status: 'all', date: '0', hide: false, deadline: '' });
  ctx.setOrderSearchDraft = value => { ctx.searchDraft = value; };
  ctx.switchTab = tab => { navigated = tab; };
  ctx.showToast = () => {};
  vm.runInContext(html.slice(start, end), ctx);
  assert.equal(ctx.dashboardGo('orders', 'overdue'), true);
  assert.equal(navigated, 'orders');
  assert.equal(ctx.window._ORDER_FILTERS.deadline, 'overdue');
  assert.equal(ctx.window._ORDER_FILTERS.date, '0');
  assert.equal(ctx.window._ORD_SUB, 'list');
});

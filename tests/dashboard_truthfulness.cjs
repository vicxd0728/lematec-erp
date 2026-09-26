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
  return vm.createContext({
    ROLE: role,
    ROLES: { [role]: { tabs } },
    window,
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
  assert.match(html.slice(start, html.indexOf('function renderDashboard()')), /Notion · 近30天及未結案/);
  assert.match(html.slice(start, html.indexOf('function renderDashboard()')), /Supabase · 最多5,000筆/);
  assert.doesNotMatch(dashboard, /width:75%|width:60%|width:50%/);
});

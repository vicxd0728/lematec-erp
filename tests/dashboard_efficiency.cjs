const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const start = html.indexOf('function dashboardTabAvailable(');
const end = html.indexOf('function renderDashboard()', start);
assert(start >= 0 && end > start, 'dashboard helpers exist');

function context(role, tabs = []) {
  const calls = [];
  const ctx = vm.createContext({
    ROLE: role,
    ROLES: { [role]: { tabs } },
    isViewOnly: value => value === 'viewer',
    isAdminRole: value => value === 'vic' || value === 'manager',
    switchTab: tab => calls.push(['switchTab', tab]),
    openModal: name => calls.push(['openModal', name]),
    showToast: message => calls.push(['showToast', message]),
    calls,
  });
  vm.runInContext(html.slice(start, end), ctx);
  return ctx;
}

test('dashboard creation shortcuts preserve the existing role permissions', () => {
  for (const role of ['sales', 'purchase', 'vic', 'manager']) {
    assert.equal(context(role).dashboardCanCreateOrder(), true, `${role} can create orders`);
  }
  for (const role of ['viewer', 'warehouse', 'qc']) {
    assert.equal(context(role).dashboardCanCreateOrder(), false, `${role} cannot create orders`);
  }
  for (const role of ['warehouse', 'purchase', 'vic', 'manager']) {
    assert.equal(context(role).dashboardCanCreateInbound(), true, `${role} can create inbounds`);
  }
  for (const role of ['viewer', 'sales', 'qc']) {
    assert.equal(context(role).dashboardCanCreateInbound(), false, `${role} cannot create inbounds`);
  }
});

test('dashboard shortcuts open the existing form after switching to its module', () => {
  const sales = context('sales', ['orders']);
  assert.equal(sales.dashboardOpenNewOrder(), true);
  assert.deepEqual(sales.calls, [['switchTab', 'orders'], ['openModal', 'newOrder']]);

  const warehouse = context('warehouse', ['inbound']);
  assert.equal(warehouse.dashboardOpenNewInbound(), true);
  assert.deepEqual(warehouse.calls, [['switchTab', 'inbound'], ['openModal', 'newInbound']]);

  const viewer = context('viewer', ['orders', 'inbound']);
  assert.equal(viewer.dashboardOpenNewOrder(), false);
  assert.equal(viewer.dashboardOpenNewInbound(), false);
  assert.deepEqual(viewer.calls.map(call => call[0]), ['showToast', 'showToast']);
});

test('active role navigation tab scrolls into view when it is outside the horizontal viewport', () => {
  const ctx = context('sales', ['dashboard', 'orders', 'inventory']);
  const buttons = [
    { getBoundingClientRect: () => ({ left: 20, right: 90 }) },
    { getBoundingClientRect: () => ({ left: 100, right: 180 }) },
    { getBoundingClientRect: () => ({ left: 300, right: 390 }) },
  ];
  const nav = {
    scrollLeft: 20,
    getBoundingClientRect: () => ({ left: 0, right: 320 }),
    querySelectorAll: () => buttons,
  };
  ctx.document = { getElementById: id => id === 'roleNav' ? nav : null };
  assert.equal(ctx.keepActiveNavTabVisible('inventory'), true);
  assert.equal(nav.scrollLeft, 100);

  buttons[1].getBoundingClientRect = () => ({ left: 100, right: 180 });
  nav.scrollLeft = 20;
  assert.equal(ctx.keepActiveNavTabVisible('orders'), true);
  assert.equal(nav.scrollLeft, 20);
  assert.equal(ctx.keepActiveNavTabVisible('not-a-role-tab'), false);
});

test('module create buttons and dashboard shortcuts share the same role guards', () => {
  assert.match(html, /function renderOrders\(\)[\s\S]*?const canAdd=dashboardCanCreateOrder\(\);/);
  assert.match(html, /function renderInbound\(\)[\s\S]*?const canAdd=dashboardCanCreateInbound\(\);/);
  assert.match(html, /keepActiveNavTabVisible\(tab\);\s*renderTab\(tab\);/);
  assert.match(html, /dashboardOpenNewOrder\(\)/);
  assert.match(html, /dashboardOpenNewInbound\(\)/);
});

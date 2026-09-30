const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function section(begin, finish) {
  const start = html.indexOf(begin), end = html.indexOf(finish, start);
  assert(start >= 0 && end > start);
  return html.slice(start, end);
}

test('switching to another module starts at its top', async () => {
  const content = { scrollTop: 700 };
  const ctx = vm.createContext({
    CURRENT_TAB: 'orders', ROLE: 'warehouse', ROLES: { warehouse: { tabs: ['orders', 'inbound'] } },
    document: {
      querySelectorAll: () => [],
      getElementById: id => id === 'mainContent' ? content : null,
    },
    keepActiveNavTabVisible: () => {}, renderTab: () => {},
    loadTabData: async () => {}, isEditingNow: () => false, isModalOpen: () => false,
    console, window: {},
  });
  vm.runInContext(section('function switchTab(tab){', 'function showTab(tab)'), ctx);
  ctx.switchTab('inbound');
  assert.equal(content.scrollTop, 0);
});

test('Shopee transfer shortage explains the transfer and escapes order text', () => {
  const modal = { innerHTML: '' };
  const ctx = vm.createContext({
    orders: [{ id: 'order-id', no: '<bad>', cust: '蝦皮', product: 'S-TEST', qty: 6 }],
    mats: [], _bomDataSource: 'supabase',
    document: { getElementById: id => id === 'modalInner' ? modal : null },
    resolveOrderPickPlan: () => ({
      transfer: true, production: false,
      prod: { code: 'S-TEST', name: 'S-TEST', stock: 0 },
      items: [{ id: 'material-id', code: 'TEST', name: 'TEST', stock: 0, needed: 6 }],
    }),
    escapeHtml: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
    renderPreflightCenter: () => '', openModal: () => {}, showToast: () => {},
  });
  vm.runInContext(section('function openPickModal(orderId){', '// ══ 品管檢驗單 ══'), ctx);
  ctx.openPickModal('order-id');
  assert.match(modal.innerHTML, /補足後重新整理資料，再檢查轉庫/);
  assert.doesNotMatch(modal.innerHTML, /<bad>/);
  assert.match(modal.innerHTML, /&lt;bad&gt;/);
  assert.match(modal.innerHTML, /disabled/);
});

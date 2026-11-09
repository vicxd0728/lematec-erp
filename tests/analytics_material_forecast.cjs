const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const moduleStart = html.indexOf('function analyticsRange()');
const moduleEnd = html.indexOf('function renderStockLog()', moduleStart);
assert(moduleStart > 0 && moduleEnd > moduleStart);
const script = html.slice(moduleStart, moduleEnd);
const context = vm.createContext({
  window: {},
  taipeiDateKey: value => new Date(value).toISOString().slice(0, 10),
  escapeHtml: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
});
vm.runInContext(script, context);

const end = '2026-11-09';
const isoDaysAgo = days => new Date(Date.parse(end + 'T12:00:00Z') - days * 86400000).toISOString();
const transaction = (id, days, source, delta) => ({
  material_id: id, occurred_at: isoDaysAgo(days), source_type: source,
  quantity_delta: delta, materials: {sku: 'F-TEST', name: '測試料'},
});
const report = transactions => ({
  complete: true, source: 'inventory_transactions', start: '2026-08-12', end, transactions,
});
const materials = [
  {id: 'page-a', supabaseId: 'mat-a', code: 'F-TEST', stock: 50, unit: '件'},
  {id: 'page-b', supabaseId: 'mat-b', code: 'F-TEST', stock: 20, unit: '件'},
];

test('formal material ranking excludes transfers and inbound, and keeps equal SKUs separate by material ID', () => {
  const model = context.analyticsMaterialModel(report([
    transaction('mat-a', 1, 'order_pick_batch', -5),
    transaction('mat-a', 2, 'shopee_transfer', -100),
    transaction('mat-a', 3, 'inbound_qc_pass', 100),
    transaction('mat-b', 4, 'corder_ship', -3),
    transaction('mat-a', 5, 'corder_reversal', 2),
  ]), materials, [], '30');
  assert.equal(model.rows.length, 2);
  assert.equal(model.rows[0].used, 5);
  assert.equal(model.rows[0].returned, 2);
  assert.equal(model.rows[1].used, 3);
  assert.notEqual(model.rows[0].id, model.rows[1].id);
});

test('90-day range includes older official consumption but 30-day range excludes it', () => {
  const source = report([transaction('mat-a', 40, 'manual_pick_batch', -7)]);
  assert.equal(context.analyticsMaterialModel(source, materials, [], '30').rows.length, 0);
  assert.equal(context.analyticsMaterialModel(source, materials, [], '90').rows[0].used, 7);
});

test('forecast requires observations in both windows and keeps open demand separate', () => {
  const source = report([
    transaction('mat-a', 1, 'order_pick_batch', -14),
    transaction('mat-a', 8, 'order_pick_batch', -14),
    transaction('mat-a', 29, 'corder_ship', -14),
    transaction('mat-a', 36, 'corder_ship', -14),
    transaction('mat-b', 1, 'corder_ship', -8),
  ]);
  const model = context.analyticsMaterialModel(source, materials, [{id: 'page-a', needed: 11}], '30');
  assert.equal(model.rows[0].forecast, 30);
  assert.equal(model.rows[0].openDemand, 11);
  assert.equal(model.rows[1].forecast, null);
  assert.equal(model.rows[1].confidence, '資料不足');
});

test('incomplete official report cannot produce a ranking or forecast', () => {
  assert.equal(context.analyticsMaterialModel({...report([]), complete: false}, materials), null);
  assert.equal(context.analyticsMaterialModel({...report([]), source: 'stock_log'}, materials), null);
});

test('formal loader rejects an incomplete report instead of showing stale ranking', async () => {
  context.todayStr = () => end;
  context.PROXY = 'https://example.invalid';
  context.URLSearchParams = URLSearchParams;
  context.erpWorkerHeaders = () => ({'X-ERP-Role': 'viewer'});
  context.fetch = async () => ({ok: true, status: 200, json: async () => ({...report([]), complete: false})});
  await assert.rejects(context.loadAnalyticsFormalMovements({force: true}), /正式交易讀取失敗/);
  assert.equal(context.window._analyticsFormal, undefined);
});

test('material panel gives mobile a visible forecast card', () => {
  const model = context.analyticsMaterialModel(report([
    transaction('mat-a', 1, 'order_pick_batch', -5),
  ]), materials, [], '30');
  const panel = context.analyticsMaterialPanel(model);
  assert.match(panel, /analytics-material-mobile/);
  assert.match(panel, /未來 30 天試算/);
  assert.match(panel, /資料不足/);
});

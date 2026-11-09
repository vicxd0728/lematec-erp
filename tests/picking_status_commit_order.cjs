const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('cloudflare-worker-green-wave-c22f-FULL-UPDATED.js', 'utf8');
const section = source.slice(source.indexOf('async function erpPickingStatus('), source.indexOf('async function erpPickingLinkNotion('));

function harness(source = '') {
  const master = { id: 'pick-1', status: '待領料', picked_at: '', source,
    pick_number: 'PK-ONE', source_order_notion_page_id: 'order-1' };
  const details = new Map([['item-1', 0], ['item-2', 0]]);
  const ledger = [];
  const ledgerPaths = [];
  const calls = [];
  let failItem = '', failMaster = false, emptyItem = '';
  const context = vm.createContext({
    Response, Request, JSON, Set, Array, Number, Object, encodeURIComponent,
    cleanText: value => String(value || '').trim(),
    taipeiISOString: () => '2026-11-09T12:00:00+08:00',
    jh: () => ({ 'Content-Type': 'application/json' }),
    resp400: (_, error) => new Response(JSON.stringify({ error }), { status: 400 }),
    resp500: (_, error) => new Response(JSON.stringify({ error }), { status: 500 }),
    respOK: (_, value) => new Response(JSON.stringify(value)),
    supabaseSingle: async () => ({ ...master }),
    getSupabaseInventoryContext: async () => ({ organization: { id: 'org-1' } }),
    supabaseAll: async (_, path) => path.includes('/inventory_transactions?') ? (ledgerPaths.push(path), ledger) : [
      { id: 'item-1', material_id: 'part-1', required_quantity: 2 },
      { id: 'item-2', material_id: 'part-2', required_quantity: 3 },
    ],
    supabaseFetch: async (_, path, options) => {
      const item = path.match(/pick_items\?id=eq\.([^&]+)/)?.[1];
      if (item) {
        calls.push('item:' + item);
        if (item === failItem) throw Error('detail write failed');
        if (item === emptyItem) return [];
        details.set(item, JSON.parse(options.body).picked_quantity);
        return [{ id: item }];
      }
      if (!path.includes('/pick_lists?')) throw Error('unexpected path');
      calls.push('master');
      if (failMaster) throw Error('master write failed');
      Object.assign(master, JSON.parse(options.body));
      return [{ ...master }];
    },
  });
  vm.runInContext(section, context);
  const run = async (items = [
    { id: 'item-1', picked_quantity: 2, status: '足夠' },
    { id: 'item-2', picked_quantity: 3, status: '足夠' },
  ]) => {
    const response = await context.erpPickingStatus(new Request('https://offline.invalid/api/picking/status', {
      method: 'POST',
      body: JSON.stringify({ pick_id: master.id, status: '已領料', items }),
    }), {}, {});
    return { status: response.status, body: await response.json() };
  };
  return { master, details, ledger, ledgerPaths, calls, run,
    failItem: value => { failItem = value; },
    failMaster: value => { failMaster = value; },
    emptyItem: value => { emptyItem = value; },
  };
}

test('detail write failure leaves master pending and same request can resume', async () => {
  const h = harness();
  h.failItem('item-2');
  assert.equal((await h.run()).status, 500);
  assert.equal(h.master.status, '待領料');
  assert.equal(h.details.get('item-1'), 2);
  assert.equal(h.details.get('item-2'), 0);
  assert.deepEqual(h.calls, ['item:item-1', 'item:item-2']);
  h.failItem('');
  assert.equal((await h.run()).status, 200);
  assert.equal(h.master.status, '已領料');
  assert.equal(h.details.get('item-2'), 3);
  assert.deepEqual(h.calls.slice(-3), ['item:item-1', 'item:item-2', 'master']);
});

test('empty detail PATCH does not silently complete master', async () => {
  const h = harness();
  h.emptyItem('item-1');
  assert.equal((await h.run()).status, 500);
  assert.equal(h.master.status, '待領料');
  assert.deepEqual(h.calls, ['item:item-1']);
});

test('incomplete or altered detail set cannot mark master picked', async () => {
  const h = harness();
  assert.equal((await h.run([{ id: 'item-1', picked_quantity: 2 }])).status, 409);
  assert.equal((await h.run([
    { id: 'item-1', picked_quantity: 2 },
    { id: 'item-2', picked_quantity: 1 },
  ])).status, 409);
  assert.equal(h.master.status, '待領料');
  assert.deepEqual(h.calls, []);
});

test('master failure leaves retryable details and no completed master', async () => {
  const h = harness();
  h.failMaster(true);
  assert.equal((await h.run()).status, 500);
  assert.equal(h.master.status, '待領料');
  assert.equal(h.details.get('item-1'), 2);
  assert.equal(h.details.get('item-2'), 3);
  h.failMaster(false);
  assert.equal((await h.run()).status, 200);
  assert.equal(h.master.status, '已領料');
});

test('new picking cannot complete without exact original stock transactions', async () => {
  const h = harness('ERP_ORDER');
  assert.equal((await h.run()).status, 409);
  assert.deepEqual(h.calls, []);
  h.ledger.push({ id: 'tx-1', material_id: 'part-1', quantity_delta: -2 });
  assert.equal((await h.run()).status, 409);
  h.ledger.push({ id: 'tx-2', material_id: 'part-2', quantity_delta: -2 });
  assert.equal((await h.run()).status, 409);
  h.ledger[1].quantity_delta = -3;
  assert.equal((await h.run()).status, 200);
  assert.equal(h.master.status, '已領料');
  assert.match(h.ledgerPaths[0], /source_id=eq\.order-1/);
  assert.match(h.ledgerPaths[0], /source_number=eq\.PK-ONE/);
  assert.match(h.ledgerPaths[0], /source_type=eq\.order_pick_batch/);
});

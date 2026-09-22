// Offline behavioral checks: execute the actual Worker authorization functions.
// No real token, network request, or production mutation is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'cloudflare-worker-green-wave-c22f-FULL-UPDATED.js'), 'utf8');
const board = source.slice(source.indexOf('const BOARD_DB ='), source.indexOf('async function erpBoardSummary'));
const auth = source.slice(source.indexOf('const ERP_AUTH_REQUEST_CACHE'), source.indexOf('function normalizeMirrorJob'));

function harness(responder) {
  const calls = [];
  const context = vm.createContext({
    Request, Response,
    cleanText: value => String(value || '').trim(),
    jh: cors => ({ ...cors, 'Content-Type': 'application/json' }),
    fetch: async (url, options) => {
      calls.push({ url, options });
      return responder ? responder(url, options) : Response.json({ object: 'database', id: context.databaseId });
    },
  });
  vm.runInContext(board + auth + '\nthis.databaseId = BOARD_DB.materials; this.matrix = ERP_ROUTE_ROLES;', context);
  return { context, calls };
}

function request(role, token = 'company-test-token', method = 'POST') {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (role) headers['X-ERP-Role'] = role;
  return new Request('https://offline.invalid/api/inventory/adjust', { method, headers });
}

const env = { NOTION_TOKEN: 'company-test-token' };

test('Shopee transfers require warehouse, purchase or administrators',async()=>{
 const {context:c}=harness();
 for(const role of ['warehouse','purchase'])assert.equal(await c.enforceErpRouteRole(request(role),env,{},'/api/shopee/transfer','POST'),null);
 for(const role of ['sales','viewer','qc'])assert.equal((await c.enforceErpRouteRole(request(role),env,{},'/api/shopee/transfer','POST')).status,403);
});

test('purchase operational access covers orders, stock, picking and inbound without admin maintenance', async () => {
  const {context:c}=harness();
  for(const route of ['/api/orders/create','/api/inventory/sync','/api/inventory/adjust','/api/inventory/adjust-batch','/api/inventory/bom/upsert','/api/picking/create','/api/picking/status','/api/picking/return-request','/api/inbound/create']) {
    assert.equal(await c.enforceErpRouteRole(request('purchase'),env,{},route,'POST'),null,route);
    assert.equal((await c.enforceErpRouteRole(request('viewer'),env,{},route,'POST')).status,403,route);
  }
  for(const route of ['/api/picking/migrate','/api/inventory/material/archive','/api/corder/number-set']) {
    assert.equal((await c.enforceErpRouteRole(request('purchase'),env,{},route,'POST')).status,403,route);
  }
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const ui=vm.createContext({ROLE:'purchase',isAdminRole:()=>false});
  vm.runInContext(html.slice(html.indexOf('function canCompleteShipmentRole('),html.indexOf('function isShopeeProductionOrder('))+html.slice(html.indexOf('function canConfirmOrderReturnRequest('),html.indexOf('function orderReturnRequestActionFromPick(')),ui);
  assert.equal(ui.canCompleteShipmentRole(),true);
  assert.equal(ui.canProductionToQcRole(),true);
  assert.equal(ui.canConfirmOrderReturnRequest(),true);
  assert.equal(ui.canQcToShipRole(),false);
  const ordersUI=html.slice(html.indexOf('function _renderOrdersList('),html.indexOf('function renderCustomers('));
  assert.match(ordersUI,/const canAdd=.*ROLE==='purchase'/);
  const stockUI=html.slice(html.indexOf('const canEditStock='),html.indexOf('const canEditStock=')+300);
  assert.match(stockUI,/const canEditStock=.*ROLE==='purchase'/);
  assert.match(stockUI,/const canEditMat=.*ROLE==='purchase'/);
});

test('sales can request returns but cannot use unrestricted picking status', async () => {
  const { context: c } = harness();
  assert.equal(await c.enforceErpRouteRole(request('sales'), env, {}, '/api/picking/return-request', 'POST'), null);
  assert.equal((await c.enforceErpRouteRole(request('sales'), env, {}, '/api/picking/status', 'POST')).status, 403);
  for (const role of ['viewer', 'qc', 'unknown']) {
    assert.equal((await c.enforceErpRouteRole(request(role), env, {}, '/api/picking/return-request', 'POST')).status, 403);
  }
});

test('assembly completion requires QC or administrators; staff cannot bypass release', async () => {
  const {context:c}=harness();
  for(const role of ['qc','vic','manager'])assert.equal(await c.enforceErpRouteRole(request(role),env,{},'/api/assembly/complete','POST'),null);
  for(const role of ['sales','warehouse','purchase','viewer'])assert.equal((await c.enforceErpRouteRole(request(role),env,{},'/api/assembly/complete','POST')).status,403);
});

function returnHarness(status, raced = false) {
  const { context: c } = harness();
  const writes = [];
  const id = '11111111-1111-1111-1111-111111111111';
  c.supabaseSingle = async () => ({id, status, notes:'original'});
  c.supabaseFetch = async (env, path, options) => {
    writes.push({path, patch:JSON.parse(options.body)});
    return raced ? [] : [{id, ...JSON.parse(options.body)}];
  };
  c.taipeiISOString = () => '2026-09-21T00:00:00+08:00';
  c.respOK = (cors, data) => Response.json(data);
  c.resp400 = (cors, error) => Response.json({error}, {status:400});
  c.resp500 = (cors, error) => Response.json({error}, {status:500});
  vm.runInContext(source.slice(source.indexOf('async function erpPickingReturnRequest('), source.indexOf('async function erpPickingStatus(')), c);
  const run = extra => c.erpPickingReturnRequest(new Request('https://offline.invalid/api/picking/return-request', {
    method:'POST', body:JSON.stringify({pick_id:id, notes:'return requested', ...extra}),
  }), env, {});
  return {run, writes};
}

test('sales UI uses request-only route and updates state and mirror only after acceptance', async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const code = html.slice(html.indexOf('async function submitOrderReturnRequest('), html.indexOf('function openOrderPickingReversalAssist('));
  for (const failed of [true, false]) {
    const pick = {id:'pick', supabaseId:'pick', notionId:'mirror', status:'已領料', note:'original', items:[{id:'item', pickedQty:3, status:'足夠'}]};
    const calls = [], mirrors = [];
    const c = vm.createContext({
      ROLE:'sales', ORDER_RETURN_REQUEST_STATUS:'待回料確認',
      denyViewOnlyAction:()=>false, orderActivePickingRecords:()=>[pick], completedOrderPickingRows:rows=>rows,
      confirm:()=>true, closeModal:()=>{}, showToast:()=>{}, logUserAction:()=>{}, refreshAffectedData:async()=>{},
      orderReturnRequestNote:()=> 'new request',
      pickingWorkerRequest:async(route, options)=>{
        calls.push({route, body:options.body});
        assert.equal(pick.note, 'original');
        assert.equal(pick.status, '已領料');
        if (failed) throw new Error('denied');
        return {row:{notes:'server accepted note'}};
      },
      updateWorkflowPageAfterInventory:async(...args)=>mirrors.push(args),
    });
    vm.runInContext(code, c);
    await c.submitOrderReturnRequest('order', 'ORD-test', '刪除訂單');
    assert.equal(calls[0].route, '/api/picking/return-request');
    assert.deepEqual(Object.keys(calls[0].body).sort(), ['notes','pick_id']);
    assert.equal(pick.status, failed ? '已領料' : '待回料確認');
    assert.equal(pick.note, failed ? 'original' : 'server accepted note');
    assert.equal(mirrors.length, failed ? 0 : 1);
    assert.equal(pick.items[0].pickedQty, 3);
    assert.equal(pick.items[0].status, '足夠');
  }
});

test('return request changes only master status and notes, preserving all inventory and item quantities', async () => {
  for (const status of ['已領料', '已確認扣料']) {
    const {run, writes} = returnHarness(status);
    assert.equal((await run()).status, 200);
    assert.equal(writes.length, 1);
    assert.match(writes[0].path, /^\/rest\/v1\/pick_lists\?/);
    assert.ok(writes[0].path.includes(`&status=eq.${encodeURIComponent(status)}`));
    assert.deepEqual(Object.keys(writes[0].patch).sort(), ['notes','status','updated_at']);
    assert.equal(writes[0].patch.status, '待回料確認');
  }
});

test('retries preserve original request and cannot reopen incomplete or reversed picks', async () => {
  const retry = returnHarness('待回料確認');
  const result = await (await retry.run()).json();
  assert.equal(result.already_requested, true);
  assert.equal(result.row.notes, 'original');
  assert.equal(retry.writes.length, 0);
  for (const status of ['待領料','待確認','缺料待補','已沖銷','已退料','取消']) {
    const h = returnHarness(status);
    assert.equal((await h.run()).status, 409);
    assert.equal(h.writes.length, 0);
  }
  assert.equal((await returnHarness('已領料', true).run()).status, 409);
});

test('return request rejects attempts to set status, quantities, items or picker', async () => {
  for (const extra of [{status:'已沖銷'}, {items:[{picked_quantity:999}]}, {picked_quantity:999}, {picker_display:'vic'}, {pick_id:'invalid'}]) {
    const h = returnHarness('已領料');
    assert.equal((await h.run(extra)).status, 400);
    assert.equal(h.writes.length, 0);
  }
});

test('existing token and all allowed role/route combinations still pass', async () => {
  const { context: c } = harness();
  for (const [route, roles] of Object.entries(c.matrix)) {
    for (const role of roles) {
      assert.equal(await c.enforceErpRouteRole(request(role), env, {}, route, 'POST'), null, `${role}: ${route}`);
    }
  }
});

test('a valid unrelated Notion token without company database access is rejected', async () => {
  const { context: c, calls } = harness(url => url.endsWith('/users/me')
    ? Response.json({ object: 'user' })
    : Response.json({ object: 'error' }, { status: 404 }));
  const denied = await c.enforceErpRouteRole(request('vic', 'unrelated-test-token'), env, {}, '/api/inventory/adjust', 'POST');
  assert.equal(denied.status, 401);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://api.notion.com/v1/databases/${c.databaseId}`);
});

test('HTTP 200 alone, a wrong database, invalid JSON and network failure all fail closed', async () => {
  const replies = [
    () => Response.json({ object: 'user' }),
    () => Response.json({ object: 'database', id: 'another-database' }),
    () => new Response('not JSON'),
    () => { throw new Error('offline'); },
    () => Response.json({ object: 'error' }, { status: 429 }),
  ];
  for (const reply of replies) {
    const { context: c } = harness(reply);
    assert.equal(await c.erpClientAuthorized(request('warehouse')), false);
  }
});

test('the existing database id is accepted with or without hyphens', async () => {
  const { context: c } = harness(() => Response.json({ object: 'database', id: c.databaseId.replace(/-/g, '').toUpperCase() }));
  assert.equal(await c.erpClientAuthorized(request('sales')), true);
});

test('an authorized alternative integration cannot claim the system role', async () => {
  const { context: c } = harness();
  const denied = await c.enforceErpRouteRole(request('system', 'other-company-integration'), env, {}, '/api/inventory/adjust', 'POST');
  assert.equal(denied.status, 403);
  // Access to the same company DB preserves normal selected-role operation.
  assert.equal(await c.enforceErpRouteRole(request('sales', 'other-company-integration'), env, {}, '/api/inventory/adjust', 'POST'), null);
});

test('existing configured-token automation works with an omitted or explicit system role', async () => {
  const { context: c } = harness();
  for (const role of ['', 'system']) {
    assert.equal(await c.enforceErpRouteRole(request(role), env, {}, '/api/inventory/adjust', 'POST'), null);
    assert.equal(await c.enforceErpRouteRole(request(role), { ERP_NOTION_TOKEN: env.NOTION_TOKEN }, {}, '/api/inventory/adjust', 'POST'), null);
  }
});

test('missing server token cannot grant system rights', async () => {
  const { context: c } = harness();
  for (const role of ['', 'system']) {
    assert.equal((await c.enforceErpRouteRole(request(role), {}, {}, '/api/inventory/adjust', 'POST')).status, 403);
  }
});

test('viewer, unknown role and disallowed staff role stay blocked even with the shared token', async () => {
  const { context: c } = harness();
  for (const role of ['viewer', 'unknown', 'qc']) {
    assert.equal((await c.enforceErpRouteRole(request(role), env, {}, '/api/inventory/adjust', 'POST')).status, 403);
  }
});

test('missing credentials fail without a Notion request', async () => {
  const { context: c, calls } = harness();
  assert.equal((await c.enforceErpRouteRole(request('vic', ''), env, {}, '/api/inventory/adjust', 'POST')).status, 401);
  assert.equal(calls.length, 0);
});

test('concurrent authorization on one request shares a single company read', async () => {
  const { context: c, calls } = harness();
  const req = request('vic');
  const results = await Promise.all([c.erpClientAuthorized(req), c.erpClientAuthorized(req)]);
  assert.deepEqual(results, [true, true]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers['Notion-Version'], '2022-06-28');
  assert.equal(calls[0].options.method, undefined); // GET, never a write.
});

test('public GET role gate remains unchanged', async () => {
  const { context: c, calls } = harness();
  assert.equal(await c.enforceErpRouteRole(request('', '', 'GET'), env, {}, '/api/inventory/list', 'GET'), null);
  assert.equal(calls.length, 0);
});

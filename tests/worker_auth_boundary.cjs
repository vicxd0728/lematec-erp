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

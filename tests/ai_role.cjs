const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'cloudflare-worker-green-wave-c22f-FULL-UPDATED.js'), 'utf8');

test('AI can see every module while remaining view-only outside Notes', () => {
  const ctx = vm.createContext({ROLE: 'ai', showToast() {}});
  vm.runInContext(html.slice(html.indexOf('const ROLES='), html.indexOf('const PILL=')), ctx);
  const all = vm.runInContext('ROLES.vic.tabs', ctx);
  const ai = vm.runInContext('ROLES.ai.tabs', ctx);
  assert.deepEqual([...ai], [...all]);
  assert.equal(ctx.isViewOnly(), true);
  assert.equal(ctx.canWriteNotes(), true);
  assert.equal(ctx.canWriteNotes('viewer'), false);
  assert.equal(ctx.canImportBomRole(), false);
  assert.match(html, /\.view-only-role\.ai-role \.notion-bar::after\{content:'AI：僅記事可編輯'/);
});

test('AI Worker mutation scope accepts only actual Notes resources', async () => {
  const noteDb = '11111111-1111-4111-8111-111111111111';
  const note = '22222222-2222-4222-8222-222222222222';
  const order = '33333333-3333-4333-8333-333333333333';
  const responses = {
    [`databases/${noteDb}`]: {title: [{plain_text: 'ERP 記事行事曆'}], parent: {page_id: 'b60823b3-452c-467b-a2f9-dc54f3799464'}},
    [`pages/${note}`]: {parent: {database_id: noteDb}, properties: {}},
    [`pages/${order}`]: {parent: {database_id: '50b7ce68-437e-431f-9a4f-a0d0d65a7b25'}, properties: {}},
  };
  const ctx = vm.createContext({
    canonicalNotionId: value => String(value || '').replace(/-/g, '').toLowerCase(),
    fetch: async url => {
      const key = String(url).split('/v1/')[1];
      return responses[key] ? {ok: true, json: async () => responses[key]} : {ok: false};
    },
  });
  vm.runInContext(worker.slice(worker.indexOf('async function aiNotionRead'), worker.indexOf('const ERP_ROUTE_ROLES')), ctx);
  const allowed = ctx.aiNoteProxyMutationAllowed;
  assert.equal(await allowed('POST', 'pages', {parent: {database_id: noteDb}, properties: {}}, 'notes', 'token'), true);
  assert.equal(await allowed('PATCH', `pages/${note}`, {properties: {標題: {title: []}}}, 'notes', 'token'), true);
  assert.equal(await allowed('PATCH', `blocks/${note}/children`, {children: [{type: 'paragraph'}]}, 'notes', 'token'), true);
  assert.equal(await allowed('POST', 'pages', {parent: {database_id: noteDb}, properties: {}}, '', 'token'), false);
  assert.equal(await allowed('PATCH', `pages/${order}`, {properties: {}}, 'notes', 'token'), false);
  assert.equal(await allowed('PATCH', `blocks/${order}/children`, {children: [{type: 'paragraph'}]}, 'notes', 'token'), false);
  assert.equal(await allowed('PATCH', `databases/${noteDb}`, {properties: {}}, 'notes', 'token'), false);
  assert.equal(await allowed('DELETE', `pages/${note}`, {archived: true}, 'notes', 'token'), false);
});

test('AI route matrix grants Notes and denies stock, orders, picking, QC', () => {
  const matrix = worker.slice(worker.indexOf('const ERP_ROUTE_ROLES'), worker.indexOf('function erpBearerToken'));
  const ctx = vm.createContext({});
  vm.runInContext(matrix + '\nthis.roles = ERP_ROUTE_ROLES;', ctx);
  for (const route of ['/api/notes/write', '/api/notes/shadow/sync', '/api/notes/shadow/delete']) {
    assert.equal(ctx.roles[route].includes('ai'), true, route);
  }
  for (const route of ['/api/inventory/adjust', '/api/orders/create', '/api/picking/create', '/api/inbound/action', '/api/shopee/transfer']) {
    assert.equal(ctx.roles[route].includes('ai'), false, route);
  }
});

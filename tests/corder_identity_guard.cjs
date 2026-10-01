const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const guard = html.slice(html.indexOf('async function assertCorderInternalNoForIdentity('),
                         html.indexOf('async function corderInternalNoExists('));

function setup(result) {
  const queries = [];
  const ctx = vm.createContext({
    DB: {corders: 'corders-db'},
    notionAPI: async (...args) => { queries.push(args); return result; },
    getRichText: (props, name) => props[name]?.rich_text?.[0]?.plain_text || '',
  });
  vm.runInContext(guard, ctx);
  return {ctx, queries};
}

function row(shopee, buyer) {
  return {properties: {
    '蝦皮訂單號碼': {rich_text: [{plain_text: shopee}]},
    '買家帳號': {rich_text: [{plain_text: buyer}]},
  }};
}

test('new internal number passes the live exact-number query', async () => {
  const {ctx, queries} = setup({results: [], has_more: false});
  assert.equal(await ctx.assertCorderInternalNoForIdentity('SHPTW20000', 'SHOP1', 'BUYER1'), 0);
  assert.equal(queries[0][2].filter.title.equals, 'SHPTW20000');
});

test('multiple products of the same Shopee order may share the internal number', async () => {
  const {ctx} = setup({results: [row('SHOP1', 'BUYER1'), row('SHOP1', 'BUYER1')], has_more: false});
  assert.equal(await ctx.assertCorderInternalNoForIdentity('SHPTW20000', 'SHOP1', 'BUYER1'), 2);
});

test('different Shopee identity or incomplete query blocks before stock deduction', async () => {
  for (const response of [
    {results: [row('SHOP2', 'BUYER2')], has_more: false},
    {results: [row('SHOP1', 'BUYER1')], has_more: true},
    {object: 'error', message: 'unavailable'},
  ]) {
    const {ctx} = setup(response);
    await assert.rejects(ctx.assertCorderInternalNoForIdentity('SHPTW20000', 'SHOP1', 'BUYER1'));
  }
  const submit = html.slice(html.indexOf('async function submitCorder('), html.indexOf('function buildCorderImportPreflight('));
  assert(submit.indexOf('await assertCorderInternalNoForIdentity(') < submit.indexOf("notionAPI('POST','pages'"));
  assert(submit.indexOf('await assertCorderInternalNoForIdentity(') < submit.indexOf('deductCorderStockByBom('));
});

const stockGuard = html.slice(html.indexOf('function normalizeNotionIdForCompare('),
                              html.indexOf('async function corderInternalNoExists('));
function stockSetup(response) {
  const ctx = vm.createContext({
    DB: {corders: 'corders-db'},
    notionAPI: async () => response,
    getRichText: (props, name) => props[name]?.rich_text?.[0]?.plain_text || '',
    getTitle: (props, name) => props[name]?.title?.[0]?.plain_text || '',
    parseCorderStockRefs: raw => raw ? [{id: 'stock-1', qty: 1}] : [],
  });
  vm.runInContext(stockGuard, ctx);
  return ctx;
}
function stockRow(id, shopee, buyer) {
  return {id, properties: {
    '蝦皮訂單號碼': {rich_text: [{plain_text: shopee}]},
    '買家帳號': {rich_text: [{plain_text: buyer}]},
  }};
}
const stockOrder = {id: 'order-1', no: 'SHPTW16283', shopeeNo: 'SHOP1', buyer: 'BUYER1', qty: 1, matId: 'stock-1'};

test('historical internal-number collision blocks stock-changing actions', async () => {
  const ctx = stockSetup({results: [stockRow('order-1', 'SHOP1', 'BUYER1'), stockRow('order-2', 'SHOP2', 'BUYER2')], has_more: false});
  await assert.rejects(ctx.assertCorderStockActionIdentity(stockOrder), /不同蝦皮單號或買家/);
  const cancel = html.slice(html.indexOf('async function openCorderCancelDeleteFlow('), html.indexOf('async function syncToDomesticTrade115('));
  const returns = html.slice(html.indexOf('async function submitReturnCorder('), html.indexOf('function openEditCorder('));
  assert.equal((cancel.match(/await assertCorderStockActionIdentity\(o\)/g)||[]).length, 2);
  assert(returns.indexOf('await assertCorderStockActionIdentity(o)') < returns.indexOf('await returnCorderStock('));
});

test('same Shopee order with several products can return each saved deduction', async () => {
  const response = {results: [stockRow('order-1', 'SHOP1', 'BUYER1'), stockRow('order-2', 'SHOP1', 'BUYER1')], has_more: false};
  assert.equal(await stockSetup(response).assertCorderStockActionIdentity(stockOrder), 2);
  await assert.rejects(stockSetup(response).assertCorderStockActionIdentity({...stockOrder, matId: ''}), /缺少本筆原始扣料清單/);
});

test('stale or incomplete identity read blocks refund', async () => {
  for (const response of [
    {results: [], has_more: false},
    {results: [stockRow('order-1', 'SHOP1', 'BUYER1')], has_more: true},
    {object: 'error'},
  ]) await assert.rejects(stockSetup(response).assertCorderStockActionIdentity(stockOrder));
});

test('stock audit fetch keeps order and return references but excludes similar numbers', async () => {
  const code = html.slice(html.indexOf('async function fetchCorderStockAuditRows('), html.indexOf('function buildCorderInventoryOutstandingRows('));
  const urls = [];
  const ctx = vm.createContext({
    PROXY: 'https://worker.example',
    fetch: async url => { urls.push(url); return {ok: true, json: async () => ({rows: [
      {ref_no: 'SHPTW16283'}, {ref_no: 'SHPTW16283-RET-0-1'}, {ref_no: 'SHPTW162830'},
    ], has_more: false})}; },
  });
  vm.runInContext(code, ctx);
  assert.equal((await ctx.fetchCorderStockAuditRows('SHPTW16283')).length, 2);
  assert(urls[0].includes('ref_prefix=SHPTW16283'));
});

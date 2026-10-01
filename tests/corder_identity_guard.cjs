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

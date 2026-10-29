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
    notionAPI: async (...args) => {
      queries.push(args);
      if(args[0]==='GET'){
        const own=result.createdPage||result.results?.find(p=>p.id===args[1].slice(6));
        return own?{...own,parent:own.parent||{database_id:'corders-db'},properties:{'訂單號碼':{title:[{plain_text:'BUSTW15-180-1'}]},...own.properties}}:{object:'error'};
      }
      return result;
    },
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

test('a newly staged manual page verifies itself with optional platform or buyer blank', async () => {
  for(const [shop,buyer] of [['','公司客戶'],['SHOP1',''],['','']]){
    const page={...row(shop,buyer),id:'new-page'};
    const {ctx}=setup({results:[page],has_more:false});
    assert.equal(await ctx.assertCorderInternalNoForIdentity('BUSTW15-180-1',shop,buyer,'new-page'),1);
    // A fresh submit is not allowed to reuse that page's number just because fields are empty.
    await assert.rejects(ctx.assertCorderInternalNoForIdentity('BUSTW15-180-1',shop,buyer),/已有訂單紀錄/);
  }
});

test('self exemption never skips another page, missing self, changed identity or incomplete read',async()=>{
  const own={...row('','公司客戶'),id:'new-page'};
  for(const result of [
    {results:[own,{...row('','公司客戶'),id:'other-page'}],has_more:false},
    {results:[],has_more:false},
    {results:[{...row('SHOP2','公司客戶'),id:'new-page'}],has_more:false},
    {results:[own],has_more:true},
  ])await assert.rejects(setup(result).ctx.assertCorderInternalNoForIdentity('BUSTW15-180-1','','公司客戶','new-page'));
});

test('direct page read verifies the new page even before database query indexes it',async()=>{
  const p={...row('','公司客戶'),id:'new-page'};
  assert.equal(await setup({results:[],createdPage:p,has_more:false}).ctx.assertCorderInternalNoForIdentity('BUSTW15-180-1','','公司客戶','new-page'),0);
  for(const bad of [{...p,archived:true},{...p,id:'wrong'},{...p,parent:{database_id:'wrong-db'}}])
    await assert.rejects(setup({results:[],createdPage:bad,has_more:false}).ctx.assertCorderInternalNoForIdentity('BUSTW15-180-1','','公司客戶','new-page'));
});

test('collision describes the original order and both creation paths pass their exact staged ID',async()=>{
  const p={...row('','摩根精密機械有限公司'),id:'existing'};
  p.properties['品名']={rich_text:[{plain_text:'S-LEI-17-1'}]};
  p.properties['數量']={number:5};p.properties['狀態']={select:{name:'已完成'}};
  await assert.rejects(setup({results:[p],has_more:false}).ctx.assertCorderInternalNoForIdentity('BUSTW15-180-1','','公司客戶'),/S-LEI-17-1 × 5／已完成/);
  assert(html.includes('assertCorderInternalNoForIdentity(orderNo,shopeeNo,buyer,stagedOrder.id,mat.code||mat.name)'));
  assert(html.includes('assertCorderInternalNoForIdentity(item.no,item.shopeeNo,item.buyer,stagedOrder.id,item.sku)'));
});

test('actual manual submit with blank platform creates and deducts once; retry stops before a second page or deduction',async()=>{
  const pages=[],messages=[];let deductions=0,archives=0;
  const values={co_no:'BUSTW15-180-1',co_shopee_no:'',co_buyer:'公司客戶',co_mat:'mat-1',co_qty:'5'};
  const ctx=vm.createContext({
    DB:{corders:'corders-db'},ROLE:'sales',mats:[{id:'mat-1',code:'S-LEI-17-1'}],
    document:{getElementById:id=>({value:values[id]||'',style:{}})},
    corderExistingNoByShopeeAndBuyer:()=>'',loadCoreEssentials:async()=>{},
    resolveCorderShipPlan:()=>({items:[{stock:100,needed:5}],refs:[{id:'mat-1',qty:5}]}),
    corderStockRefs:()=> 'mat-1:5',getRichText:(p,k)=>p[k]?.rich_text?.[0]?.text?.content||'',
    notionAPI:async(method,endpoint,body)=>{
      if(endpoint.endsWith('/query'))return {results:pages,has_more:false};
      if(method==='GET')return pages.find(p=>p.id===endpoint.slice(6));
      assert.equal(endpoint,'pages');const p={id:'new-page',parent:{database_id:'corders-db'},properties:body.properties};pages.push(p);return p;
    },
    requestCorderResume:async()=>{deductions++;return {duplicate:false};},
    updateWorkflowPageAfterInventory:async()=>({pending:false}),archiveNotionPageQuietly:async id=>{if(id)archives++;},
    setCorderNextSerial:async()=>{},corderSerial:()=>0,refreshAffectedData:async()=>{},renderTab:()=>{},
    closeModal:()=>{},showToast:message=>messages.push(message),console,
  });
  vm.runInContext('let CORDER_SUBMIT_BUSY=false;'+guard+html.slice(html.indexOf('async function submitCorder('),html.indexOf('function buildCorderImportPreflight(')),ctx);
  await ctx.submitCorder();assert.equal(pages.length,1);assert.equal(deductions,1);assert.equal(archives,0);
  await ctx.submitCorder();assert.equal(pages.length,1);assert.equal(deductions,1);assert.equal(archives,0);
  assert.match(messages.at(-1),/已有原訂單/);
});

test('same full platform identity cannot recreate the same product, while a different product remains allowed',async()=>{
  const p={...row('SHOP1','BUYER1'),id:'existing'};
  p.properties['品名']={rich_text:[{plain_text:'S-LEI-17-1'}]};p.properties['狀態']={select:{name:'已完成'}};
  const {ctx}=setup({results:[p],has_more:false});
  await assert.rejects(ctx.assertCorderInternalNoForIdentity('SHPTW20000','SHOP1','BUYER1','','s-lei-17-1'),/已有原訂單/);
  assert.equal(await ctx.assertCorderInternalNoForIdentity('SHPTW20000','SHOP1','BUYER1','','S-OTHER'),1);
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
  assert(submit.indexOf('await assertCorderInternalNoForIdentity(') < submit.indexOf('await requestCorderResume('));
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
  const cancel = html.slice(html.indexOf('async function openCorderCancelDeleteFlow('), html.indexOf('async function cancelCorder('));
  const returns = html.slice(html.indexOf('async function submitReturnCorder('), html.indexOf('function openEditCorder('));
  assert.equal((cancel.match(/await assertCorderStockActionIdentity\(o\)/g)||[]).length, 2);
  assert(returns.indexOf('await assertCorderStockActionIdentity(o)') < returns.indexOf('await executeCorderReversal('));
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

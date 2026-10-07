const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function productCandidates(q=');
const end=html.indexOf('function onProductSelectChange(){',start);
assert(start>=0&&end>start);

function setup(){
  const fields=Object.fromEntries(['productSearchMsg','productSearchResults','m_product','m_product_search']
    .map(id=>[id,{value:'',innerHTML:'',style:{}}]));
  const mats=[
    {id:'part',code:'Y-FLT-D-07',name:'Y-FLT-D-07',type:'零件',stock:986.86},
    {id:'part-1',code:'Y-FLT-D-07-1',name:'Y-FLT-D-07-1',type:'零件',stock:5000},
    {id:'finished',code:'Z-FLT-E-02',name:'Z-FLT-E-02',type:'成品',stock:5},
  ];
  const ctx=vm.createContext({mats,document:{getElementById:id=>fields[id]||null},
    normalizeSku:x=>String(x||'').trim().toUpperCase(),
    materialReferenceKeys:m=>new Set([String(m.code||'').toUpperCase(),String(m.name||'').toUpperCase()]),
    escapeHtml:x=>String(x)});
  vm.runInContext(html.slice(start,end),ctx);
  return {ctx,fields,mats};
}

test('foreign and domestic order selector includes stocked parts alongside finished goods',()=>{
  const {ctx}=setup();
  assert.equal(ctx.productCandidates('Y-FLT-D-07')[0].id,'part');
  assert.equal(ctx.productCandidates('Z-FLT-E-02')[0].id,'finished');
});

test('exact part SKU binds the existing material ID without requiring a second click',()=>{
  const {ctx,fields}=setup();
  ctx.filterProductList('Y-FLT-D-07');
  assert.equal(fields.m_product.value,'part');
  assert.equal(fields.m_product_search.value,'Y-FLT-D-07');
  assert.match(fields.productSearchMsg.innerHTML,/已選擇/);
  ctx.filterProductList('Y-FLT-D-07-');
  assert.equal(fields.m_product.value,'');
  assert.match(fields.productSearchResults.innerHTML,/Y-FLT-D-07-1/);
});

for(const domestic of [false,true]){
  test(`${domestic?'domestic':'foreign'} order creation relates the existing part and does not create a material`,async()=>{
    const {ctx,fields,mats}=setup();
    const writes=[];
    Object.assign(fields,{
      m_dom_cust:{value:'customer',options:[],selectedIndex:0},m_dom_manual:{value:''},
      m_cust:{value:'customer'},m_newcust_name:{value:''},m_code:{value:''},
      m_qty:{value:'2'},m_unit_price:{value:''},m_date:{value:'2026-10-10'},
      m_note:{value:''},m_order_no:{value:'ORDER-PART-QA'},piMultiList:{dataset:{}},
    });
    ctx.customers=[{id:'customer',code:'C01',name:'Customer'}];
    ctx.DB={orders:'orders'};
    ctx.ROLE='sales';
    ctx.getSelectedPIItems=()=>[];
    ctx.parseMoneyNumber=Number;
    ctx.closeModal=()=>{};
    const messages=[];
    ctx.showToast=message=>messages.push(message);
    ctx.notionAPI=async(method,endpoint,payload)=>{writes.push({method,endpoint,payload});return {id:'order'};};
    ctx.ensureOrderProduct=()=>{throw Error('existing SKU must not create a material');};
    ctx.syncToDomesticTrade115=async()=>{throw Error('legacy order mirror must not run');};
    ctx.logUserAction=()=>{};
    ctx.refreshAffectedData=async()=>{};
    ctx.console={error:()=>{}};
    vm.runInContext(html.slice(html.indexOf('async function submitNormalOrder('),html.indexOf('async function submitSFGOrder(')),ctx);
    ctx.filterProductList('Y-FLT-D-07');
    await ctx.submitNormalOrder(domestic);
    assert.equal(writes.length,1);
    assert.equal(writes[0].endpoint,'pages');
    assert.equal(writes[0].payload.properties['成品'].relation[0].id,mats[0].id);
    assert.equal(writes[0].payload.properties['訂購數量'].number,2);
    assert.equal(writes[0].payload.properties['訂單類型'].select.name,domestic?'國內':'國外');
    assert.match(messages.at(-1),/建立 1\/1 筆訂單/);
    assert.doesNotMatch(messages.at(-1),/115年貿易商|失敗/);
  });
}

function setupOrderFailure({writeResult,refreshError}={}){
  const {ctx,fields}=setup();
  Object.assign(fields,{
    m_dom_cust:{value:'customer',options:[],selectedIndex:0},m_dom_manual:{value:''},
    m_cust:{value:'customer'},m_newcust_name:{value:''},m_code:{value:''},
    m_qty:{value:'2'},m_unit_price:{value:''},m_date:{value:'2026-10-10'},
    m_note:{value:''},m_order_no:{value:'ORDER-PART-QA'},piMultiList:{dataset:{}},
  });
  ctx.customers=[{id:'customer',code:'C01',name:'Customer'}];
  ctx.DB={orders:'orders'};
  ctx.ROLE='sales';
  ctx.getSelectedPIItems=()=>[];
  ctx.parseMoneyNumber=Number;
  ctx.closeModal=()=>{};
  const messages=[];
  ctx.showToast=message=>messages.push(message);
  ctx.notionAPI=async()=>writeResult;
  ctx.ensureOrderProduct=()=>{throw Error('existing SKU must not create a material');};
  ctx.logUserAction=()=>{};
  let refreshes=0;
  ctx.refreshAffectedData=async()=>{refreshes++;if(refreshError)throw refreshError;};
  ctx.console={error:()=>{}};
  vm.runInContext(html.slice(html.indexOf('async function submitNormalOrder('),html.indexOf('async function submitSFGOrder(')),ctx);
  ctx.filterProductList('Y-FLT-D-07');
  return {ctx,fields,messages,refreshCount:()=>refreshes};
}

test('Notion error result is a failed order, not a success',async()=>{
  const {ctx,messages,refreshCount}=setupOrderFailure({writeResult:{object:'error',message:'permission denied'}});
  await ctx.submitNormalOrder(true);
  assert.match(messages.at(-1),/建立 0\/1 筆訂單/);
  assert.match(messages.at(-1),/permission denied/);
  assert.equal(refreshCount(),0);
});

test('refresh failure after accepted order does not report creation failure',async()=>{
  const {ctx,messages,refreshCount}=setupOrderFailure({writeResult:{id:'accepted-order'},refreshError:Error('query timeout')});
  await ctx.submitNormalOrder(true);
  assert.equal(refreshCount(),1);
  assert.match(messages.at(-1),/建立 1\/1 筆訂單/);
  assert.match(messages.at(-1),/訂單已建立，但列表更新失敗/);
});

test('invalid manual order quantity is rejected before writing',async()=>{
  const {ctx,fields,messages,refreshCount}=setupOrderFailure({writeResult:{id:'should-not-be-created'}});
  fields.m_qty.value='0';
  await ctx.submitNormalOrder(true);
  assert.match(messages.at(-1),/訂購數量請輸入大於 0 的整數/);
  assert.equal(refreshCount(),0);
});

test('PI quantity zero stays zero so validation can reject it',async()=>{
  const {ctx,fields,messages}=setupOrderFailure({writeResult:{id:'should-not-be-created'}});
  fields.piMultiList.dataset.items=Buffer.from(encodeURIComponent(JSON.stringify([{model:'Y-FLT-D-07',qty:5,matId:'part'}])),'binary').toString('base64');
  fields.qty_0={value:'0'};
  fields.chk_0={checked:true};
  ctx.atob=value=>Buffer.from(value,'base64').toString('binary');
  ctx.decodeURIComponent=decodeURIComponent;
  vm.runInContext(html.slice(html.indexOf('function getSelectedPIItems(){'),html.indexOf('async function ensureOrderProduct(')),ctx);
  assert.equal(ctx.getSelectedPIItems()[0].qty,0);
  await ctx.submitNormalOrder(false);
  assert.match(messages.at(-1),/PI 品項數量請輸入大於 0 的整數/);
});

test('domestic customer master still loads when legacy trade database fails',async()=>{
  const ctx=vm.createContext({
    DB:{custMaster:'overseas',custDomestic:'domestic',domesticTrade:'legacy'},
    customers:[],
    dbQueryAll:async id=>{
      if(id==='legacy')throw Error('legacy unavailable');
      if(id==='domestic')return [{id:'formal-1',properties:{'客戶名稱':{},'客戶編號':{}}}];
      return [];
    },
    getTitle:()=> '正式國內客戶',getRichText:()=> 'D001',
    markLoaded:()=>{},console:{warn:()=>{}},
  });
  vm.runInContext(html.slice(html.indexOf('async function loadCustomersOnly()'),html.indexOf('async function loadLeavesOnly()')),ctx);
  await ctx.loadCustomersOnly();
  assert.equal(ctx.customers.length,1);
  assert.equal(ctx.customers[0].id,'formal-1');
  assert.equal(ctx.customers[0].source,'custDomestic');
});

test('order-created new material starts with zero stock',async()=>{
  const writes=[];
  const ctx=vm.createContext({
    DB:{materials:'materials'},mats:[],
    findMaterialByReference:()=>null,
    createPage:async(db,props)=>{writes.push({db,props});return {id:'new-material'};},
    showToast:()=>{},
  });
  vm.runInContext(html.slice(html.indexOf('async function ensureOrderProduct('),html.indexOf('function showMultiItems(')),ctx);
  const mat=await ctx.ensureOrderProduct('NEW-SKU');
  assert.equal(writes.length,1);
  assert.equal(writes[0].props['目前庫存'].number,0);
  assert.equal(mat.stock,0);
});

test('manual SKU creation does not treat order quantity as inbound stock',async()=>{
  const args=[];
  const fields={m_product_search:{value:'NEW-SKU'},m_qty:{value:'100'}};
  const ctx=vm.createContext({
    document:{getElementById:id=>fields[id]||null},
    ensureOrderProduct:async(...values)=>{args.push(values);return {id:'new-material',code:'NEW-SKU'};},
    filterProductList:()=>{},selectProduct:()=>{},showToast:()=>{},
  });
  vm.runInContext(html.slice(html.indexOf('async function createProductFromInput('),html.indexOf('async function fetchPIFromNotion(')),ctx);
  await ctx.createProductFromInput();
  assert.equal(args.length,1);
  assert.equal(args[0].length,1);
});

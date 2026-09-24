const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function section(start,end){
  const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
  assert(a>=0&&b>a,`missing section ${start}`);
  return html.slice(a,b);
}
const ctx=vm.createContext({escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;')});
vm.runInContext(section('function renderErpVisualRows(rows){','function renderInventory(){'),ctx);
vm.runInContext(section('function pickingVisualStage(p){','function renderPicking(){'),ctx);
vm.runInContext(section('function isPickingReturnRequest(p){','function pickingStatusFilterLabel(v){'),ctx);
ctx.ORDER_RETURN_REQUEST_STATUS='待回料確認';

test('inventory chart distinguishes zero stock, low stock, unset threshold and unknown stock',()=>{
  const rows=[
    {stock:0,safe:2},{stock:2,safe:2},{stock:3,safe:2},
    {stock:3,safe:0},{stock:null,safe:2}
  ];
  assert.deepEqual(rows.map(ctx.inventoryVisualStatus),['out','low','ok','unset','unknown']);
  const chart=ctx.renderInventoryStockVisual(rows,'Supabase 主資料');
  for(const value of ['缺貨／零庫存','低於或等於安全庫存','未設定安全庫存','庫存數值不明'])assert.ok(chart.includes(value));
  assert.match(chart,/全部 5 筆料號/);
  assert.match(html,/renderInventoryStockVisual\(invMats,readSet.label\)/);
  assert.match(html,/inventoryVisualStatus\(m\)===INV.stockStatus/);
});

test('picking chart puts each row in one stage and follows the current scope',()=>{
  const rows=[
    {status:'待回料確認'},{status:'缺料待補'},{status:'已領料'},
    {status:'已沖銷'},{status:'待領料'}
  ];
  assert.deepEqual(rows.map(ctx.pickingVisualStage),['return','shortage','picked','reversed','other']);
  const chart=ctx.renderPickingStatusVisual(rows);
  assert.match(chart,/共 5 張/);
  assert.match(chart,/缺料待補/);
  assert.match(html,/renderPickingStatusVisual\(scopedAutoData\)/);
});

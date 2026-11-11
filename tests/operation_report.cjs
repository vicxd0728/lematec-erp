const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function operationReportDayShift(');
const end=html.indexOf('function renderStockLog(){',start);
assert(start>=0&&end>start);
const ctx=vm.createContext({
  Date,Map,Set,Number,String,Math,
  taipeiDateKey:()=> '2026-11-11',
  stockLogIsInventoryMove:row=>Number(row.qty)>0||Number(row.before)!==Number(row.after),
  escapeHtml:value=>String(value),
});
vm.runInContext(html.slice(start,end),ctx);

test('future calendar dates are labelled unavailable rather than zero activity',()=>{
  const html=ctx.operationReportDayButton({date:'2026-11-12',total:0,movements:0,operations:0},'','2026-11-11',2,true);
  assert.match(html,/disabled/);
  assert.match(html,/尚未到期/);
  assert.doesNotMatch(html,/>0<\/span>/);
  assert.equal(ctx.operationReportRoleLabel('warehouse'),'倉管');
});

test('operation report periods use complete Taiwan calendar days',()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.operationReportPeriod('week','2026-11-11'))),{from:'2026-11-09',to:'2026-11-15'});
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.operationReportPeriod('month','2026-02-11'))),{from:'2026-02-01',to:'2026-02-28'});
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.operationReportPeriod('day','2026-11-11'))),{from:'2026-11-11',to:'2026-11-11'});
});

test('operation report separates stock details from other logs without summing mixed units',()=>{
  const rows=[
    {date:'2026-11-09',qty:2,before:4,after:6,originalAction:'入庫',operator:'warehouse',ref:'IB-1'},
    {date:'2026-11-09',qty:0,before:0,after:0,originalAction:'建立訂單',operator:'sales',ref:'ORD-1'},
    {date:'2026-11-10',qty:0,before:0,after:0,originalAction:'建立訂單',operator:'sales',ref:'ORD-1'},
    {date:'2026-11-10',qty:0,before:0,after:0,originalAction:'建立訂單',operator:'業務',ref:'ORD-2'},
  ];
  const model=ctx.operationReportModel(rows,'2026-11-09','2026-11-15');
  assert.equal(model.total,4);
  assert.equal(model.movements,1);
  assert.equal(model.operations,3);
  assert.equal(model.refs,3);
  assert.equal(model.roles.find(([role])=>role==='業務')[1],3);
  assert.equal(model.days.length,7);
  assert.equal(model.days[0].total,2);
  assert.equal(model.days[2].total,0);
});

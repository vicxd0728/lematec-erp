// Generates isolated HTML fixtures for layout review. No network or ERP writes.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..'),testsDir=path.join(root,'tests');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const testSource=fs.readFileSync(path.join(testsDir,'analytics_quality.cjs'),'utf8');
const prelude=testSource.slice(0,testSource.indexOf("test('analytics date range"));
const ctx=vm.runInNewContext(prelude+'\nmakeContext();',{require,__dirname:testsDir});
ctx.orders=[
  {id:'o1',no:'ORD-DEMO-01',created:'2026-09-20',deadline:'2026-09-22',status:'待排程',qty:12,productId:'p1',matCode:'Y-EXAMPLE-01',customer:'客戶甲'},
  {id:'o2',no:'ORD-DEMO-02',created:'2026-09-21',deadline:'2026-10-01',status:'生產中',qty:5,productId:'p2',matCode:'Y-EXAMPLE-02',customer:'客戶乙'},
  {id:'o3',no:'ORD-DEMO-03',created:'2026-09-22',deadline:'2026-10-02',status:'已完成',qty:4,productId:'p2',matCode:'Y-EXAMPLE-02',customer:'客戶甲'},
];
ctx.mats=[
  {id:'p1',supabaseId:'m1',code:'Y-EXAMPLE-01',name:'示範料件一',stock:3,safe:10,unit:'件'},
  {id:'p2',supabaseId:'m2',code:'Y-EXAMPLE-02',name:'示範料件二',stock:40,safe:10,unit:'件'},
];
ctx.window.corders=[
  {id:'c1',no:'SHPTW-DEMO-01',created:'2026-09-23',status:'已完成',qty:2,matCode:'S-Y-EXAMPLE-01'},
  {id:'c2',no:'SHPTW-DEMO-02',created:'2026-09-24',status:'待排程',qty:3,matCode:'S-Y-EXAMPLE-02'},
];
ctx.stockLogs=[{date:'2026-09-20',type:'領料',qty:-5,matCode:'Y-EXAMPLE-01'}];
ctx.DATA_LOAD_DAYS={corders:90,stocklog:90};
ctx.DATA_LOAD_COUNT={corders:2,stocklog:1};
ctx.window._ANALYTICS_RANGE='90';
ctx.window._analyticsFormal={complete:true,source:'inventory_transactions',start:'2026-06-29',end:'2026-09-26',generated_at:'2026-09-26T04:00:00Z',transactions:[
  ...[1,8,29,36].map(days=>({material_id:'m1',source_type:'order_pick_batch',quantity_delta:-5,occurred_at:new Date(Date.parse('2026-09-26T12:00:00Z')-days*86400000).toISOString(),materials:{sku:'Y-EXAMPLE-01',unit:'件'}})),
  ...[2,10,31,43].map(days=>({material_id:'m2',source_type:'corder_ship',quantity_delta:-2,occurred_at:new Date(Date.parse('2026-09-26T12:00:00Z')-days*86400000).toISOString(),materials:{sku:'Y-EXAMPLE-02',unit:'件'}})),
]};
const css=html.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1]||'';
const out=path.join(root,'output','analytics-full-preview');fs.mkdirSync(out,{recursive:true});
for(const view of ['overview','orders','materials','corders','quality']){
  ctx.window._analyticsView=view;
  const page=`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div style="max-width:1280px;margin:20px auto;padding:16px">${ctx.renderAnalytics()}</div></body></html>`;
  fs.writeFileSync(path.join(out,`${view}.html`),page);
  console.log(view,path.join(out,`${view}.html`));
}

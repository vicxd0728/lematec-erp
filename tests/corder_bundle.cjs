const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
function setup(){
 const mats=[{id:'kit',code:'S-KIT',stock:50},{id:'tube',code:'S-TUBE',stock:10},{id:'chuck',code:'S-CHUCK',stock:8},{id:'raw',code:'TUBE',stock:500},{id:'nested',code:'S-NESTED',stock:0}].map(m=>({...m,name:m.code}));
 const boms=[{parentId:'kit',childId:'tube',qty:1},{parentId:'kit',childId:'chuck',qty:2},{parentId:'tube',childId:'tube',qty:1},{parentId:'nested',childId:'kit',qty:2}];
 const moves=[],logs=[],seen=new Map();
 const c=vm.createContext({mats,boms,_bomDataReady:true,ROLE:'sales',window:{corders:[]},CORDER_SEQUENCE_STATE:{next_number:18000},
 normalizeSku:s=>String(s||'').trim().toUpperCase(),findMatBySku:s=>mats.find(m=>m.code===s),corderSameOrderKey:(s,b)=>s+'|'+b,formatCorderNo:n=>'SHPTW'+n,
 applyInventoryBatchAndMirror:async(items,opts)=>{
  const key=opts.sourceId;let old=seen.get(key);if(old)return {items:old.map(x=>({...x,duplicate:true}))};
  assert(items.every(x=>mats.find(m=>m.id===x.pageId).stock+x.delta>=0));
  const rows=items.map(x=>{const m=mats.find(m=>m.id===x.pageId),before=m.stock;m.stock+=x.delta;return {pageId:m.id,before,after:m.stock,duplicate:false};});
  seen.set(key,rows);moves.push({items,opts});return {items:rows};
 },applyInventoryDeltaAndMirror:async(id,opts)=>{moves.push({id,opts});return {before:10,after:9};},
 logStockChangeQuietly:async(...args)=>logs.push(args),orderAuditLogText:()=>'',getCorderReturnedQty:o=>o.returned||0});
 vm.runInContext(html.slice(html.indexOf('function parseCorderStockRefs'),html.indexOf('function filterCorderMatOptions')),c);
 vm.runInContext(html.slice(html.indexOf('async function deductCorderStock('),html.indexOf('function isCorderShipLog')),c);
 vm.runInContext(html.slice(html.indexOf('function buildCorderImportPreflight'),html.indexOf('function openCorderImportPreflightModal')),c);
 return {c,mats,boms,moves,logs};
}
test('bundle consumes S components, never kit or warehouse; repeats are idempotent',async()=>{
 const t=setup(),kit=t.mats[0];const plan=await t.c.deductCorderStockByBom(kit,2,'O','sales','op');
 assert.equal(JSON.stringify(plan.refs),JSON.stringify([{id:'tube',qty:2},{id:'chuck',qty:4}]));
 assert.equal(t.mats[0].stock,50);assert.equal(t.mats[3].stock,500);assert.equal(t.moves.length,1);
 await t.c.deductCorderStockByBom(kit,2,'O','sales','op');assert.equal(t.moves.length,1);assert.equal(t.logs.length,2);
});
test('sales deducts direct S components and self references without expanding child recipes',()=>{
 const t=setup();assert.equal(t.c.resolveCorderShipPlan(t.mats[1],1).refs[0].id,'tube');
 const p=t.c.resolveCorderShipPlan(t.mats[4],2);assert.equal(p.refs.length,1);assert.equal(p.refs[0].id,'kit');assert.equal(p.refs[0].qty,4);
 t.boms[0].childId='kit';const self=t.c.resolveCorderShipPlan(t.mats[0],2);assert.equal(self.refs[0].id,'kit');assert.equal(self.refs[0].qty,2);assert.equal(self.refs[1].qty,4);
});
test('warehouse edges, missing child and invalid BOM fail closed',()=>{
 for(const mode of ['mixed','missing','qty','unloaded']){
  const t=setup();
  if(mode==='mixed')t.boms[0].childId='raw';if(mode==='cycle')t.boms[0].childId='kit';
  if(mode==='missing')t.boms[0].childId='absent';if(mode==='qty')t.boms[0].qty=0;
  if(mode==='unloaded')t.c._bomDataReady=false;
  assert.throws(()=>t.c.resolveCorderShipPlan(t.mats[0],1));
 }
});
test('preview aggregates bundle and standalone demand and excludes already-imported rows',()=>{
 const t=setup(),items=[{sku:'S-KIT',qty:3,buyer:'b',shopeeNo:'a',sourceRow:2},{sku:'S-CHUCK',qty:3,buyer:'b',shopeeNo:'b',sourceRow:3}];
 const r=t.c.buildCorderImportPreflight(items);assert.equal(r.errors,1);assert.equal(r.stockImpact.find(x=>x.code==='S-CHUCK').qty,9);
 t.c.window.corders=[{shopeeNo:'b',buyer:'b',matCode:'S-CHUCK',no:'old'}];
 const r2=t.c.buildCorderImportPreflight(items);assert.equal(r2.errors,0);assert.equal(r2.stockImpact.find(x=>x.code==='S-CHUCK').qty,6);
});
test('insufficient component stock makes no inventory calls',async()=>{
 const t=setup();await assert.rejects(t.c.deductCorderStockByBom(t.mats[0],5,'o','sales','op'));assert.equal(t.moves.length,0);
});
test('saved references return proportional components after BOM changes; legacy returns kit',async()=>{
 const t=setup();const order={qty:4,matId:'tube:4;chuck:8',status:'部分退貨',returned:1};t.boms.splice(0);
 const refs=t.c.corderReturnRefsForQty(order,2);assert.equal(JSON.stringify(refs),JSON.stringify([{id:'tube',qty:2},{id:'chuck',qty:4}]));
 assert.equal(t.c.corderSavedOutstandingRows(order)[1].qty,6);
 assert.equal(t.c.corderReturnRefsForQty({qty:4,matId:'kit:4'},2)[0].id,'kit');
 await t.c.returnCorderStock(refs,'ret','ret-op');await t.c.returnCorderStock(refs,'ret','ret-op');assert.equal(t.moves.length,1);
 assert.equal(t.c.corderSavedOutstandingRows({...order,status:'已取消'}).length,0);
 assert.throws(()=>t.c.corderSavedOutstandingRows({...order,status:'需確認'}));
});
test('frozen preview rejects changed deduction plan',async()=>{
 const t=setup(),p=t.c.resolveCorderShipPlan(t.mats[0],1);t.boms[0].qty=2;
 await assert.rejects(t.c.deductCorderStockByBom(t.mats[0],1,'o','sales','op',p));assert.equal(t.moves.length,0);
});

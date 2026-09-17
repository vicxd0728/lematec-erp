const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function setup(type='國外',stock=1446){
 const parent={id:'parent',name:'F-GAB-03D-B',code:'F-GAB-03D-B',type:'半成品',stock};
 const children=['Y-SRG-15','Y-SRB-14-B','Y-SRG-13-B','Y-SRG-12A'].map((code,i)=>({id:'c'+i,code,name:code,type:'零件',stock:100}));
 const order={id:'order',no:'111111',productId:parent.id,product:parent.code,orderType:type,qty:1};
 const calls=[],toast=[],field={innerHTML:''};let preview;
 const ctx=vm.createContext({mats:[parent,...children],boms:children.map(c=>({parentId:parent.id,childId:c.id,qty:1})),orders:[order],
 _bomDataReady:true,_bomDataSource:'supabase',ROLE:'warehouse',console:{error:()=>{}},
 explodeBOM:()=>[],document:{getElementById:()=>field},renderPreflightCenter:x=>{preview=x;return '';},
 openModal:()=>{},closeModal:()=>{},showToast:(...x)=>toast.push(x),canonicalPageId:x=>x,
 pickingWorkerRequest:async(path,req)=>{calls.push({path,body:req.body});return {row:{id:'pick',items:req.body.items.map(i=>({matId:i.material_notion_page_id,pickedQty:0,notionId:'n-'+i.material_notion_page_id}))}};},
 mapSupabasePick:r=>({...r,no:'P1',supabaseId:r.id,notionId:'pn'}),
 ensurePickingNotionMirror:async()=>{},updateWorkflowPageAfterInventory:async()=>({pending:false}),loadPicks:async()=>{},
 updateSupabasePickingStatus:async(...x)=>calls.push({status:x[1]}),
 applyInventoryBatchAndMirror:async(items,opts)=>{calls.push({batch:items,opts});return {items:items.map(i=>({pageId:i.pageId,before:100,after:100+i.delta,duplicate:false}))};},
 logStockChange:async()=>{},logUserAction:()=>{},refreshAffectedData:async()=>{}});
 vm.runInContext(html.slice(html.indexOf('function isShopeeProductionOrder'),html.indexOf('function canMoveOrderStatus')),ctx);
 vm.runInContext(html.slice(html.indexOf('function openPickModal('),html.indexOf('// ══ 品管檢驗單')),ctx);
 vm.runInContext(html.slice(html.indexOf('function openPickPreview('),html.indexOf('// ══ 品管直接在 Notion')),ctx);
 return {ctx,parent,children,order,calls,toast,field,get preview(){return preview;}};
}
for(const type of ['國外','國內','overseas','domestic','']){
 test('customer order '+type+' deducts ordered half-finished stock only',async()=>{
  const t=setup(type);t.ctx._bomDataReady=false;
  t.ctx.openPickPreview('order');assert.equal(t.preview.rows.length,1);assert.equal(t.preview.rows[0].lineLabel,'F-GAB-03D-B');
  await t.ctx.doPick('order');const b=t.calls.find(x=>x.batch);
  assert(b,JSON.stringify(t.toast));assert.equal(JSON.stringify(b.batch),JSON.stringify([{pageId:'parent',delta:-1}]));
  assert.equal(b.opts.sourceId,'order');assert.equal(b.opts.sourceType,'order_pick_batch');
 });
}
for(const type of ['半成品','sfg','蝦皮','shopee']){
 test('production '+type+' deducts direct components only',async()=>{
  const t=setup(type);t.ctx.boms.push({parentId:'c0',childId:'c1',qty:99});
  t.ctx.openPickModal('order');assert.equal(t.preview.rows.length,4);
  await t.ctx.doPick('order');const b=t.calls.find(x=>x.batch);assert(b,JSON.stringify(t.toast));
  assert.equal(b.batch.length,4);assert(b.batch.every(x=>x.pageId!=='parent'&&x.delta===-1));
 });
}
test('customer parts, finished goods and S- stock never become production from SKU or order number',async()=>{
 for(const code of ['Y-PART','Z-FINISHED','S-F-GAB-03D-B']){
  const t=setup('國外');t.parent.code=code;t.order.product=code;t.order.no='SFG-123';
  assert.equal(t.ctx.isShopeeProductionOrder(t.order),false);assert.equal(t.ctx.isSfgProductionOrder(t.order),false);
  await t.ctx.doPick('order');assert.equal(t.calls.find(x=>x.batch).batch[0].pageId,'parent');
 }
});
test('legacy production markers still identify untyped assembly orders',()=>{
 const t=setup('');t.order.no='SFG-123';assert(t.ctx.isSfgProductionOrder(t.order));
 t.order.no='123';t.order.product='S-Z-ABC';assert(t.ctx.isShopeeProductionOrder(t.order));
});
test('insufficient customer stock blocks deduction without falling back to available parts',async()=>{
 const t=setup('國外',0);t.ctx.openPickPreview('order');assert.equal(t.preview.errors,1);assert(t.field.innerHTML.includes('disabled'));
 await t.ctx.doPick('order');assert(!t.calls.some(x=>x.batch));assert(t.calls.some(x=>x.status==='缺料待補'));
});
test('production missing BOM, missing child, zero quantity or unloaded BOM blocks writes',async()=>{
 for(const mode of ['empty','missing-child','zero','unloaded']){
  const t=setup('半成品');
  if(mode==='empty')t.ctx.boms=[];
  if(mode==='missing-child')t.ctx.boms[0].childId='absent';
  if(mode==='zero')t.ctx.boms[0].qty=0;
  if(mode==='unloaded')t.ctx._bomDataReady=false;
  await t.ctx.doPick('order');assert.equal(t.calls.length,0);
 }
});
test('completed picking retries do not deduct again',async()=>{
 const t=setup();t.ctx.pickingWorkerRequest=async()=>({completed:true,row:{id:'pick',items:[]}});
 await t.ctx.doPick('order');assert(!t.calls.some(x=>x.batch));
});
test('changed pending picking conflict does not bypass the server guard',async()=>{
 const t=setup();t.ctx.pickingWorkerRequest=async()=>{throw Error('409 fingerprint mismatch');};
 await t.ctx.doPick('order');assert(!t.calls.some(x=>x.batch));
});

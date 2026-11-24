const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function setup(type='國外',stock=1446,options={}){
 const parent={id:'parent',name:'F-GAB-03D-B',code:'F-GAB-03D-B',type:'半成品',stock};
 const children=['Y-SRG-15','Y-SRB-14-B','Y-SRG-13-B','Y-SRG-12A'].map((code,i)=>({id:'c'+i,code,name:code,type:'零件',stock:100}));
 const order={id:'order',no:'111111',productId:parent.id,product:parent.code,orderType:type,qty:1};
 const calls=[],toast=[],field={innerHTML:''};let preview;
 const ctx=vm.createContext({mats:[parent,...children],boms:children.map(c=>({parentId:parent.id,childId:c.id,qty:1})),orders:[order],
 _bomDataReady:true,_bomDataSource:'supabase',normalizeSku:s=>String(s||'').trim().toUpperCase(),ROLE:'warehouse',todayStr:()=> '2026-09-26',console:{error:()=>{}},
 explodeBOM:()=>[],document:{getElementById:()=>field},renderPreflightCenter:x=>{preview=x;return '';},escapeHtml:x=>String(x),
 openModal:()=>{},closeModal:()=>{},loadPickShortageFollowups:async()=>{},showToast:(...x)=>toast.push(x),canonicalPageId:x=>x,
 pickingWorkerRequest:async(path,req)=>{calls.push({path,body:req.body});return {existing:!!options.existing,row:{id:'pick',items:req.body.items.map(i=>({matId:i.material_notion_page_id,pickedQty:0,notionId:'n-'+i.material_notion_page_id}))}};},
 mapSupabasePick:r=>({...r,no:'P1',supabaseId:r.id,notionId:'pn'}),
 ensurePickingNotionMirror:async()=>{},updateWorkflowPageAfterInventory:async()=>({pending:false}),loadPicks:async()=>{},
 updateSupabasePickingStatus:async(...x)=>calls.push({status:x[1]}),
 applyInventoryBatchAndMirror:async(items,opts)=>{calls.push({batch:items,opts});if(options.rejectNew)throw Error('insufficient stock');return {items:items.map(i=>({pageId:i.pageId,before:options.existing?120:100,after:options.existing?0:100+i.delta,duplicate:!!options.existing}))};},
 logStockChange:async()=>{},logUserAction:()=>{},refreshAffectedData:async()=>{}});
 vm.runInContext(html.slice(html.indexOf('function isShopeeProductionOrder'),html.indexOf('function canMoveOrderStatus')),ctx);
 vm.runInContext(html.slice(html.indexOf('function resolveCorderShipPlan('),html.indexOf('function corderReturnRefsForQty(')),ctx);
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
for(const type of ['半成品','sfg']){
 test('production '+type+' deducts direct components only',async()=>{
  const t=setup(type);t.ctx.boms.push({parentId:'c0',childId:'c1',qty:99});
  t.ctx.openPickModal('order');assert.equal(t.preview.rows.length,4);
  await t.ctx.doPick('order');const b=t.calls.find(x=>x.batch);assert(b,JSON.stringify(t.toast));
  assert.equal(b.batch.length,4);assert(b.batch.every(x=>x.pageId!=='parent'&&x.delta===-1));
 });
}
test('customer parts and finished goods never become production from SKU or order number',async()=>{
 for(const code of ['Y-PART','Z-FINISHED']){
  const t=setup('國外');t.parent.code=code;t.order.product=code;t.order.no='SFG-123';
  assert.equal(t.ctx.isShopeeProductionOrder(t.order),false);assert.equal(t.ctx.isSfgProductionOrder(t.order),false);
  await t.ctx.doPick('order');assert.equal(t.calls.find(x=>x.batch).batch[0].pageId,'parent');
 }
});

function sSales(type='國外',options={}){
 const t=setup(type,0,options);t.parent.code=t.parent.name='S-KIT';t.order.product='S-KIT';t.order.qty=3;
 for(const child of t.children)child.code=child.name='S-'+child.code;
 t.ctx.boms=[{parentId:'parent',childId:'c0',qty:2},{parentId:'parent',childId:'c1',qty:1},{parentId:'c0',childId:'c2',qty:9}];
 return t;
}
for(const type of ['國內','國外','domestic','overseas'])test(type+' S- sales share C-end direct BOM and never add parent stock',async()=>{
 const t=sSales(type),plan=t.ctx.resolveOrderPickPlan(t.order);
 assert.equal(plan.production,false);assert.equal(plan.sSales,true);assert(!plan.transfer);
 assert.equal(JSON.stringify(plan.items.map(i=>[i.id,i.needed])),JSON.stringify(t.ctx.resolveCorderShipPlan(t.parent,3).items.map(i=>[i.id,i.needed])));
 t.ctx.openPickModal('order');assert.equal(t.preview.rows.length,2);assert.match(t.preview.subtitle,/與 C端相同/);
 await t.ctx.doPick('order');assert.deepEqual(JSON.parse(JSON.stringify(t.calls.find(x=>x.batch).batch)),[{pageId:'c0',delta:-6},{pageId:'c1',delta:-3}]);
 assert.equal(t.calls.find(x=>x.batch).opts.sourceId,'order');
});
test('S- standalone and explicit self plus accessory use the same C-end rule',()=>{
 const t=sSales();t.ctx.boms=[];
 assert.equal(t.ctx.resolveOrderPickPlan(t.order).items[0].id,'parent');
 t.ctx.boms=[{parentId:'parent',childId:'parent',qty:1},{parentId:'parent',childId:'c0',qty:2}];
 assert.equal(t.ctx.resolveOrderPickPlan(t.order).items.length,2);
});
test('S- invalid BOM or missing formal BOM stops before creating a pick',async()=>{
 for(const mode of ['non-S','missing','zero','fraction','unloaded']){
  const t=sSales();
  if(mode==='non-S')t.children[0].code='Y-WAREHOUSE';
  if(mode==='missing')t.ctx.boms[0].childId='absent';
  if(mode==='zero')t.ctx.boms[0].qty=0;
  if(mode==='fraction')t.ctx.boms[0].qty=.5;
  if(mode==='unloaded')t.ctx._bomDataReady=false;
  await t.ctx.doPick('order');assert.equal(t.calls.length,0,mode);assert(t.toast.length);
 }
});
test('S- child shortage is named and never falls back to stocked parent',async()=>{
 const t=sSales();t.parent.stock=100;t.children[0].stock=2;
 t.ctx.openPickModal('order');assert.equal(t.preview.rows[0].lineLabel,t.children[0].code);assert.match(t.field.innerHTML,/部分 BOM 子件庫存不足/);assert.match(t.field.innerHTML,/需要 6，現有 2，缺少 4/);
 await t.ctx.doPick('order');assert(!t.calls.some(x=>x.batch));
});
test('S- completed receipt retry and changed pending manifest never start a new batch',async()=>{
 for(const completed of [true,false]){
  const t=sSales();t.ctx.pickingWorkerRequest=async()=>{if(!completed)throw Error('fingerprint mismatch');return {completed:true,row:{id:'pick',items:[]}};};
  await t.ctx.doPick('order');assert(!t.calls.some(x=>x.batch));
 }
});
test('S- shortage analytics uses the same child quantities as picking and unknown BOM is not zero demand',()=>{
 const t=sSales();t.children[0].stock=2;
 vm.runInContext(html.slice(html.indexOf('function analyticsIsCompleted('),html.indexOf('function analyticsIsConsumptionLog(')),t.ctx);
 t.ctx.analyticsInventoryState=m=>({stock:m.stock});t.order.status='待排程';
 let data=t.ctx.analyticsOrderActionInsight([t.order],t.ctx.mats,'2026-11-24');
 assert.equal(data.blocked[0].sku,t.children[0].code);assert.equal(data.blocked[0].needed,6);assert.equal(data.blocked[0].short,4);
 assert.equal(data.materialDemand.length,2);assert(!data.materialDemand.some(m=>m.id==='parent'));
 t.ctx._bomDataReady=false;data=t.ctx.analyticsOrderActionInsight([t.order],t.ctx.mats,'2026-11-24');assert.equal(data.unknown.length,1);assert.equal(data.materialDemand.length,0);
});
test('legacy production markers still identify untyped assembly orders',()=>{
 const t=setup('');t.order.no='SFG-123';assert(t.ctx.isSfgProductionOrder(t.order));
 t.order.no='123';t.order.product='S-Z-ABC';assert(t.ctx.isShopeeProductionOrder(t.order));
});

test('Shopee preview shows both stock legs and confirmation uses one transfer without a pick',async()=>{
 const t=setup('蝦皮');t.parent.code='S-F-GAB-03D-B';t.order.product=t.parent.code;
 t.ctx.mats.push({id:'source',code:'F-GAB-03D-B',stock:12});t.ctx.canTransferShopeeStockRole=()=>true;
 vm.runInContext(html.slice(html.indexOf('function getShopeeBomItems'),html.indexOf('async function deductShopeeBom')),t.ctx);
 t.ctx.openPickPreview('order');assert.equal(t.preview.rows.length,2);assert.equal(t.preview.rows[0].impact,-1);assert.equal(t.preview.rows[1].impact,1);
 await t.ctx.doPick('order');const b=t.calls.find(x=>x.batch);assert(b,JSON.stringify(t.toast));
 assert.equal(JSON.stringify(b.batch),JSON.stringify([{pageId:'source',delta:-1},{pageId:'parent',delta:1}]));
 assert.equal(b.opts.sourceType,'shopee_transfer');assert(!t.calls.some(x=>x.path));assert.equal(t.order.status,'已完成');
});
test('insufficient customer stock blocks deduction without falling back to available parts',async()=>{
 const t=setup('國外',0);t.ctx.openPickPreview('order');assert.equal(t.preview.errors,1);assert(t.field.innerHTML.includes('disabled'));
 await t.ctx.doPick('order');assert(!t.calls.some(x=>x.batch));assert(t.calls.some(x=>x.status==='缺料待補'));
});
test('an existing pending pick with a committed batch resumes its status without another deduction',async()=>{
 const t=setup('國外',0,{existing:true});await t.ctx.doPick('order');
 assert.equal(t.calls.filter(x=>x.batch).length,1);
 assert(t.calls.some(x=>x.status==='已領料'));
 assert(!t.calls.some(x=>x.status==='缺料待補'));
});
test('shortage preview offers receipt reconciliation for the exact existing pick',()=>{
 const t=setup('國外',0,{existing:true});t.ctx.picks=[{supabaseId:'pick',orderId:'order',status:'待領料'}];
 t.ctx.openPickPreview('order');
 assert.match(t.field.innerHTML,/核對原領料憑證並續接/);
 assert.doesNotMatch(t.field.innerHTML,/disabled[^>]*>核對原領料憑證並續接/);
});
test('an existing pending pick without a receipt stays incomplete when stock is short',async()=>{
 const t=setup('國外',0,{existing:true,rejectNew:true});await t.ctx.doPick('order');
 assert(!t.calls.some(x=>x.status==='已領料'));
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

test('fractional production BOM keeps four-decimal quantities exact in preview and submitted stock batch',async()=>{
 for(const [quantity,needed] of [[1,.0085],[3,.0255],[10,.085],[100,.85],[1000,8.5]]){
  const t=setup('半成品',0);t.order.qty=quantity;
  for(const child of t.children)child.stock=2000;
  t.ctx.boms[0].qty=.0085;t.children[0].stock=needed;
  t.ctx.openPickModal('order');assert.equal(t.preview.errors,0,'exactly sufficient stock for '+quantity);
  await t.ctx.doPick('order');
  assert.equal(t.calls.find(c=>c.path).body.items.find(i=>i.material_notion_page_id==='c0').required_quantity,needed);
  const batch=t.calls.find(c=>c.batch);assert(batch,JSON.stringify(t.toast));assert.equal(batch.batch.find(i=>i.pageId==='c0').delta,-needed);
  assert(!batch.batch.some(i=>i.pageId==='parent'));
 }
});
test('production BOM quantities beyond storage precision or safe arithmetic stop before writes',async()=>{
 for(const qty of [.00005,1e20]){
  const t=setup('半成品');t.ctx.boms[0].qty=qty;
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

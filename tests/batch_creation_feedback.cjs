const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function section(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert(a>=0&&b>a,`${start} missing`);
 return html.slice(a,b);
}

function inbound(extra={}){
 const calls=[];
 const fields={ib_note:{value:'測試備註'},ibCreateStatus:{style:{display:'none'},textContent:''},inboundSubmitBtn:{disabled:false,textContent:''}};
 const item={matId:'page-a',code:'Y-1',qty:3,isNew:false};
 const ctx=vm.createContext({
  window:{_ibItems:[item]},document:{getElementById:id=>fields[id]||null},
  supplyFind:()=>null,todayStr:()=> '2026-10-07',mats:[{id:'page-a',code:'Y-1',name:'Y-1'}],
  readLiveInventoryMaterial:async()=>({notion_page_id:'page-a'}),isSupabaseShadowId:()=>false,
  pickingWorkerRequest:async(path,{body})=>{calls.push(['write',body.inbound_number]);return {row:{id:'receipt-1'}};},
  mapSupabaseInbound:row=>({supabaseId:row.id,no:item.inboundNo}),
  updateInboundNotionMirror:async()=>({pending:false}),
  refreshAffectedData:async()=>{},loadSupplyChain:async()=>{},
  renderTab:()=>{},renderIbItems:()=>calls.push(['render']),closeModal:()=>calls.push(['close']),
  showToast:(...args)=>calls.push(['toast',...args]),logUserAction:()=>{},
  CURRENT_TAB:'inbound',console,...extra,
 });
 vm.runInContext(section('async function submitBatchInbound(){','async function submitLeave(){'),ctx);
 return {ctx,calls,item,fields};
}

test('accepted inbound stays accepted when the list refresh fails',async()=>{
 const h=inbound({refreshAffectedData:async()=>{throw Error('offline');}});
 await h.ctx.submitBatchInbound();
 assert.equal(h.calls.filter(x=>x[0]==='write').length,1);
 assert.ok(h.calls.some(x=>x[0]==='toast'&&/入料已建立 1\/1 筆/.test(x[1])&&/清單更新失敗/.test(x[1])));
 assert.equal(h.ctx.window._ibItems.length,0);
 assert.ok(h.calls.some(x=>x[0]==='close'));
});

test('two inbound clicks while the first write is pending produce one receipt',async()=>{
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 const h=inbound({pickingWorkerRequest:async()=>{h.calls.push(['write']);await gate;return {row:{id:'receipt-1'}};}});
 const first=h.ctx.submitBatchInbound();
 await h.ctx.submitBatchInbound();
 assert.equal(h.calls.filter(x=>x[0]==='write').length,1);
 release();await first;
 assert.equal(h.ctx.window._ibCreating,false);
});

test('supply link failure leaves accepted inbound out of retry list',async()=>{
 const job={id:'job-1',status:'待入料',inbound_number:'IB-SC-1'};
 const h=inbound({window:{_ibItems:[{matId:'page-a',code:'Y-1',qty:3}],_supplyInboundJobId:job.id},supplyFind:()=>job,
  supplyWrite:async()=>{throw Error('offline');}});
 await h.ctx.submitBatchInbound();
 assert.equal(h.calls.filter(x=>x[0]==='write').length,1);
 assert.equal(h.ctx.window._ibItems.length,0);
 assert.equal(h.ctx.window._supplyInboundJobId,job.id);
 assert.ok(h.calls.some(x=>x[0]==='toast'&&/供應鏈關聯結果未確認/.test(x[1])));
});

test('uncertain inbound retains its stable number for a safe retry',async()=>{
 let attempts=0;
 const h=inbound({pickingWorkerRequest:async(path,{body})=>{
  h.calls.push(['write',body.inbound_number]);
  if(++attempts===1)throw Error('timeout');
  return {row:{id:'receipt-1'}};
 }});
 await h.ctx.submitBatchInbound();
 assert.equal(h.ctx.window._ibItems.length,1);
 assert.match(h.fields.ibCreateStatus.textContent,/保留原入料單號/);
 await h.ctx.submitBatchInbound();
 assert.equal(h.ctx.window._ibItems.length,0);
 assert.equal(h.calls.filter(x=>x[0]==='write').length,2);
 assert.equal(h.calls.filter(x=>x[0]==='write')[0][1],h.calls.filter(x=>x[0]==='write')[1][1]);
});

test('selected Shopee material type is preserved in an inbound draft',async()=>{
 let savedType='';
 const h=inbound({window:{_ibItems:[{matId:'page-a',code:'S-Y-1',qty:1,isNew:true,newType:'蝦皮用'}]},
  pickingWorkerRequest:async(path,{body})=>{savedType=body.material_type;return {row:{id:'receipt-1'}};}});
 await h.ctx.submitBatchInbound();
 assert.equal(savedType,'蝦皮用');
});

test('new inbound item requires an explicit type and escapes staff SKU',()=>{
 const fields={ib_new_code:{value:'<img src=x>'},ib_new_type:{value:''},ib_new_qty:{value:'2'},ib_items:{innerHTML:''},ib_search:{value:''},ib_list:{innerHTML:''}};
 const calls=[];
 const ctx=vm.createContext({window:{_ibItems:[]},mats:[],document:{getElementById:id=>fields[id]||null},
  showToast:(...args)=>calls.push(args),escapeHtml:s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])),
  normalizeSku:s=>String(s||''),});
 vm.runInContext(section('function filterInboundList(q){','async function submitBatchInbound(){'),ctx);
 ctx.addNewInboundItem();
 assert.equal(ctx.window._ibItems.length,0);
 assert.ok(calls.some(x=>/請選擇新料號的類型/.test(x[0])));
 fields.ib_new_type.value='零件';ctx.addNewInboundItem();
 assert.match(fields.ib_items.innerHTML,/&lt;img src=x&gt;/);
 assert.doesNotMatch(fields.ib_items.innerHTML,/<img src=x>/);
});

test('inbound search escapes catalog text and uses material ID for selection',()=>{
 const fields={ib_type:{value:''},ib_list:{innerHTML:''},ib_search:{value:''}};
 const ctx=vm.createContext({window:{_ibItems:[]},mats:[{id:'page-a',code:'Y-<img>',name:'<svg>',type:'零件',stock:1}],
  document:{getElementById:id=>fields[id]||null},normalizeSku:s=>String(s||''),
  escapeHtml:s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))});
 vm.runInContext(section('function filterInboundList(q){','async function submitBatchInbound(){'),ctx);
 ctx.filterInboundList('');
 assert.match(fields.ib_list.innerHTML,/Y-&lt;img&gt;/);
 assert.match(fields.ib_list.innerHTML,/&lt;svg&gt;/);
 assert.match(fields.ib_list.innerHTML,/data-material-id="page-a"/);
 assert.doesNotMatch(fields.ib_list.innerHTML,/<svg>/);
});

function manualPick(extra={}){
 const calls=[];
 const fields={mp_note:{value:'repair'},manualPickSubmitBtn:{disabled:false},mpCreateStatus:{style:{display:'none'},textContent:''}};
 const ctx=vm.createContext({
  _mpItems:[{matId:'page-a',code:'Y-1',name:'Y-1',type:'零件',qty:2}],window:{},
  document:{getElementById:id=>fields[id]||null},todayStr:()=> '2026-10-07',ROLE:'warehouse',
  crypto:{getRandomValues:arr=>{arr[0]=42;return arr;}},
  pickingWorkerRequest:async()=>{calls.push(['write']);return {row:{id:'pick-1'}};},
  mapSupabasePick:row=>row,picks:[],ensurePickingNotionMirror:async()=>{},
  loadPicks:async()=>{},renderTab:()=>{},closeModal:()=>calls.push(['close']),
  showToast:(...args)=>calls.push(['toast',...args]),logUserAction:()=>{},console,...extra,
 });
 vm.runInContext(section('async function submitManualPick(){','const _manualPickLocks='),ctx);
 return {ctx,calls,fields};
}

test('manual picking creation distinguishes accepted write from refresh failure',async()=>{
 const h=manualPick({loadPicks:async()=>{throw Error('offline');}});
 await h.ctx.submitManualPick();
 assert.equal(h.calls.filter(x=>x[0]==='write').length,1);
 assert.ok(h.calls.some(x=>x[0]==='toast'&&/補料單已建立，但清單更新失敗/.test(x[1])));
 assert.ok(!h.calls.some(x=>x[0]==='toast'&&/建立失敗/.test(x[1])));
});

test('uncertain manual picking create retains form and blocks repeat click',async()=>{
 const h=manualPick({pickingWorkerRequest:async()=>{h.calls.push(['write']);throw Error('timeout');}});
 await h.ctx.submitManualPick();
 await h.ctx.submitManualPick();
 assert.equal(h.calls.filter(x=>x[0]==='write').length,1);
 assert.equal(h.ctx.window._manualPickCreateUncertain,true);
 assert.equal(h.fields.mpCreateStatus.style.display,'block');
 assert.ok(!h.calls.some(x=>x[0]==='close'));
});

function shopee(extra={}){
 const calls=[];
 const mats=[{id:'s1',code:'S-A',name:'S-A'},{id:'s2',code:'S-B',name:'S-B'},{id:'s3',code:'S-C',name:'S-C'}];
 const fields={m_shopee_note:{value:''},m_shopee_sku:{value:''},m_shopee_qty:{value:'2'},
  shopeeCreateStatus:{style:{display:'none'},textContent:''}};
 const ctx=vm.createContext({
  window:{_shopeeOrderItems:mats.slice(0,2).map(m=>({matId:m.id,code:m.code,name:m.name,qty:2}))},
  document:{getElementById:id=>fields[id]||null},mats,DB:{orders:'orders'},ROLE:'sales',
  findMatBySku:code=>mats.find(m=>m.code===code),ensureShopeeParentMaterial:async()=>null,
  ensureShopeeBomRows:async()=>{},getShopeeBomItems:()=>[{id:'source',code:'A',needed:2}],
  notionAPI:async()=>{calls.push(['write']);return {object:'page',id:'page'};},
  todayStr:()=> '2026-10-07',refreshAffectedData:async()=>{},
  renderShopeeOrderItems:()=>calls.push(['render']),closeModal:()=>calls.push(['close']),
  showToast:(...args)=>calls.push(['toast',...args]),logUserAction:()=>{},console,...extra,
 });
 vm.runInContext(section('async function submitShopeeOrdersV2(){','async function submitShopeeOrder(){'),ctx);
 return {ctx,calls,fields,mats};
}

test('Shopee batch retains only uncreated items after a pre-write failure',async()=>{
 const h=shopee({getShopeeBomItems:mat=>{
  if(mat.code==='S-B')throw Error('來源未建檔');
  return [{id:'source',code:'A',needed:2}];
 }});
 await h.ctx.submitShopeeOrdersV2();
 assert.equal(h.calls.filter(x=>x[0]==='write').length,1);
 assert.equal(h.ctx.window._shopeeOrderItems.length,1);
 assert.equal(h.ctx.window._shopeeOrderItems[0].code,'S-B');
 assert.match(h.fields.shopeeCreateStatus.textContent,/已確認建立 1 筆/);
 assert.ok(!h.calls.some(x=>x[0]==='close'));
});

test('Shopee uncertain write stops later items and blocks repeat',async()=>{
 let count=0;
 const h=shopee({notionAPI:async()=>{h.calls.push(['write']);if(++count===2)throw Error('timeout');return {object:'page',id:'page'};}});
 h.ctx.window._shopeeOrderItems.push({matId:'s3',code:'S-C',name:'S-C',qty:2});
 await h.ctx.submitShopeeOrdersV2();
 assert.equal(h.ctx.window._shopeeCreateUncertain,true);
 assert.deepEqual(Array.from(h.ctx.window._shopeeOrderItems,x=>x.code),['S-B','S-C']);
 await h.ctx.submitShopeeOrdersV2();
 assert.equal(h.calls.filter(x=>x[0]==='write').length,2);
});

test('Shopee direct selection rejects zero before creating material or order',async()=>{
 const h=shopee();
 h.ctx.window._shopeeOrderItems=[];
 h.fields.m_shopee_sku.value='s1';h.fields.m_shopee_qty.value='0';
 await h.ctx.submitShopeeOrdersV2();
 assert.equal(h.calls.filter(x=>x[0]==='write').length,0);
 assert.ok(h.calls.some(x=>x[0]==='toast'&&/數量須為大於 0 的整數/.test(x[1])));
});

test('switching back to Shopee tab preserves an unsent batch',()=>{
 const draft=[{matId:'s1',code:'S-A',qty:2}];
 const ctx=vm.createContext({window:{_shopeeOrderItems:draft},_renderShopeeList:()=>{},renderShopeeOrderItems:()=>{}});
 vm.runInContext(section('function initShopeeOrderList(){','function filterShopeeList(q){'),ctx);
 ctx.initShopeeOrderList();
 assert.equal(ctx.window._shopeeOrderItems,draft);
});

test('Shopee preview escapes component text',()=>{
 const fields={shopeeSkuInfo:{style:{}},shopeeSkuBom:{innerHTML:'',textContent:''},m_shopee_qty:{value:'2'}};
 const ctx=vm.createContext({mats:[{id:'s1',code:'S-A',name:'S-A'}],document:{getElementById:id=>fields[id]||null},
  getShopeeBomItems:()=>[{code:'<img src=x>',needed:2}],
  escapeHtml:s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))});
 vm.runInContext(section('function onShopeeSkuChange(matId){','async function addShopeeOrderItem('),ctx);
 ctx.onShopeeSkuChange('s1');
 assert.match(fields.shopeeSkuBom.innerHTML,/&lt;img src=x&gt;/);
 assert.doesNotMatch(fields.shopeeSkuBom.innerHTML,/<img src=x>/);
});

const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');const {test}=require('node:test');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const c=vm.createContext({canonicalPageId:x=>String(x||'').replace(/-/g,''),notionPageUrl:id=>'https://www.notion.so/'+id,
  getRichText:(p,k)=>p[k]||'',getTitle:(p,k)=>p[k]||'',escapeHtml:x=>String(x).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))});
vm.runInContext(html.slice(html.indexOf('function orderTimelineEvents'),html.indexOf('async function orderTimelineNotion')),c);
const order={id:'abc-def',no:'ORDER-100',created:'2026-09-01',shipDate:'2026-09-07',deadline:'2026-09-08',status:'待出貨',qty:120};
test('sales order creation reuses live BOM without BOM writes and refuses missing or invalid BOM',async()=>{
 const parent={id:'parent',code:'S-Z-DTCG-15K'},child={id:'child',code:'Z-DTCG-15K'};
 for(const mode of ['existing','missing','invalid','offline']){
  let writes=0;
  const ctx=vm.createContext({mats:[parent,child],boms:[{parentId:'parent',childId:'old',qty:99}],_bomDataReady:false,
   normalizeSku:x=>String(x||'').trim().toUpperCase(),canImportBomRole:()=>false,
   fetchWorkerInventoryBomRows:async revision=>{assert(revision);if(mode==='offline')throw Error('offline');return mode==='missing'?[]:[{parent_sku:parent.code,child_sku:child.code,quantity:mode==='invalid'?0:1}];},
   commitBomPlanSupabaseFirst:async()=>{writes++;},mirrorBomPlanToNotion:async()=>{writes++;}});
  vm.runInContext(html.slice(html.indexOf('function mapSupabaseInventoryBomRows'),html.indexOf('function mapNotionInventoryBomRows')),ctx);
  vm.runInContext(html.slice(html.indexOf('async function ensureShopeeBomRows'),html.indexOf('async function auditShopeeBomInventory')),ctx);
  if(mode==='existing'){
   assert.equal((await ctx.ensureShopeeBomRows(parent)).reused,true);
   assert.equal(ctx.boms.length,1);assert.equal(ctx.boms[0].childId,'child');assert.equal(ctx.boms[0].qty,1);
  }else await assert.rejects(ctx.ensureShopeeBomRows(parent));
  assert.equal(writes,0);
 }
});
vm.runInContext(html.slice(html.indexOf('function qcInspectionLinkedToOrder'),html.indexOf('// ── 檢驗結果：通過')),c);
test('QC synchronization never falls back from a different explicit ID to the same number',()=>{
 assert.equal(c.qcInspectionLinkedToOrder({orderRefRaw:'other|ORDER-100'},order.id,order.no,true),false);
 assert.equal(c.qcInspectionLinkedToOrder({orderRefRaw:'abcdef|OLD-NUMBER'},order.id,order.no,false),true);
 assert.equal(c.qcInspectionLinkedToOrder({orderRefRaw:'ORDER-100'},order.id,order.no),false);
 assert.equal(c.qcInspectionLinkedToOrder({orderRefRaw:'ORDER-100'},order.id,order.no,true),true);
});
test('QC writes require exact ID or a fresh unique-number match; lookup failures fail closed',async()=>{
 for(const mode of ['unique','duplicate','failed']){
  const writes=[];
  const rows=[{id:'exact',orderRefRaw:'abcdef|ORDER-100',result:'待檢驗'},
   {id:'wrong',orderRefRaw:'other|ORDER-100',result:'待檢驗'},
   {id:'legacy',orderRefRaw:'ORDER-100',result:'待檢驗'}];
  const ctx=vm.createContext({canonicalPageId:x=>String(x||'').replace(/-/g,''),DB:{orders:'db'},window:{_qcInspections:rows},
   getRichText:(p,k)=>p[k]||'',
   orderTimelineNotion:async(method,endpoint)=>{const row=rows.find(r=>endpoint==='pages/'+r.id);return {object:'page',properties:{'關聯訂單號':row.orderRefRaw,'檢驗結果':{select:{name:writes.includes(row.id)?'通過':row.result}}}};},
   loadQCInspections:async opts=>assert.equal(opts.force,true),updatePage:async id=>writes.push(id),
   orderTimelineQuery:async()=>{if(mode==='failed')throw Error('offline');return mode==='unique'?[order]:[order,{id:'other'}];}});
  vm.runInContext(html.slice(html.indexOf('function qcInspectionLinkedToOrder'),html.indexOf('// ── 檢驗結果：通過')),ctx);
  await ctx.syncLinkedOrderPendingInspections(order);
  assert.deepEqual(writes,mode==='unique'?['exact','legacy']:['exact']);
 }
});
const pick={id:'pick1',source_order_notion_page_id:order.id,pick_number:'PICK-20',created_at:'2026-09-02',picked_at:'2026-09-03',status:'已領料'};
test('QC rechecks results and versions; readback mismatch is not counted as success',async()=>{
 for(const mode of ['failed-result','changed-version','readback-mismatch']){
  const writes=[];let reads=0;
  const ctx=vm.createContext({canonicalPageId:x=>String(x||'').replace(/-/g,''),DB:{orders:'db'},
   window:{_qcInspections:[{id:'q',orderRefRaw:'abcdef|ORDER-100',result:'待檢驗',lastEditedTime:'v1'}]},
   getRichText:(p,k)=>p[k]||'',loadQCInspections:async()=>{},orderTimelineQuery:async()=>[order],
   updatePage:async id=>writes.push(id),orderTimelineNotion:async()=>({object:'page',last_edited_time:mode==='changed-version'?'v2':'v1',properties:{'關聯訂單號':'abcdef|ORDER-100','檢驗結果':{select:{name:++reads>1||mode==='failed-result'?'不通過':'待檢驗'}}}})});
  vm.runInContext(html.slice(html.indexOf('function qcInspectionLinkedToOrder'),html.indexOf('// ── 檢驗結果：通過')),ctx);
  if(mode==='readback-mismatch')await assert.rejects(ctx.syncLinkedOrderPendingInspections(order),/回讀不一致/);
  else assert.equal(await ctx.syncLinkedOrderPendingInspections(order),0);
  assert.equal(writes.length,mode==='readback-mismatch'?1:0);
 }
});
test('invalid inspection quantities stop before creating records or inventory writes',async()=>{
 const src=html.slice(html.indexOf('async function submitInspection(){'),html.indexOf('function renderDashboard(){'));
 for(const [actual,bad] of [['10','15'],['-1','0'],['1.5','0'],['NaN','0'],['10','10']]){
  let closed=false;const notices=[];
  const values={ins_mat:'part',ins_date:'2026-09-07',ins_qtyreq:'10',ins_qtyact:actual,ins_qtybad:bad,ins_result:'通過'};
  const ctx=vm.createContext({document:{getElementById:id=>({value:values[id]||'',checked:id==='ins_to_stock'})},
   mats:[],_qcPhotoFiles:[],showToast:x=>notices.push(x),closeModal:()=>{closed=true;throw Error('must not reach write phase');}});
  vm.runInContext(src,ctx);await ctx.submitInspection();assert.equal(closed,false);assert.equal(notices.length,1);
 }
});
const qc=(ref)=>({id:'qc1',properties:{'關聯訂單號':ref,'檢驗單號':'QC-20','檢驗結果':{select:{name:'通過'}},'檢驗日期':{date:{start:'2026-09-04'}}}});
test('timeline includes dated source records without inventing production milestones',()=>{
 const events=c.orderTimelineEvents(order,[pick],[qc('abcdef|ORDER-100')],[]);
 assert.equal(events.length,5);assert.equal(events[1].title,'建立領料單');assert.equal(events[3].title,'品檢紀錄');
 assert(!events.some(e=>e.title==='生產完成'));
});
test('mismatched IDs and prefix order numbers cannot leak into this timeline',()=>{
 const events=c.orderTimelineEvents(order,[{...pick,source_order_notion_page_id:'other'}],[qc('other|ORDER-100'),qc('ORDER-1000')],[{id:'l',ref_no:'ORDER-1000'}]);
 assert.equal(events.length,2);
});
test('ambiguous order number suppresses number-only legacy associations',()=>{
 const events=c.orderTimelineEvents(order,[],[qc(order.no)],[{id:'l',ref_no:order.no}],false);assert.equal(events.length,2);
});
test('missing dates remain unknown and sort last',()=>{
 const row=qc(order.no);delete row.properties['檢驗日期'];const events=c.orderTimelineEvents(order,[],[row]);assert.equal(events.at(-1).date,'');
});
test('render escapes data and explains partial failures',()=>{
 const text=c.renderOrderTimeline({...order,no:'<script>x</script>'},[{id:'x',date:'',title:'<img onerror=x>',detail:'safe',url:''}],['品檢載入失敗']);
 assert(!text.includes('<script>'));assert(!text.includes('<img'));assert(text.includes('日期未填'));assert(text.includes('品檢載入失敗'));
});
test('timeline query path cannot mutate operational records',()=>{
 const block=html.slice(html.indexOf('async function orderTimelineNotion'),html.indexOf('function _renderDeadlineTab'));
 assert(!/updatePage\(|applyInventory|loadQCInspections\(|loadPicks\(/.test(block));
 assert(block.includes("endpoint.endsWith('/query')"));assert(block.includes('Promise.allSettled'));assert(block.includes('if(!active())return'));
});
test('Worker picking filter is exact and rejects malformed order IDs',async()=>{
 const worker=fs.readFileSync(path.join(root,'cloudflare-worker-green-wave-c22f-FULL-UPDATED.js'),'utf8');
 const calls=[];
 const w=vm.createContext({URL,cleanText:x=>String(x||''),isUuid:x=>/^[a-f0-9-]{36}$/i.test(x),
  getSupabaseInventoryContext:async()=>({organization:{id:'org'}}),supabaseFetch:async(e,url)=>{calls.push(url);return [];},
  respOK:(cors,data)=>data,resp400:()=>({status:400}),resp500:(cors,error)=>({error}),taipeiISOString:()=>'',normalizePickingItems:x=>x});
 vm.runInContext(worker.slice(worker.indexOf('async function erpPickingList'),worker.indexOf('async function erpPickingCreate')),w);
 const id='3c9ff6f4-24bb-81ad-9798-e0ebf3847f44'; // Real Notion v8 format, not an inventory UUID.
 await w.erpPickingList({url:'https://local/api/picking/list?order_id='+id},{},{});
 assert(calls[0].includes('source_order_notion_page_id=eq.'+id));
 const invalid=await w.erpPickingList({url:'https://local/api/picking/list?order_id=bad'},{},{});assert.equal(invalid.status,400);assert.equal(calls.length,1);
});
test('zero-quantity admin actions are not stock moves or duplicate creation',()=>{
 const events=c.orderTimelineEvents(order,[],[],[
  {id:'a',ref_no:order.no,quantity:0,before_stock:0,after_stock:0,original_action:'建立訂單'},
  {id:'b',ref_no:order.no,quantity:0,before_stock:0,after_stock:0,original_action:'編輯訂單',operator_role:'sales'},
 ]);
 assert.equal(events.length,3);assert.equal(events.at(-1).title,'編輯訂單');assert(!events.at(-1).detail.includes('→'));
});
test('timestamp display uses Taiwan time',()=>{
 assert(c.orderTimelineDate('2026-08-31T10:29:00.000Z').includes('18:29'));
 assert.equal(c.orderTimelineDate('2026-08-31'),'2026-08-31');
});
test('partial failure still renders available order evidence',async()=>{
 const host={innerHTML:'',appendChild(x){this.marker=x;},contains(x){return this.marker===x;},querySelector(){return {};}};
 const context=vm.createContext({TOKEN:'mock',ROLE:'viewer',orders:[order],crypto:require('node:crypto').webcrypto,
  document:{getElementById:id=>id==='modalInner'?host:{classList:{contains:()=>true}},createElement:()=>({dataset:{}})},openSharedModal:()=>{},
  PROXY:'https://offline.invalid',DB:{orders:'orders',qcInspection:'qc'},erpWorkerHeaders:()=>({}),
  fetch:async()=>{throw Error('offline');},canonicalPageId:c.canonicalPageId,getTitle:c.getTitle,
  orderTimelineEvents:c.orderTimelineEvents,renderOrderTimeline:c.renderOrderTimeline});
 vm.runInContext(html.slice(html.indexOf('async function openOrderTimeline'),html.indexOf('function _renderDeadlineTab')),context);
 context.orderTimelineNotion=async()=>({object:'page',created_time:order.created,properties:{'訂單號':order.no}});
 context.orderTimelineQuery=async db=>db==='orders'?[{id:order.id}]:[];
 await context.openOrderTimeline(order.id);
 assert(host.innerHTML.includes('訂單建立'));assert(host.innerHTML.includes('領料載入失敗'));assert(host.innerHTML.includes('庫存異動載入失敗'));
});
if(process.argv.includes('--preview')){
 const styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(x=>x[1]).join('\n');
 const content=c.renderOrderTimeline(order,c.orderTimelineEvents(order,[pick],[qc('abcdef|ORDER-100')],[{id:'l1',ref_no:order.no,change_date:'2026-09-05',change_type:'成品入庫',material_code:'S-DEMO',before_stock:0,after_stock:120,operator_role:'倉管'}]),['測試資料預覽：未連接正式資料']);
 fs.mkdirSync(path.join(root,'output','timeline-qa'),{recursive:true});
 fs.writeFileSync(path.join(root,'output','timeline-qa','preview.html'),`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style><body><main style="max-width:720px;margin:20px auto;padding:16px;background:var(--bg2)">${content}</main></body></html>`);
}

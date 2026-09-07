const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');const {test}=require('node:test');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const c=vm.createContext({canonicalPageId:x=>String(x||'').replace(/-/g,''),notionPageUrl:id=>'https://www.notion.so/'+id,
  getRichText:(p,k)=>p[k]||'',getTitle:(p,k)=>p[k]||'',escapeHtml:x=>String(x).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))});
vm.runInContext(html.slice(html.indexOf('function orderTimelineEvents'),html.indexOf('async function orderTimelineNotion')),c);
const order={id:'abc-def',no:'ORDER-100',created:'2026-09-01',shipDate:'2026-09-07',deadline:'2026-09-08',status:'待出貨',qty:120};
const pick={id:'pick1',source_order_notion_page_id:order.id,pick_number:'PICK-20',created_at:'2026-09-02',picked_at:'2026-09-03',status:'已領料'};
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

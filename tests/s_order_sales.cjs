const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const source=fs.readFileSync('cloudflare-worker-green-wave-c22f-FULL-UPDATED.js','utf8');
const cut=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const orderId='aaaaaaaa-aaaa-8aaa-aaaa-aaaaaaaaaaaa';
function harness(){
 const parent={id:'parent',sku:'S-KIT'},children=[{id:'a',sku:'S-A'},{id:'b',sku:'S-B'}];
 const page={id:orderId,parent:{database_id:'orders'},properties:{'訂單類型':{select:{name:'國外'}},'成品':{relation:[{id:'parent-page'}]},'訂購數量':{number:3},'狀態':{select:{name:'待排程'}}}};
 const state={page,parent,children,headers:[{id:'header'}],edges:[{component_material_id:'a',quantity:2},{component_material_id:'b',quantity:1}],masters:[],stored:[{material_id:'a',required_quantity:6},{material_id:'b',required_quantity:3}],receipts:[],unowned:[],writes:[],reads:[],keys:[],fail:false};
 const text=v=>String(v||'').trim(),json=(value,status=200)=>new Response(JSON.stringify(value),{status});
 const ctx=vm.createContext({Response,Request,URL,TextEncoder,crypto:webcrypto,
  cleanText:text,cleanSku:v=>text(v).toUpperCase(),canonicalNotionId:v=>text(v).replaceAll('-','').toLowerCase(),
  BOARD_DB:{orders:'orders'},erpBearerToken:()=> 'isolated-token',corderRecoveryNotion:async()=>structuredClone(page),
  respOK:(_,v)=>json(v),resp400:(_,error)=>json({error},400),resp500:(_,error)=>json({error},500),jh:()=>({'Content-Type':'application/json'}),taipeiISOString:()=> '2026-11-24T10:00:00+08:00',
  getSupabaseInventoryContext:async()=>({organization:{id:'org'},warehouse:{id:'wh'}}),
  isUuid:()=>false,inventoryTransactionType:()=> 'outbound',deterministicUuid:async()=> 'stable-pick',sha256Short:async v=>v,
  normalizePickingItems:v=>v,
  supabaseSingle:async(_,path)=>{state.reads.push(path);return structuredClone(parent);},
  resolveSupabaseMaterial:async(_,org,item,sku)=>{assert.equal(org,'org');return structuredClone([parent,...children].find(m=>m.sku===sku));},
  supabaseAll:async(_,path)=>{
   state.reads.push(path);
   if(path.includes('/bom_headers?'))return structuredClone(state.headers);
   if(path.includes('/bom_items?'))return structuredClone(state.edges);
   if(path.includes('/materials?'))return structuredClone([parent,...children]);
   if(path.includes('/pick_lists?'))return structuredClone(state.masters);
   if(path.includes('/pick_items?'))return structuredClone(state.stored);
   if(path.includes('/inventory_transactions?'))return structuredClone(path.includes('source_id=is.null')?state.unowned:state.receipts);
   if(path.includes('/orders?'))return [];
   throw Error('Unexpected read '+path);
  },
  supabaseFetch:async(_,path,options)=>{
   const body=JSON.parse(options.body);state.writes.push({path,body});
   if(path.includes('/rpc/apply_inventory_batch')){
    if(state.fail)throw Error('insufficient inventory');
    const duplicate=state.keys.includes(body.p_idempotency_key);state.keys.push(body.p_idempotency_key);
    return {duplicate,items:body.p_items.map(i=>({material_id:i.material_id,delta:i.delta,before_stock:100,after_stock:100+i.delta}))};
   }
   throw Error('Metadata write forbidden in this test');
  }
 });
 vm.runInContext(cut('async function readSSalesOrder(','function pickingDateTime('),ctx);
 vm.runInContext(cut('async function erpInventoryBatchAdjust(','function canonicalNotionId('),ctx);
 vm.runInContext(cut('async function erpPickingCreate(','async function erpPickingStatus('),ctx);
 const request=body=>new Request('https://isolated.invalid',{method:'POST',body:JSON.stringify(body)});
 state.create=async(items=[{sku:'S-A',required_quantity:6},{sku:'S-B',required_quantity:3}])=>{
  const r=await ctx.erpPickingCreate(request({source:'ERP_ORDER',source_order_notion_page_id:orderId,pick_number:'PK-1',production_quantity:3,items,dry_run:true}),{},{});return {status:r.status,body:await r.json()};
 };
 state.batch=async(items=[{sku:'S-A',delta:-6},{sku:'S-B',delta:-3}],key='client-key')=>{
  const r=await ctx.erpInventoryBatchAdjust(request({payload:{items,idempotency_key:key,source_type:'order_pick_batch',source_id:orderId,ref_no:'PK-1'}}),{},{});return {status:r.status,body:await r.json()};
 };
 state.pick=()=>state.masters=[{id:'pick',pick_number:'PK-1',status:'待領料',source_order_notion_page_id:orderId,source_payload:{deduction_rule:'s_sales_bom_v1'}}];
 return state;
}
test('S customer picking dry-run validates authoritative direct BOM, never writes',async()=>{
 const h=harness(),r=await h.create();assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.row.source_payload.deduction_rule,'s_sales_bom_v1');assert.equal(h.writes.length,0);
 assert(h.reads.some(p=>p.includes('organization_id=eq.org&notion_page_id=eq.parent-page&archived_at=is.null')));
});
test('stale parent-only picking is blocked before metadata or inventory changes',async()=>{
 const h=harness(),r=await h.create([{sku:'S-KIT',required_quantity:3}]);assert.equal(r.status,500);assert.match(r.body.error,/不一致/);assert.equal(h.writes.length,0);
});
test('missing/non-S/archived children and invalid quantities fail closed',async()=>{
 for(const mode of ['missing','nonS','archived','zero','fraction']){
  const h=harness();if(mode==='missing')h.edges[0].component_material_id='absent';if(mode==='nonS')h.children[0].sku='Y-A';if(mode==='archived')h.children[0].archived_at='2026-01-01';if(mode==='zero')h.edges[0].quantity=0;if(mode==='fraction')h.edges[0].quantity=.5;
  assert.notEqual((await h.create()).status,200,mode);assert.equal(h.writes.length,0);
 }
});
test('standalone and self-plus-accessory follow direct C-end semantics',async()=>{
 const h=harness();h.edges=[];assert.equal((await h.create([{sku:'S-KIT',required_quantity:3}])).status,200);
 h.edges=[{component_material_id:'parent',quantity:1},{component_material_id:'a',quantity:2}];
 assert.equal((await h.create([{sku:'S-KIT',required_quantity:3},{sku:'S-A',required_quantity:6}])).status,200);assert.equal(h.writes.length,0);
});
test('atomic S batch uses original UUID-v8 ID and same key across client retries',async()=>{
 const h=harness();h.pick();const a=await h.batch(),b=await h.batch(undefined,'different-client-key');
 assert.equal(a.status,200,JSON.stringify(a.body));assert.equal(b.body.duplicate,true);assert.equal(new Set(h.keys).size,1);assert.equal(h.writes[0].body.p_source_id,orderId);
 assert.match(h.keys[0],/^order_s_sales_bom:/);
});
test('already committed pending batch returns original receipts without another RPC even after BOM changes',async()=>{
 const h=harness();h.pick();h.edges=[];
 h.receipts=h.stored.map(i=>({id:'tx-'+i.material_id,material_id:i.material_id,source_type:'order_pick_batch',source_number:'PK-1',warehouse_id:'wh',quantity_delta:-i.required_quantity,quantity_before:100,quantity_after:100-i.required_quantity}));
 const r=await h.batch();assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.duplicate,true);assert.equal(h.writes.length,0);assert.equal(r.body.items[0].transaction_id,'tx-a');
});
test('changed saved manifest, foreign receipts or returned receipts never debit',async()=>{
 for(const mode of ['stored','foreign','partial','return','no-pick','changed-BOM','unowned','legacy-type']){
  const h=harness();h.pick();
  if(mode==='stored')h.stored[0].required_quantity=5;
  if(mode==='foreign')h.receipts=[{source_type:'order_pick_batch',source_number:'OTHER',warehouse_id:'wh'}];
  if(mode==='partial')h.receipts=[{source_type:'order_pick_batch',source_number:'PK-1',warehouse_id:'wh',material_id:'a',quantity_delta:-6}];
  if(mode==='return')h.receipts=[{source_type:'order_identity_reversal'}];
  if(mode==='no-pick')h.masters=[];
  if(mode==='changed-BOM')h.edges[0].quantity=3;
  if(mode==='unowned')h.unowned=[{id:'old-unowned'}];
  if(mode==='legacy-type')h.receipts=[{source_type:'order_pick',quantity_delta:-3}];
  const r=await h.batch();assert.equal(r.status,500,mode);assert.equal(h.writes.length,0,mode);
 }
});
test('assembly and replenishment are not forced into S sales',async()=>{
 for(const type of ['半成品','sfg','蝦皮','shopee','']){
  const h=harness();h.page.properties['訂單類型'].select.name=type;
  assert.equal((await h.create([{sku:'S-KIT',required_quantity:3}])).status,200,type);assert.equal(h.writes.length,0);
 }
});
test('completed old pick short-circuits before current BOM and never rewrites original receipt',async()=>{
 const h=harness();h.pick();h.masters[0].status='已領料';h.edges[0].quantity=99;
 const r=await h.create([{sku:'S-KIT',required_quantity:3}]);assert.equal(r.body.completed,true);assert.equal(h.writes.length,0);
});

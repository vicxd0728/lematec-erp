const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const source=fs.readFileSync('cloudflare-worker-green-wave-c22f-FULL-UPDATED.js','utf8');
const id='44444444-4444-4444-8444-444444444444',mid='33333333-3333-4333-8333-333333333333';
function setup(overrides={}){
 const item={client_trace_id:'inventory-tx:'+id,source:'inventory_reconcile',ref_no:'SHPTW16633',material_code:'S-LEI-08-6',material_id:mid,quantity:1,before_stock:12,after_stock:11};
 const existing={...item,id:9678,source:'codex_sync',notion_page_id:'mirror',created_at:'original'};
 const tx={id,source_number:'SHPTW16633',source_type:'corder_ship',quantity_delta:-1,quantity_before:12,quantity_after:11,materials:{sku:'S-LEI-08-6',notion_page_id:mid}};
 const writes=[];
 const c=vm.createContext({cleanText:s=>String(s||'').trim(),cleanSku:s=>String(s||''),canonicalNotionId:s=>String(s||'').replaceAll('-',''),isUuid:s=>/^[0-9a-f-]{36}$/.test(s||''),getSupabaseInventoryContext:async()=>({organization:{id:'org'}}),supabaseSingle:async(_e,path)=>path.includes('/inventory_transactions?')?overrides.noTx?null:tx:existing,supabaseFetch:async(_e,path,request)=>{writes.push({path,...request});return [];},respOK:(_,x)=>x,resp500:(_,error)=>({error})});
 vm.runInContext(source.slice(source.indexOf('async function verifiedCorderStockLogRepair('),source.indexOf('async function erpStockLogList(')),c);
 return {item,existing,tx,writes,c,run:()=>c.erpStockLogSync({json:async()=>({item})},{},{})};
}
test('verified formal receipt promotes an existing hidden repair without inserting another detail or touching stock',async()=>{
 const h=setup();const result=await h.run();assert.equal(result.duplicate,true);assert.equal(result.id,9678);assert.equal(result.notion_page_id,'mirror');
 assert.equal(h.writes.length,1);assert.match(h.writes[0].path,/erp_stock_logs\?id=eq.9678/);assert.equal(h.writes[0].method,'PATCH');assert.deepEqual(JSON.parse(h.writes[0].body),{source:'inventory_reconcile'});
});
test('missing receipt, altered stock numbers, SKU, reference or trace cannot unhide a test row',async()=>{
 for(const mode of ['noTx','qty','sku','ref','trace','stored']){
  const h=setup({noTx:mode==='noTx'});
  if(mode==='qty')h.item.quantity=2;if(mode==='sku')h.item.material_code='S-OTHER';if(mode==='ref')h.item.ref_no='SHPTW999';if(mode==='trace')h.item.client_trace_id='codex-test';if(mode==='stored')h.existing.before_stock=99;
  assert((await h.run()).error,mode);assert.equal(h.writes.length,0,mode);
 }
});
test('normal historical test sources retain the existing hidden classification and are never promoted implicitly',async()=>{
 const h=setup();h.item.source='codex_sync';assert.equal((await h.run()).duplicate,true);assert.equal(h.writes.length,0);
});

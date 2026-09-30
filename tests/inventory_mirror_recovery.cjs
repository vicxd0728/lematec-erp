const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const worker=fs.readFileSync(path.join(root,'cloudflare-worker-green-wave-c22f-FULL-UPDATED.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const section=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)+start.length));

test('material-link retry preserves already received stock',async()=>{
  let stock=2000;
  const calls=[];
  const context=vm.createContext({
    Request,Response,
    cleanSku:value=>String(value||'').trim().toUpperCase(),
    cleanText:value=>String(value||'').trim(),
    getSupabaseInventoryContext:async()=>({organization:{id:'org'},warehouse:{id:'main'}}),
    supabaseSingle:async()=>({id:'mat-1',sku:'Y-GAH-03',notion_page_id:''}),
    upsertSupabaseMaterial:async(env,org,existing,payload)=>({id:existing.id,notion_page_id:payload.notion_page_id}),
    upsertSupabaseBalance:async()=>{calls.push('overwrite');stock=0;},
    insertSupabaseBalanceIfMissing:async()=>{calls.push('insert-ignore');},
    getSupabaseBalance:async()=>({id:'balance-1',quantity:stock}),
    taipeiISOString:()=>'',
    respOK:(cors,data)=>Response.json(data),
    resp400:(cors,error)=>Response.json({error},{status:400}),
    resp500:(cors,error)=>Response.json({error},{status:500}),
  });
  vm.runInContext(section(worker,'async function erpInventorySync(','async function activeSupabaseBomReferences('),context);
  const request=new Request('https://offline.invalid/api/inventory/sync',{
    method:'POST',body:JSON.stringify({task:{kind:'upsert_material',payload:{sku:'Y-GAH-03',name:'Y-GAH-03',stock:0,notion_page_id:'notion-1'}}})
  });
  const response=await context.erpInventorySync(request,{},{});
  assert.equal(response.status,200);
  assert.equal((await response.json()).stock,2000);
  assert.deepEqual(calls,['insert-ignore']);
  assert.equal(stock,2000);
});

test('fresh material read uses exact SKU and bypasses versioned cache',async()=>{
  const paths=[];
  const context=vm.createContext({
    URL,Response,
    cleanSku:value=>String(value||'').trim().toUpperCase(),
    cleanText:value=>String(value||'').trim(),
    supabaseFetch:async(env,url)=>{paths.push(url);return [{id:'mat-1',sku:'Y-GAH-08',name:'Y-GAH-08',inventory_balances:[]}];},
    respOK:(cors,data)=>Response.json(data),resp500:(cors,error)=>Response.json({error},{status:500}),
    taipeiISOString:()=>'',
  });
  vm.runInContext(section(worker,'async function erpInventoryList(','async function erpInventorySync('),context);
  const result=await context.erpInventoryList(new Request('https://offline.invalid/api/inventory/list?sku=Y-GAH-08&limit=1'),{},{});
  assert.equal(result.status,200);
  assert.match(paths[0],/sku=eq\.Y-GAH-08/);
  assert.equal((await result.json()).materials[0].stock,0);
});

test('Notion stock retry reads current primary quantity instead of saved task quantity',async()=>{
  const writes=[];
  const material={id:'mat-1',sku:'Y-GAH-03',notion_page_id:'notion-1',stock:2000};
  const context=vm.createContext({
    normalizeSku:value=>String(value||'').toUpperCase(),
    readLiveInventoryMaterial:async()=>material,
    resolveInventoryNotionMirrorPageId:()=>'',
    updatePage:async(id,properties,opts)=>{writes.push({id,stock:properties['目前庫存'].number,opts});return {object:'page'};},
    assertNotionPage:value=>value,
  });
  vm.runInContext(section(html,'async function syncInventoryNotionStockFromSource(','async function mirrorInboundMaterialStock('),context);
  const result=await context.syncInventoryNotionStockFromSource('Y-GAH-03','notion-1');
  assert.equal(result.stock,2000);
  assert.equal(writes.length,1);
  assert.equal(writes[0].stock,2000);
  assert.equal(writes[0].opts.skipInventorySync,true);
});

test('QC and manual inbound paths both trigger material mirror after stock commit',()=>{
  const approve=section(html,'async function approveQC(','async function rejectQC(');
  const manual=section(html,'async function syncInboundStock(','async function logStockChange(');
  assert.match(approve,/const materialSync=await mirrorInboundMaterialStock\(savedInbound,stockMove\.after\)/);
  assert.match(manual,/const materialSync=await mirrorInboundMaterialStock\(saved,data\.after_stock\)/);
  assert.match(approve,/if\(inboundResult\.duplicate\)/);
});

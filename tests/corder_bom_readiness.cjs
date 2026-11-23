const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('index.html','utf8'),cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const incoming=['S-Z-SDG-03CD','S-Z-SKC-A-11AS-P3','S-F-DTC-16-E','S-Z-DTC-02-2'].map((sku,i)=>({sourceRow:i+2,sku,qty:1,shopeeNo:'SHOP-'+i,buyer:'buyer'}));
function setup(){
 let reads=0,fail=false,orderFailure=false,release;
 const materials=incoming.map((r,i)=>({id:'m'+i,code:r.sku,name:r.sku,stock:100}));
 const rows=materials.map(m=>({id:'bom-'+m.id,parent_notion_page_id:m.id,child_notion_page_id:m.id,parent_sku:m.code,child_sku:m.code,quantity:1}));
 const c=vm.createContext({console:{warn(){}},AbortController,setTimeout,clearTimeout,
  mats:materials,boms:rows.map((r,i)=>({id:r.id,parentId:materials[i].id,childId:materials[i].id,qty:1})),orders:[],_bomDataReady:true,_bomDataError:'',_bomDataSource:'supabase',_bomDataFallbackReason:'',
  _coreDataVersions:{inventory:'v1',bom:'v1'},_supabaseInventoryState:{loaded:true},localStorage:{removeItem(){}},DB:{orders:'orders'},
  normalizeSku:s=>String(s||'').trim().toUpperCase(),window:{corders:[]},CORDER_SEQUENCE_STATE:{next_number:16748},corderSameOrderKey:(s,b)=>s+'|'+b,formatCorderNo:n=>'SHPTW'+n,
  findMatBySku:sku=>c.mats.find(m=>m.code===sku),fetchWorkerInventoryVersions:async()=>({inventory:'v1',bom:'v1'}),
  fetchWorkerInventoryMaterials:async()=>{reads++;return materials;},fetchWorkerInventoryBomRows:async()=>{reads++;if(fail)throw Error('BOM API 503');return rows;},
  dbQueryAll:async()=>{if(orderFailure){await new Promise(r=>release=r);throw Error('B2B order query failed');}return [];},markLoaded(){},readPendingBomNotionMirrors:()=>[],
 });
 vm.runInContext(cut('let _inventoryCoreReadTail=','function setSyncState('),c);
 return {c,materials,rows,reads:()=>reads,fail:v=>fail=v,orderFailure:()=>orderFailure=true,release:()=>release?.()};
}
function ready(){
 const t=setup(),c=t.c;
 vm.runInContext(cut('function mapSupabaseInventoryBomRows(','function mapNotionInventoryBomRows('),c);
 vm.runInContext(cut('async function loadCoreEssentials(','async function loadCustomersOnly('),c);
 vm.runInContext(cut('function parseCorderStockRefs(','function filterCorderMatOptions('),c);
 vm.runInContext(cut('async function prepareCorderImportPreflight(','async function retryCorderImportPreflight('),c);
 vm.runInContext(cut('function buildCorderImportPreflight(','function openCorderImportPreflightModal('),c);
 return t;
}
test('unrelated B2B sync failure cannot strand import: await core then read formal BOM and replan all rows',async()=>{
 const t=ready();t.orderFailure();
 const background=t.c.loadCoreEssentials().catch(e=>e);
 await new Promise(r=>setImmediate(r));assert.equal(t.c._bomDataReady,false);
 const pending=t.c.prepareCorderImportPreflight(incoming);assert.equal(t.reads(),0);
 t.release();await background;const report=await pending;
 assert.equal(report.errors,0);assert.equal(report.rows.length,4);assert.equal(report.coreRead.bomRows,4);assert.equal(t.c._bomDataSource,'supabase');assert.equal(t.reads(),2);
});
test('failed BOM read blocks all new rows, retains incoming and can recover without file upload or writes',async()=>{
 const t=ready(),before=JSON.stringify(t.c.boms);t.fail(true);
 const failed=await t.c.prepareCorderImportPreflight(incoming);
 assert.equal(failed.incoming,incoming);assert.equal(failed.errors,4);assert.match(failed.coreReadError,/503/);assert.equal(t.c._bomDataReady,false);assert.equal(JSON.stringify(t.c.boms),before);
 t.fail(false);const recovered=await t.c.prepareCorderImportPreflight(failed.incoming);
 assert.equal(recovered.errors,0);assert.equal(recovered.incoming,incoming);assert.equal(t.reads(),4);
});
test('formal BOM failure is still visible when all input rows already exist',async()=>{
 const t=ready();t.c.window.corders=incoming.map(r=>({...r,matCode:r.sku,status:'出貨中',no:'OLD'}));t.fail(true);
 const report=await t.c.prepareCorderImportPreflight(incoming);assert.equal(report.errors,0);assert.ok(report.coreReadError);assert.equal(report.skippedRows,4);
});
test('read timeout stays blocked and names the timeout without losing incoming rows',async()=>{
 const t=ready();let timeout;
 t.c.setTimeout=fn=>{timeout=fn;return 1;};t.c.clearTimeout=()=>{};
 t.c.fetchWorkerInventoryBomRows=(_r,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('aborted'),{name:'AbortError'}))));
 const waiting=t.c.prepareCorderImportPreflight(incoming);await new Promise(r=>setImmediate(r));timeout();const result=await waiting;
 assert.match(result.coreReadError,/逾時/);assert.equal(result.errors,4);assert.equal(result.incoming,incoming);assert.equal(t.c._bomDataReady,false);
});
test('incomplete formal BOM mapping cannot commit a partial snapshot',async()=>{
 const t=ready(),before=JSON.stringify(t.c.boms);t.rows[0].child_notion_page_id='missing';t.rows[0].child_sku='S-MISSING';
 const result=await t.c.prepareCorderImportPreflight(incoming);assert.match(result.coreReadError,/無法安全對應/);assert.equal(JSON.stringify(t.c.boms),before);assert.equal(result.errors,4);
});

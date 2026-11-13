const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const extract=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end));

test('health check labels stale Supabase screen data as cache, not a Notion stock conflict',async()=>{
  const toasts=[];
  const c=vm.createContext({
    _supabaseReadReport:{},CURRENT_TAB:'health',mats:[{code:'LE-FC-A',stock:120,source:'supabase'}],
    fetchWorkerInventoryMaterials:async()=>[{sku:'LE-FC-A',stock:0}],
    getSupabaseAnonKey:()=>'',buildLocalInventorySnapshot:()=>new Map([['LE-FC-A',{sku:'LE-FC-A',qty:120}]]),
    buildLocalBomSnapshot:()=>new Set(),normalizeSku:x=>x,renderTab:()=>{},
    showToast:(message,level)=>toasts.push({message,level}),
  });
  vm.runInContext(extract('async function runSupabaseReadCheck(', 'function renderSupabaseReadCheck('),c);
  await c.runSupabaseReadCheck(true);
  assert.equal(c._supabaseReadReport.level,'warn');
  assert.equal(c._supabaseReadReport.cacheSource,'supabase');
  assert.match(c._supabaseReadReport.message,/畫面快取.*不代表正式庫存或 Notion 鏡像有誤/);
  assert.equal(c._supabaseReadReport.qtyMismatch[0].cache,120);
  assert.equal(c._supabaseReadReport.qtyMismatch[0].supabase,0);
  assert.equal(toasts.at(-1).level,'warn');
});

test('actual Notion mirror conflicts are prioritized by latest edit time',async()=>{
  const pages=[
    {id:'old',updatedAt:'2026-11-10T08:00:00Z',code:'OLD',stock:2},
    {id:'new',updatedAt:'2026-11-13T08:00:00Z',code:'NEW',stock:2},
  ];
  const formal=pages.map(p=>({code:p.code,stock:1,notionId:p.id,updatedAt:'2026-11-09T08:00:00Z'}));
  pages.push({id:'unlinked',updatedAt:'2026-11-12T08:00:00Z',code:'UNLINKED',stock:0});
  const c=vm.createContext({
    _inventoryConflictReport:{},CURRENT_TAB:'health',TOKEN:'test',DB:{materials:'db'},
    renderTab:()=>{},dbQueryAll:async()=>pages,fetchWorkerInventoryMaterials:async()=>formal,
    reliabilityWorker:async()=>({jobs:[]}),mapNotionMaterialPage:p=>p,canonicalPageId:x=>x,
    inventoryConflictPendingKeys:()=>({pageIds:new Set(),codes:new Set()}),
    inventoryConflictDiff:(a,b)=>a.stock===b.stock?[]:[{key:'stock'}],
    normalizeSku:x=>x,showToast:()=>{},
  });
  vm.runInContext(extract('async function scanInventoryNotionConflicts(', 'function renderInventoryConflictCenter('),c);
  const result=await c.scanInventoryNotionConflicts({quiet:true});
  assert.deepEqual(Array.from(result.conflicts,row=>row.code),['NEW','OLD']);
  assert.equal(result.conflicts[0].lastChangedAt,Date.parse('2026-11-13T08:00:00Z'));
  assert.deepEqual(Array.from(result.orphanPages,row=>row.code),['UNLINKED']);
});

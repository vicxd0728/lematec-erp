const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('index.html','utf8');
const extract=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end));

test('health BOM snapshot retains valid S self-stock recipes',()=>{
  const c=vm.createContext({
    mats:[{id:'s',code:'S-ONE'},{id:'n',code:'Y-ONE'},{id:'m',code:'Y-TWO'}],
    boms:[{parentId:'s',childId:'s',qty:1},{parentId:'n',childId:'n',qty:1},{parentId:'n',childId:'m',qty:2}],
    normalizeSku:x=>String(x||'').toUpperCase(),
  });
  vm.runInContext(extract('function buildLocalBomSnapshot(', 'async function runSupabaseReadCheck('),c);
  assert.deepEqual(Array.from(c.buildLocalBomSnapshot()).sort(),['S-ONE|S-ONE|1','Y-ONE|Y-TWO|2']);
});

test('mirror comparison recognizes code spacing while preserving other field differences',()=>{
  const c=vm.createContext({normalizeSku:x=>String(x||'').toUpperCase().replace(/\s/g,'')});
  vm.runInContext(extract('function inventoryConflictDiff(', 'function inventoryConflictPendingKeys('),c);
  const base={code:'6MMCOLLET',name:'6MMCOLLET',type:'零件',unit:'個',safe:0,stock:5,note:''};
  const other={...base,code:'6 MM COLLET',note:'legacy note'};
  assert.deepEqual(Array.from(c.inventoryConflictDiff(base,other),row=>row.key),['note']);
  other.stock=4;
  assert.deepEqual(Array.from(c.inventoryConflictDiff(base,other),row=>row.key),['stock','note']);
});

test('legacy Notion material with blank code uses its linked title without inventing a new SKU',()=>{
  const c=vm.createContext({getTitle:(props,key)=>props[key]?.title?.[0]?.plain_text||'',getRichText:(props,key)=>props[key]?.rich_text?.[0]?.plain_text||''});
  vm.runInContext(extract('function mapNotionMaterialPage(', 'function mapSupabaseInventoryMaterial('),c);
  const row=c.mapNotionMaterialPage({id:'existing-page',properties:{'料件名稱':{title:[{plain_text:'LE-1000BP(2.5mm)'}]},'料件編號':{rich_text:[]}}});
  assert.equal(row.id,'existing-page');
  assert.equal(row.code,'LE-1000BP(2.5mm)');
  assert.equal(row.rawCode,'');
});

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

test('linked note and SKU-format differences stay visible without becoming stock conflicts',async()=>{
  const pages=[{id:'p',code:'S-X',rawCode:'',stock:0,note:'human note',updatedAt:'2026-11-13T08:00:00Z'}];
  const formal=[{code:'S-X',stock:0,note:'',notionId:'p',updatedAt:'2026-11-12T08:00:00Z'}];
  const c=vm.createContext({
    _inventoryConflictReport:{},CURRENT_TAB:'health',TOKEN:'test',DB:{materials:'db'},
    renderTab:()=>{},dbQueryAll:async()=>pages,fetchWorkerInventoryMaterials:async()=>formal,
    reliabilityWorker:async()=>({jobs:[]}),mapNotionMaterialPage:p=>p,canonicalPageId:x=>x,
    inventoryConflictPendingKeys:()=>({pageIds:new Set(),codes:new Set()}),
    inventoryConflictDiff:(a,b)=>a.note===b.note?[]:[{key:'note',label:'備註',supabase:a.note,notion:b.note}],
    normalizeSku:x=>String(x||'').toUpperCase(),showToast:()=>{},
  });
  vm.runInContext(extract('async function scanInventoryNotionConflicts(', 'function renderInventoryConflictCenter('),c);
  const result=await c.scanInventoryNotionConflicts({quiet:true});
  assert.equal(result.conflicts.length,0);
  assert.equal(result.metadataOnly.length,1);
  assert.equal(result.codeFormatting.length,1);
  assert.equal(result.codeFormatting[0].rawCode,'');
});

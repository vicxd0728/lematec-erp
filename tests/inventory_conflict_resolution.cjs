const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
function setup(){
  const base={id:'page1',notionId:'page1',code:'Y-A',name:'Part',type:'零件',unit:'個',safe:0,note:'',balanceVersion:'2026-09-07T00:00:00Z'};
  const state={s:{...base,stock:10},n:{...base,stock:15},writes:[],moves:[],toasts:[],storage:new Map(),failMove:false,scanFail:false};
  const clone=x=>JSON.parse(JSON.stringify(x));
  const c=vm.createContext({crypto:webcrypto,globalThis:undefined,ROLE:'vic',TOKEN:'mock',CURRENT_TAB:'health',mats:[],
    isAdminRole:()=>true,canonicalPageId:x=>String(x||'').replace(/-/g,''),normalizeSku:x=>x,
    localStorage:{getItem:k=>state.storage.get(k)||null,setItem:(k,v)=>state.storage.set(k,v),removeItem:k=>state.storage.delete(k)},
    showToast:(message,type)=>state.toasts.push({message,type}),confirm:()=>true,renderTab:()=>{},
    fetchWorkerInventoryMaterials:async()=>[clone(state.s)],
    notionProxyRequest:async()=>({object:'page',...clone(state.n)}),mapNotionMaterialPage:x=>x,
    buildInventoryMirrorTask:(kind,payload)=>({kind,payload}),
    postInventoryMirrorTask:async task=>{Object.assign(state.s,{name:task.payload.name,type:task.payload.type,unit:task.payload.unit,safe:task.payload.safe,note:task.payload.note});},
    updatePage:async(id,props)=>{state.writes.push(props);state.n={...state.n,stock:props['目前庫存'].number};return {object:'page',id};},
    assertNotionPage:r=>{if(r?.object!=='page')throw Error('page write failed');return r;},
    applyInventoryDeltaAndMirror:async(id,args)=>{state.moves.push(args);if(state.failMove){state.failMove=false;throw Error('offline');}const before=state.s.stock;state.s.stock+=args.delta;state.n.stock=state.s.stock;return {before,after:state.s.stock};},
    logStockChangeQuietly:async()=>{},loadSupabaseInventoryForPage:async()=>{},
    scanInventoryNotionConflicts:async()=>state.scanFail?null:{conflicts:state.s.stock===state.n.stock?[]:[{code:'Y-A'}],pending:[]},
  });
  c.globalThis=c;
  const refresh=()=>{c._inventoryConflictReport={conflicts:[{code:'Y-A',supabase:clone(state.s),notion:clone(state.n),diffs:[]}]};};
  refresh();
  vm.runInContext(cut('function inventoryConflictDiff','function inventoryConflictPendingKeys')+cut('const INVENTORY_CONFLICT_OPERATION_KEY','function notesHealthTime'),c);
  return {state,c,refresh};
}
test('stale scan never overwrites Notion',async()=>{
  const {state,c}=setup();state.s.stock=9;
  await c.resolveInventoryConflict('Y-A','supabase');assert.equal(state.writes.length,0);assert.equal(state.toasts.at(-1).type,'err');
});
test('changes during confirmation prevent writes',async()=>{
  const {state,c}=setup();c.confirm=()=>{state.s.stock=8;return true;};
  await c.resolveInventoryConflict('Y-A','supabase');assert.equal(state.writes.length,0);
});
test('fresh Supabase value is mirrored and verified',async()=>{
  const {state,c}=setup();await c.resolveInventoryConflict('Y-A','supabase');
  assert.equal(state.n.stock,10);assert.equal(state.toasts.at(-1).type,'ok');assert.equal(state.storage.size,0);
});
test('remaining difference is not reported as success and retries do not write again',async()=>{
  const {state,c}=setup();c.updatePage=async()=>({object:'page',id:'page1'});
  await c.resolveInventoryConflict('Y-A','supabase');assert.equal(state.toasts.at(-1).type,'err');
  let called=false;c.updatePage=async()=>{called=true;};await c.resolveInventoryConflict('Y-A','supabase');assert.equal(called,false);
});
test('failed total readback retains operation and does not claim success',async()=>{
  const {state,c}=setup();state.scanFail=true;await c.resolveInventoryConflict('Y-A','supabase');
  assert.equal(state.storage.size,1);assert.equal(state.toasts.at(-1).type,'err');
  state.scanFail=false;await c.resolveInventoryConflict('Y-A','supabase');assert.equal(state.storage.size,0);assert.equal(state.writes.length,1);
});
test('distinct same-day identical deltas use distinct operation IDs',async()=>{
  const {state,c,refresh}=setup();await c.resolveInventoryConflict('Y-A','notion');
  state.n.stock=20;refresh();await c.resolveInventoryConflict('Y-A','notion');
  assert.equal(state.moves.length,2);assert.equal(state.moves[0].delta,5);assert.equal(state.moves[1].delta,5);
  assert.notEqual(state.moves[0].sourceId,state.moves[1].sourceId);assert.equal(state.s.stock,20);
});
test('failed request retries with original operation ID and delta',async()=>{
  const {state,c}=setup();state.failMove=true;await c.resolveInventoryConflict('Y-A','notion');await c.resolveInventoryConflict('Y-A','notion');
  assert.equal(state.moves.length,2);assert.equal(state.moves[0].sourceId,state.moves[1].sourceId);assert.equal(state.s.stock,15);
});
test('lost response after accepted quantity does not replay the delta',async()=>{
  const {state,c}=setup();c.applyInventoryDeltaAndMirror=async(id,args)=>{state.moves.push(args);state.s.stock+=args.delta;throw Error('lost response');};
  await c.resolveInventoryConflict('Y-A','notion');await c.resolveInventoryConflict('Y-A','notion');
  assert.equal(state.s.stock,15);assert.equal(state.moves.length,1);
});
test('storage failure prevents any write',async()=>{
  const {state,c}=setup();c.localStorage.setItem=()=>{throw Error('quota');};await c.resolveInventoryConflict('Y-A','notion');
  assert.equal(state.moves.length,0);assert.equal(state.writes.length,0);
});
test('double click cannot submit two quantity operations',async()=>{
  const {state,c}=setup();await Promise.all([c.resolveInventoryConflict('Y-A','notion'),c.resolveInventoryConflict('Y-A','notion')]);assert.equal(state.moves.length,1);
});
test('relinked material or unreadable page prevents writes',async()=>{
  const {state,c}=setup();state.s.notionId='other';await c.resolveInventoryConflict('Y-A','notion');assert.equal(state.moves.length,0);
});
test('persisted operation survives reload and retains its ID',async()=>{
  const first=setup();first.state.failMove=true;await first.c.resolveInventoryConflict('Y-A','notion');
  const second=setup();second.state.storage=new Map(first.state.storage);
  await second.c.resolveInventoryConflict('Y-A','notion');
  assert.equal(first.state.moves[0].sourceId,second.state.moves[0].sourceId);
});
test('unrelated stock movement after failed attempt blocks retry',async()=>{
  const {state,c}=setup();state.failMove=true;await c.resolveInventoryConflict('Y-A','notion');
  state.s.stock=8;await c.resolveInventoryConflict('Y-A','notion');assert.equal(state.moves.length,1);assert.equal(state.s.stock,8);
});
test('SKU-only differences are detected',()=>{
  const {c,state}=setup();assert.equal(c.inventoryConflictDiff(state.s,{...state.s,code:'Y-B'})[0].key,'code');
});
test('quantity request carries the original expected stock and version',async()=>{
  const {c,state}=setup();await c.resolveInventoryConflict('Y-A','notion');
  assert.equal(state.moves[0].expectedStock,10);assert.equal(state.moves[0].expectedBalanceVersion,'2026-09-07T00:00:00Z');
});
test('definitive database conflict permits fresh confirmation; unknown failures retain ID',async()=>{
  const {c,state}=setup();c.applyInventoryDeltaAndMirror=async()=>{const e=Error('stale');e.code='inventory_conflict';throw e;};
  await c.resolveInventoryConflict('Y-A','notion');assert.equal(state.storage.size,0);assert.equal(state.s.stock,10);
});

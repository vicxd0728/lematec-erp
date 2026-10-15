const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));
function setup(){
  const redraws=[],requests=[];
  const ctx=vm.createContext({window:{},CURRENT_TAB:'picking',picks:[],inbounds:[],DB:{pickMaster:'picks',inbound:'inbound'},
    renderLoadedTab:tab=>redraws.push(tab),console:{warn(){}},escapeHtml:v=>String(v).replaceAll('<','&lt;').replaceAll('>','&gt;'),
    markLoaded:scope=>ctx.window['_'+scope+'Loaded']=true,mapSupabasePick:row=>row,mapSupabaseInbound:row=>row,mapNotionInbound:row=>row,
    pickingWorkerRequest:async url=>{requests.push(url);return {rows:[{id:'new'}]};},dbQueryAll:async()=>[],
    repairPendingPickingMirrors:()=>{},repairPendingInboundMirrors:()=>{},showToast:()=>{}});
  vm.runInContext(section('function operationalReadState(','const _pickingMirrorJobs=')+section('function loadInbounds(){','const _inboundMirrorJobs='),ctx);
  return {ctx,requests,redraws};
}
test('initial read state distinguishes unknown from loaded empty and escapes errors',()=>{
  const {ctx}=setup();let state=ctx.operationalReadState('picks',[]);assert.equal(state.ready,false);
  let out=ctx.renderOperationalReadPlaceholder('picks','領料',state);assert.match(out,/尚未載入/);assert.doesNotMatch(out,/已載入 0|尚無訂單領料/);
  ctx.window._picksLoaded=true;assert.equal(ctx.operationalReadState('picks',[]).ready,true);
  out=ctx.renderOperationalReadPlaceholder('picks','領料',{error:'<img>',ready:false});assert.match(out,/&lt;img&gt;/);assert.match(out,/重新讀取領料清單/);assert.doesNotMatch(out,/<img>/);
});
test('concurrent picking reads share one request and settle loading with an accepted snapshot',async()=>{
  const f=setup(),a=f.ctx.loadPicks(),b=f.ctx.loadPicks();assert.equal(a,b);assert.equal(f.ctx.window._operationalReads.picks.loading,true);
  await a;assert.equal(f.requests.length,1);assert.equal(f.ctx.picks[0].id,'new');assert.equal(f.ctx.window._pickingDataSource,'supabase');
  assert.equal(f.ctx.window._operationalReads.picks.loading,false);assert.equal(f.ctx.operationalReadState('picks',f.ctx.picks).ready,true);
});
test('both sources failing preserve the old snapshot and retry restores the source state',async()=>{
  for(const scope of ['picks','inbounds']){
    const f=setup(),c=f.ctx;c.CURRENT_TAB=scope==='picks'?'picking':'inbound';c[scope]=[{id:'old'}];c.window['_'+scope+'Loaded']=true;
    c.pickingWorkerRequest=async()=>{throw Error('primary failed');};c.dbQueryAll=async()=>{throw Error('fallback failed');};
    await assert.rejects(c[scope==='picks'?'loadPicks':'loadInbounds'](),/fallback failed/);
    assert.equal(c[scope][0].id,'old');assert.equal(c.window._operationalReads[scope].loading,false);assert.match(c.window._operationalReads[scope].error,/fallback failed/);
    assert.match(c.renderOperationalReadNotice(scope,'清單',c.operationalReadState(scope,c[scope])),/保留上次資料/);
    c.pickingWorkerRequest=async()=>({rows:[{id:'recovered'}]});assert.equal(await c.retryOperationalRead(scope),true);
    assert.equal(c[scope][0].id,'recovered');assert.equal(c.window._operationalReads[scope].error,'');
  }
});
test('successful empty fallback remains a known empty readonly source rather than an error',async()=>{
  const {ctx}=setup();ctx.CURRENT_TAB='inbound';ctx.pickingWorkerRequest=async()=>{throw Error('offline');};
  await ctx.loadInbounds();assert.equal(ctx.window._inboundDataSource,'notion-fallback');assert.equal(ctx.operationalReadState('inbounds',ctx.inbounds).ready,true);assert.equal(ctx.window._operationalReads.inbounds.error,'');
});
test('read completion on another page never requests a redraw and retry allowlist blocks unknown scope',async()=>{
  const f=setup();f.ctx.CURRENT_TAB='orders';await f.ctx.loadPicks();assert.deepEqual(f.redraws,[]);assert.equal(await f.ctx.retryOperationalRead('orders'),false);assert.equal(f.requests.length,1);
});

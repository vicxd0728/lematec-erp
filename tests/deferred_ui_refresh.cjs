const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));
function setup(){
  const rendered=[],patched=[],timers=new Map(),listeners={};let serial=0;
  const ctx=vm.createContext({window:{},CURRENT_TAB:'picking',document:{activeElement:{id:'pickingSearch'},body:{dataset:{}},addEventListener:(name,fn)=>listeners[name]=fn},
    isModalOpen:()=>false,isEditingNow:()=>true,renderPicking:()=>'',renderInbound:()=>'',renderTab:tab=>rendered.push(tab),
    refreshOperationalListRegions:(ids)=>{patched.push(ids);return true;},setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(section('// A completed read must eventually','function initAutoSync('),ctx);
  return {ctx,rendered,patched,listeners,flush(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}};
}
test('completed picking read refreshes rows/counts while keeping the active search untouched',()=>{
  const f=setup(),input=f.ctx.document.activeElement;input.value='PK';input.selectionStart=1;
  assert.equal(f.ctx.renderLoadedTab('picking'),true);assert.equal(f.rendered.length,0);assert.equal(f.patched.length,1);
  assert.equal(f.ctx.document.activeElement,input);assert.equal(input.value,'PK');assert.equal(input.selectionStart,1);assert.equal(f.ctx.window._pendingTabRefresh,'');
});
test('inbound read patches only matching page regions and does not steal another form focus',()=>{
  const f=setup();f.ctx.CURRENT_TAB='inbound';f.ctx.document.activeElement.id='inboundSearch';
  f.ctx.renderLoadedTab('inbound');assert.deepEqual([...f.patched[0]],['inboundReadNotice','inboundCreateAction','inboundStatusCounts','inboundResults']);
  f.ctx.document.activeElement.id='unrelatedDraft';assert.equal(f.ctx.renderLoadedTab('inbound'),false);assert.equal(f.patched.length,1);assert.equal(f.rendered.length,0);
});
test('composition defers a completed read until final text is applied',()=>{
  const f=setup();f.ctx.document.activeElement._composing=true;
  assert.equal(f.ctx.renderLoadedTab('picking'),false);assert.equal(f.patched.length,0);
  f.ctx.document.activeElement._composing=false;f.listeners.compositionend();f.flush();assert.equal(f.patched.length,1);
});
test('a focused generic draft delays render, then blur flushes exactly once',()=>{
  const f=setup();f.ctx.CURRENT_TAB='orders';f.ctx.renderLoadedTab('orders');assert.equal(f.rendered.length,0);
  f.ctx.isEditingNow=()=>false;f.listeners.focusout();f.listeners.focusout();f.flush();assert.deepEqual(f.rendered,['orders']);
  f.listeners.focusout();f.flush();assert.equal(f.rendered.length,1);
});
test('modal or busy operation prevents a refresh and stale tabs cannot repaint current content',()=>{
  const f=setup();f.ctx.isModalOpen=()=>true;f.ctx.renderLoadedTab('picking');assert.equal(f.patched.length,0);
  f.ctx.isModalOpen=()=>false;f.ctx.document.body.dataset.busy='1';f.ctx.renderLoadedTab('picking');assert.equal(f.patched.length,0);
  f.ctx.CURRENT_TAB='inventory';assert.equal(f.ctx.renderLoadedTab('picking'),false);f.ctx.scheduleDeferredTabRefresh();f.flush();assert.equal(f.rendered.length,0);assert.equal(f.ctx.window._pendingTabRefresh,'');
});
test('missing safe regions never force-replace the active input; blur remains a recovery',()=>{
  const f=setup();f.ctx.refreshOperationalListRegions=()=>false;f.ctx.renderLoadedTab('picking');assert.equal(f.rendered.length,0);
  f.ctx.isEditingNow=()=>false;f.listeners.focusout();f.flush();assert.deepEqual(f.rendered,['picking']);
});
function progressSetup(){
  const ctx=vm.createContext({CURRENT_TAB:'schedule',window:{},renderTab:()=>{},orders:[{id:'source'}]});
  vm.runInContext(section('const SUPPLY_WORK_TYPES=','let schedules = [];'),ctx);return ctx;
}
test('progress draft survives filtering independently of applied query and reset clears both',()=>{
  const c=progressSetup();c.setProgressCenterSearch('applied');vm.runInContext("progressCenterSearchDraft='未送出';progressOrderVisibleLimit=80",c);c.setProgressCenterFilter('overdue');
  assert.equal(vm.runInContext('progressCenterSearchDraft',c),'未送出');assert.equal(vm.runInContext('progressCenterSearch',c),'applied');assert.equal(vm.runInContext('progressOrderVisibleLimit',c),40);
  c.progressResetFilters();assert.equal(vm.runInContext('progressCenterSearchDraft+progressCenterSearch',c),'');
});
test('supply draft survives sort/status changes; explicit resets clear it while keeping order context',()=>{
  const c=progressSetup();c.supplySetSearch('applied');vm.runInContext("supplySearchDraft='未送出';supplyOrderContext='source'",c);c.supplySetSort('updated');c.supplySetFilter('closed');
  assert.equal(vm.runInContext('supplySearchDraft',c),'未送出');assert.equal(vm.runInContext('supplySearch',c),'applied');c.supplyResetFilters();
  assert.equal(vm.runInContext('supplySearchDraft+supplySearch',c),'');assert.equal(vm.runInContext('supplyOrderContext',c),'source');
});
test('progress and supply Enter never submit a composing text candidate',()=>{
  for(const id of ['progressOrderSearch','supplySearch']){
    const line=html.split('\n').find(line=>line.includes('id="'+id+'"'));
    const handler=line.match(/onkeydown="([^"]+)"/)[1];let called=0;
    const c=vm.createContext({event:{key:'Enter',isComposing:true,preventDefault(){}},setProgressCenterSearch:()=>called++,supplySetSearch:()=>called++});
    vm.runInContext(`(function(){${handler}}).call({value:'接',_composing:false})`,c);assert.equal(called,0);
    c.event.isComposing=false;vm.runInContext(`(function(){${handler}}).call({value:'接頭',_composing:false})`,c);assert.equal(called,1);
  }
});

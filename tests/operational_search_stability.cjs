const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const section=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));
function setup(ids,missing=''){
 let full=0,focus=0;
 const input={value:'Y-GAH',selectionStart:2,selectionEnd:4,focus(){focus++},setSelectionRange(){}};
 const nodes=Object.fromEntries(ids.map(id=>[id,{innerHTML:'old'}]));
 const ctx=vm.createContext({window:{_PICK_PAGE:4},SORT:{},document:{activeElement:input,getElementById:id=>nodes[id]||(['pickingSearch','inboundSearch'].includes(id)?input:null),createElement:()=>({set innerHTML(v){},content:{querySelector:s=>s==='#'+missing?null:{innerHTML:s+' new'}}})},renderPicking:()=>'<fixture>',renderInbound:()=>'<fixture>',renderTab:()=>full++});
 vm.runInContext(section('function refreshOperationalListRegions(','function pickingSearchRows('),ctx);
 vm.runInContext(section('function updatePickingSearch(','function resetPickingFilters('),ctx);
 vm.runInContext(section('function inboundListFilters(','function changeInboundPage('),ctx);
 return {ctx,input,nodes,full:()=>full,focus:()=>focus};
}
test('picking typing updates counts/overview/results without replacing focused input or range',()=>{
 const f=setup(['pickingOverview','pickingStatusFilters','pickingResults']);f.ctx.updatePickingSearch(f.input);
 assert.equal(f.full(),0);assert.equal(f.focus(),0);assert.equal(f.ctx.document.activeElement,f.input);assert.equal(f.input.selectionStart,2);assert.equal(f.input.selectionEnd,4);assert.equal(f.ctx.window._PICK_PAGE,1);assert.equal(f.ctx.window._PICK_Q,'Y-GAH');
 for(const node of Object.values(f.nodes))assert.notEqual(node.innerHTML,'old');
});
test('inbound typing updates counts and rows while retaining date/status and focused input',()=>{
 const f=setup(['inboundStatusCounts','inboundResults']);Object.assign(f.ctx.inboundListFilters(),{date:'3',status:'returned',page:7});f.ctx.updateInboundSearch(f.input);
 assert.equal(f.full(),0);assert.equal(f.ctx.inboundListFilters().date,'3');assert.equal(f.ctx.inboundListFilters().status,'returned');assert.equal(f.ctx.inboundListFilters().page,1);assert.equal(f.ctx.inboundListFilters().q,'Y-GAH');assert.equal(f.ctx.document.activeElement,f.input);
});
test('composition does not redraw or apply partial search; final text applies once ended',()=>{
 for(const mode of ['picking','inbound']){const ids=mode==='picking'?['pickingOverview','pickingStatusFilters','pickingResults']:['inboundStatusCounts','inboundResults'];const f=setup(ids);f.input._composing=true;f.input.value='接';f.ctx[mode==='picking'?'updatePickingSearch':'updateInboundSearch'](f.input);for(const node of Object.values(f.nodes))assert.equal(node.innerHTML,'old');
 f.input._composing=false;f.input.value='接頭';f.ctx[mode==='picking'?'updatePickingSearch':'updateInboundSearch'](f.input);assert.equal(mode==='picking'?f.ctx.window._PICK_Q:f.ctx.inboundListFilters().q,'接頭');assert.equal(f.full(),0);}
});
test('missing replacement aborts before partial DOM changes and falls back to original render',()=>{
 const f=setup(['pickingOverview','pickingStatusFilters','pickingResults'],'pickingResults');f.ctx.updatePickingSearch(f.input);assert.equal(f.full(),1);assert.equal(f.focus(),1);for(const node of Object.values(f.nodes))assert.equal(node.innerHTML,'old');
});
test('mobile sort uses numeric quantity ordering type and retains query/order focus',()=>{
 const f=setup([]);f.ctx.window._PICK_Q='SKU';f.ctx.window._PICK_FOCUS_ORDER='order';f.ctx.setPickingMobileSort('qty:asc');assert.equal(f.ctx.SORT.picking.type,'num');assert.equal(f.ctx.window._PICK_Q,'SKU');assert.equal(f.ctx.window._PICK_FOCUS_ORDER,'order');assert.equal(f.ctx.window._PICK_PAGE,1);
 f.ctx.setPickingMobileSort('__proto__:asc');assert.equal(f.ctx.SORT.picking.col,'qty');f.ctx.setPickingMobileSort('date:invalid');assert.equal(f.ctx.SORT.picking.col,'qty');f.ctx.setPickingMobileSort('');assert.equal(f.ctx.SORT.picking,undefined);
});
test('manual mobile context shows escaped purpose and date without inventing an order link',()=>{
 const ctx=vm.createContext({orders:[],canonicalPageId:v=>v,escapeHtml:v=>String(v).replaceAll('<','&lt;').replaceAll('>','&gt;')});vm.runInContext(section('function pickingSourceOrderLink(','function renderPicking('),ctx);
 const out=ctx.pickingSourceOrderLink({note:'補料 <img>',date:'2026-10-15'});assert.match(out,/用途／備註：補料 &lt;img&gt;/);assert.match(out,/日期：2026-10-15/);assert.doesNotMatch(out,/openPickingSourceOrder/);
});

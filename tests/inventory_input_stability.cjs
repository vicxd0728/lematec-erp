const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {test}=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const section=source.slice(source.indexOf('function _invFilter('),source.indexOf('let _mpItems=',source.indexOf('function _invFilter(')));
function setup(regions=true){
 const input={value:'Y-',selectionStart:1,selectionEnd:2,focused:0,focus(){this.focused++},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b}};
 const summary={innerHTML:'old summary'},results={innerHTML:'old rows'};let fullWrites=0;
 const main={scrollTo(){},set innerHTML(v){fullWrites++}};
 const elements={inv_q:input,mainContent:main,...regions?{invResultSummary:summary,invResults:results}:{}};
 const ctx=vm.createContext({window:{_invState:{q:'',page:3,pageSize:100}},document:{activeElement:input,getElementById:id=>elements[id],createElement:()=>({set innerHTML(v){},content:{querySelector:selector=>({innerHTML:selector==='#invResults'?'new rows':'new summary'})}})},renderInventory:()=>'<div>fixture</div>'});
 vm.runInContext(section,ctx);return {ctx,input,summary,results,fullWrites:()=>fullWrites};
}
test('query updates replace only result regions and keep the original focused input and selection',()=>{
 const f=setup();f.ctx._invFilter('q','Y-');assert.equal(f.fullWrites(),0);assert.equal(f.results.innerHTML,'new rows');assert.equal(f.summary.innerHTML,'new summary');
 assert.equal(f.ctx.document.getElementById('inv_q'),f.input);assert.equal(f.ctx.document.activeElement,f.input);assert.equal(f.input.focused,0);assert.equal(f.input.selectionStart,1);assert.equal(f.input.selectionEnd,2);assert.equal(f.ctx.window._invState.page,1);
});
test('quantity bound typing uses the same stable input path',()=>{
 const f=setup();f.ctx._invFilter('stockMin','0.03');f.ctx._invFilter('stockMax','100');assert.equal(f.fullWrites(),0);assert.equal(f.ctx.window._invState.stockMin,'0.03');assert.equal(f.ctx.window._invState.stockMax,'100');
});
test('missing result regions recover through full render instead of losing updates',()=>{
 const f=setup(false);f.ctx._invFilter('q','Y-X');assert.equal(f.fullWrites(),1);assert.equal(f.input.focused,1);assert.equal(f.ctx.window._invState.q,'Y-X');
});
test('reset rebuilds controls, clears all filters and preserves configured page size',()=>{
 const f=setup();f.ctx.window._invState.pageSize=200;f.ctx._invReset();assert.equal(f.fullWrites(),1);assert.equal(f.ctx.window._invState.pageSize,200);assert.equal(f.ctx.window._invState.q,'');assert.equal(f.ctx.window._invState.page,1);
});

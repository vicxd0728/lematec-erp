const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function section(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert(a>=0&&b>a,`${start} missing`);
 return html.slice(a,b);
}
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function manualSetup({code='Y-A',name='A',qty='12',mats=[{id:'page-a',code:'Y-A',name:'A',type:'零件',stock:20}]}={}){
 const calls=[];
 const fields={mp_new_code:{value:code},mp_new_name:{value:name},mp_new_type:{value:'零件'},
  mp_new_qty:{value:qty},mp_search:{value:''},mp_type:{value:''},mp_items:{innerHTML:''},mp_list:{innerHTML:''}};
 const ctx=vm.createContext({_mpItems:[],mats,document:{getElementById:id=>fields[id]||null},
  findMatBySku:sku=>mats.find(m=>m.code===sku)||null,
  createMaterialFromSku:async sku=>{calls.push(['create',sku]);const mat={id:'new-page',code:sku,name:sku,type:'零件',stock:0};mats.push(mat);return mat;},
  showToast:(...args)=>calls.push(['toast',...args]),escapeHtml});
 vm.runInContext(section('function filterManualPickList(q){','async function submitManualPick(){'),ctx);
 return {ctx,calls,fields};
}

test('manual picking keeps the entered quantity for an existing SKU',async()=>{
 const h=manualSetup();
 await h.ctx.addManualPickNewItem();
 assert.equal(h.ctx._mpItems.length,1);
 assert.equal(h.ctx._mpItems[0].qty,12);
 assert.equal(h.ctx._mpItems[0].matId,'page-a');
 assert.equal(h.calls.filter(x=>x[0]==='create').length,0);
});

test('manual picking does not match a different SKU only because its name is equal',async()=>{
 const h=manualSetup({code:'Y-NEW',name:'A',qty:'7'});
 await h.ctx.addManualPickNewItem();
 assert.deepEqual(h.calls.filter(x=>x[0]==='create').map(x=>x[1]),['Y-NEW']);
 assert.equal(h.ctx._mpItems[0].matId,'new-page');
 assert.equal(h.ctx._mpItems[0].qty,7);
});

test('manual picking rejects invalid quantities before creating a SKU or pick',async()=>{
 for(const qty of ['', '0', '-1', '1.5', 'bad']){
  const h=manualSetup({code:'Y-NEW',qty});
  await h.ctx.addManualPickNewItem();
  assert.equal(h.ctx._mpItems.length,0,`quantity ${qty}`);
  assert.equal(h.calls.filter(x=>x[0]==='create').length,0,`quantity ${qty}`);
 }
 const calls=[];
 const ctx=vm.createContext({_mpItems:[{matId:'page-a',code:'Y-A',qty:0}],window:{},
  showToast:(...args)=>calls.push(args)});
 vm.runInContext(section('async function submitManualPick(){','const _manualPickLocks='),ctx);
 await ctx.submitManualPick();
 assert.ok(calls.some(x=>/無效補料數量/.test(x[0])));
});

test('manual picking rejects a total quantity beyond safe integer range',async()=>{
 const calls=[];
 const ctx=vm.createContext({_mpItems:[
  {matId:'a',code:'Y-A',qty:Number.MAX_SAFE_INTEGER},
  {matId:'b',code:'Y-B',qty:1},
 ],window:{},showToast:(...args)=>calls.push(args)});
 vm.runInContext(section('async function submitManualPick(){','const _manualPickLocks='),ctx);
 await ctx.submitManualPick();
 assert.ok(calls.some(x=>/總數量超出/.test(x[0])));
});

test('manual picking escapes material text in search and selected rows',()=>{
 const h=manualSetup({mats:[{id:'page-a',code:'Y-<img>',name:'<svg>',type:'零件',stock:1}]});
 h.ctx.filterManualPickList('');
 assert.match(h.fields.mp_list.innerHTML,/Y-&lt;img&gt;/);
 assert.doesNotMatch(h.fields.mp_list.innerHTML,/<svg>/);
 h.ctx.addManualPickItem('page-a',1);
 assert.match(h.fields.mp_items.innerHTML,/&lt;svg&gt;/);
 assert.doesNotMatch(h.fields.mp_items.innerHTML,/<svg>/);
});

test('manual C-end order rejects zero, blank and fractional quantities before any write',async()=>{
 const submit=section('let CORDER_SUBMIT_BUSY=false;','function buildCorderImportPreflight(');
 for(const qty of ['', '0', '-1', '1.5', 'bad']){
  const calls=[];
  const fields={co_mat:{value:'s1'},co_qty:{value:qty}};
  const ctx=vm.createContext({document:{getElementById:id=>fields[id]||null},
   showToast:(...args)=>calls.push(['toast',...args]),mats:[{id:'s1',code:'S-TEST'}],
   ensureCorderSequenceReady:async()=>calls.push(['sequence']),
   loadCoreEssentials:async()=>calls.push(['core'])});
  vm.runInContext(submit,ctx);
  await ctx.submitCorder();
  assert.ok(calls.some(x=>x[0]==='toast'&&/大於 0 的整數/.test(x[1])),`quantity ${qty}`);
  assert.equal(calls.some(x=>x[0]==='sequence'||x[0]==='core'),false,`quantity ${qty}`);
 }
});

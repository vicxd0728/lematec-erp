const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

function section(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert(a>=0&&b>a,`${start} section missing`);
 return html.slice(a,b);
}

function form(){
 const elements={};
 for(const id of ['m_sfg_sel','m_sfg_search','sfgSearchResults','sfgSearchMsg','sfgBomList','m_sfg_qty','m_note'])
  elements[id]={value:'',style:{},innerHTML:'',textContent:''};
 const mats=[{id:'a',code:'AI303-R1',name:'AI303-R1',type:'半成品'},
  {id:'b',code:'AI303-R2',name:'AI303-R2',type:'半成品'}];
 const calls=[];
 const context=vm.createContext({mats,document:{getElementById:id=>elements[id]||null},
  escapeHtml:x=>String(x),normalizeSku:x=>String(x||'').toUpperCase().replace(/\s/g,''),
  showToast:(...args)=>calls.push(['toast',...args]),closeModal:()=>{},todayStr:()=> '2026-09-26',
  notionAPI:async(...args)=>{calls.push(['write',...args]);return {id:'order'};},
  logUserAction:()=>{},refreshAffectedData:async()=>{},DB:{orders:'orders'},ROLE:'sales'});
 vm.runInContext(section('function filterSfgList(q){','function renderItems(){'),context);
 vm.runInContext(section('async function submitSFGOrder(){','async function loadCorders('),context);
 return {context,elements,mats,calls};
}

test('exact typed assembly SKU selects its material without a second dropdown action',()=>{
 const h=form();h.elements.m_sfg_qty.value='100';
 h.context.filterSfgList('ai303-r1');
 assert.equal(h.elements.m_sfg_sel.value,'a');
 assert.equal(h.elements.m_sfg_search.value,'AI303-R1');
 assert.match(h.elements.sfgBomList.innerHTML,/× <b>100<\/b>/);
 h.context.filterSfgList('AI303-');
 assert.equal(h.elements.m_sfg_sel.value,'');
 assert.match(h.elements.sfgSearchResults.innerHTML,/selectSfgMaterial/);
});

test('assembly creation writes the visible quantity and rejects invalid numbers',async()=>{
 const h=form();h.elements.m_sfg_qty.value='100';h.context.selectSfgMaterial('a');
 await h.context.submitSFGOrder();
 const write=h.calls.find(x=>x[0]==='write');
 assert.equal(write[3].properties['訂購數量'].number,100);
 for(const invalid of ['0','1.5','']){
  const next=form();next.elements.m_sfg_qty.value=invalid;next.context.selectSfgMaterial('a');
  await next.context.submitSFGOrder();
  assert.equal(next.calls.some(x=>x[0]==='write'),false);
 }
});

test('picking preview places the real shortage above sufficient materials',()=>{
 const modal={innerHTML:''};let report;
 const ctx=vm.createContext({orders:[{id:'order',no:'SFG-2609-3581',qty:1}],
  document:{getElementById:()=>modal},showToast:()=>{},
  resolveOrderPickPlan:()=>({prod:{code:'Z-SKC-A-03AS-1ABFH',stock:0},production:true,items:[
   {id:'good',code:'Y-SBG-06Q',name:'Y-SBG-06Q',stock:3520,needed:1},
   {id:'short',code:'F-SKC-A-01AS-2',name:'F-SKC-A-01AS-2',stock:0,needed:1}]}),
  renderPreflightCenter:x=>{report=x;return '';},openModal:()=>{},_bomDataSource:'supabase',escapeHtml:x=>String(x)});
 vm.runInContext(section('function openPickModal(orderId){','// ══ 品管檢驗單'),ctx);
 ctx.openPickModal('order');
 assert.equal(report.errors,1);
 assert.equal(report.rows[0].lineLabel,'F-SKC-A-01AS-2');
 assert.match(report.rows[0].detail,/需要 1，現有 0，缺少 1/);
 assert.match(modal.innerHTML,/無法領料：部分 BOM 子件庫存不足/);
 assert.match(modal.innerHTML,/F-SKC-A-01AS-2<\/b>：需要 1，現有 0，缺少 1/);
 assert.match(modal.innerHTML,/庫存沒有因這次預覽而變動/);
 assert.match(modal.innerHTML,/disabled/);
});

test('missing BOM child is explained separately from stock shortage',()=>{
 const modal={innerHTML:''};
 const ctx=vm.createContext({orders:[{id:'order',qty:1}],document:{getElementById:()=>modal},
  showToast:()=>{},resolveOrderPickPlan:()=>({prod:{code:'parent'},production:true,items:[
   {id:'short',code:'F-SKC-A-01AS-2',stock:0,needed:1},
   {id:'',code:'Y-MISSING',missing:true,stock:0,needed:1}]}),
  renderPreflightCenter:()=>'',openModal:()=>{},_bomDataSource:'supabase',escapeHtml:x=>String(x)});
 vm.runInContext(section('function openPickModal(orderId){','// ══ 品管檢驗單'),ctx);
 ctx.openPickModal('order');
 assert.match(modal.innerHTML,/部分 BOM 子件庫存不足，且有子件未建檔/);
 assert.match(modal.innerHTML,/Y-MISSING<\/b>：BOM 子料號尚未建檔/);
 assert.match(modal.innerHTML,/disabled/);
});

const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function setup(no='CYB115'){
 const fields={},writes=[],queries=[];
 const order={id:'page-1',no,buyer:'buyer',matCode:'S-Y-L-30',qty:1,status:'已完成'};
 const ctx=vm.createContext({window:{corders:[order,{...order,id:'page-2'}]},
 document:{getElementById:id=>fields[id]??(fields[id]={value:'',innerHTML:''})},
 escapeHtml:s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'),
 openModal:()=>{},closeModal:()=>{},showToast:()=>{},renderTab:()=>{},loadCorders:async()=>{},
 updatePage:async(id,props)=>writes.push({id,props}),DB:{corders:'db'},
 notionAPI:async(...args)=>{queries.push(args);return {results:[]};}});
 vm.runInContext(html.slice(html.indexOf('function openEditCorder('),html.indexOf('async function deleteCorder(')),ctx);
 for(const [id,value] of Object.entries({eco_order_no:no,eco_buyer:'buyer',eco_mat:'S-Y-L-30',eco_qty:'1',eco_status:'已完成',eco_note:'changed note',eco_tracking:'new tracking'}))fields[id]={value};
 return {ctx,fields,writes,queries,order};
}
for(const no of ['CYB115','SHPTW100','SHPTW17000','AB-00115']){
 test('editing preserves full number '+no+' without allocation or duplicate check',async()=>{
  const t=setup(no);t.ctx.openEditCorder('page-1');
  assert(t.fields.modalInner.innerHTML.includes('value="'+no+'"'));
  assert(!t.fields.modalInner.innerHTML.includes('eco_order_serial'));
  await t.ctx.saveEditCorder('page-1');
  assert.equal(t.writes.length,1);assert.equal(t.writes[0].props['訂單號碼'].title[0].text.content,no);
  assert.equal(t.writes[0].props['寄件編號'].rich_text[0].text.content,'new tracking');
  assert.equal(t.queries.length,0);
 });
}
test('deliberate renumber checks duplicates and retains full entered number',async()=>{
 const t=setup();t.fields.eco_order_no.value='CYB116';await t.ctx.saveEditCorder('page-1');
 assert.equal(t.queries[0][2].filter.title.equals,'CYB116');
 assert.equal(t.queries[0][2].filter.property,'訂單號碼');
 assert.equal(t.writes[0].props['訂單號碼'].title[0].text.content,'CYB116');
});
test('duplicate renamed number and empty input prevent writes',async()=>{
 const t=setup();t.ctx.notionAPI=async()=>({results:[{id:'another-page'}]});
 t.fields.eco_order_no.value='CYB116';await t.ctx.saveEditCorder('page-1');assert.equal(t.writes.length,0);
 t.fields.eco_order_no.value=' ';await t.ctx.saveEditCorder('page-1');assert.equal(t.writes.length,0);
});
test('edit continues to reject quantity, product and status changes',async()=>{
 for(const [field,value] of [['eco_qty','2'],['eco_mat','S-OTHER'],['eco_status','已取消']]){
  const t=setup();t.fields[field].value=value;await t.ctx.saveEditCorder('page-1');assert.equal(t.writes.length,0);
 }
});
test('new order numbering still uses SHPTW sequence and minimum',()=>{
 const ctx=vm.createContext({});vm.runInContext(html.slice(html.indexOf('const CORDER_PREFIX='),html.indexOf('function getCorderStartSerial')),ctx);
 assert.equal(ctx.formatCorderNo(17001),'SHPTW17001');assert.equal(ctx.formatCorderNo(115),'SHPTW16279');
});

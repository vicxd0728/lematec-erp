const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function section(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert(a>=0&&b>a,`missing ${start}`);
 return html.slice(a,b);
}
const reportCode=section('function buildFullBomAuditReport(materials,bomRows){','async function auditAllBomInventory(){');

test('BOM audit is available to warehouse and purchase without widening write roles',()=>{
 const ctx=vm.createContext({ROLE:'viewer'});
 vm.runInContext(section('function isAdminRole(role=ROLE){','function canImportBomRole(role=ROLE){'),ctx);
 for(const role of ['vic','manager','warehouse','purchase'])assert.equal(ctx.canAuditBomRole(role),true);
 for(const role of ['sales','qc','viewer'])assert.equal(ctx.canAuditBomRole(role),false);
 assert.match(html,/canAuditBomRole\(\)\?`<button class="btn btn-ghost btn-sm" onclick="auditAllBomInventory\(\)"/);
 assert.match(html,/if\(!canAuditBomRole\(\)\)\{showToast\('此查驗限 Vic、廠長、倉庫或採購使用'/);
});

test('full audit covers every active material and separates absence from broken BOM',()=>{
 const ctx=vm.createContext({});vm.runInContext(reportCode,ctx);
 const materials=[
  {id:'parent',notion_page_id:'p',sku:'Z-TEST-10001',material_type:'成品',stock:0},
  {id:'child',notion_page_id:'c',sku:'Y-PART-10001',material_type:'零件',stock:8},
  {id:'unused',notion_page_id:'u',sku:'Z-UNUSED-10001',material_type:'成品',stock:0},
  {id:'transfer',notion_page_id:'s',sku:'S-Z-TRANSFER',material_type:'蝦皮用',stock:0},
 ];
 const bom=[
  {parent_notion_page_id:'p',parent_sku:'Z-TEST-10001',child_notion_page_id:'c',child_sku:'Y-PART-10001',quantity:2},
  {parent_notion_page_id:'p',parent_sku:'Z-TEST-10001',child_notion_page_id:'absent',child_sku:'Y-ABSENT',quantity:1},
 ];
 const report=ctx.buildFullBomAuditReport(materials,bom);
 assert.equal(report.rows.length,4);
 assert.equal(report.bomParents,1);
 assert.equal(report.noBom,3);
 assert.equal(report.needsBom,1);
 assert.equal(report.globalIssues.length,1);
 assert.equal(report.rows.find(x=>x.id==='parent').children[0].quantity,2);
 assert.equal(report.rows.find(x=>x.id==='unused').issues.length,0);
});

test('invalid and duplicate BOM pairs plus similar SKUs remain review candidates',()=>{
 const ctx=vm.createContext({});vm.runInContext(reportCode,ctx);
 const mats=[
  {id:'a',notion_page_id:'a',sku:'Z-SKC-A-03AS-1ABF'},
  {id:'b',notion_page_id:'b',sku:'Z-SKC-A-03AS-1ABFH'},
 ];
 const bom=[
  {parent_notion_page_id:'a',parent_sku:mats[0].sku,child_notion_page_id:'a',child_sku:mats[0].sku,quantity:1},
  {parent_notion_page_id:'a',parent_sku:mats[0].sku,child_notion_page_id:'a',child_sku:mats[0].sku,quantity:0},
 ];
 const report=ctx.buildFullBomAuditReport(mats,bom);
 const issue=report.rows[0].issues.join(' ');
 assert.match(issue,/母件與子件相同/);
 assert.match(issue,/用量不是正數/);
 assert.match(issue,/BOM 關聯重複/);
 assert.equal(report.similar,2);
 assert.deepEqual(Array.from(report.rows[0].similar),[mats[1].sku]);
 assert.equal(report.rows[1].children.length,0);
});

test('existing C-end direct-stock self link is classified as expected, not broken',()=>{
 const ctx=vm.createContext({});vm.runInContext(reportCode,ctx);
 const sku='S-Z-D3WQC',id='page';
 const report=ctx.buildFullBomAuditReport([{id:'material',notion_page_id:id,sku}],
  [{parent_notion_page_id:id,parent_sku:sku,child_notion_page_id:id,child_sku:sku,quantity:1,notes:'C端直接扣料；不展開子件 BOM'}]);
 assert.equal(report.directStock,1);
 assert.equal(report.review,0);
 assert.equal(report.rows[0].issues.length,0);
});

test('online audit refuses incomplete or version-drifted primary reads',async()=>{
 const code=section('async function fetchFullBomAuditSnapshot(){','function buildFullBomAuditReport(materials,bomRows){');
 const versions={ok:true,source:'supabase',inventory_version:'one',bom_version:'one',counts:{materials:1,bom_items:0}};
 const material={id:'a',sku:'A'};
 const payloads=[versions,{ok:true,source:'supabase',count:1,materials:[material]},
  {ok:true,source:'supabase',row_count:0,rows:[]},versions];
 const ctx=vm.createContext({PROXY:'https://example.invalid',fetch:async()=>({ok:true,json:async()=>payloads.shift()}),Date});
 vm.runInContext(code,ctx);
 const result=await ctx.fetchFullBomAuditSnapshot();
 assert.equal(result.materials.length,1);
 const changed=[versions,{ok:true,source:'supabase',count:1,materials:[material]},
  {ok:true,source:'supabase',row_count:0,rows:[]},{...versions,bom_version:'two'}];
 ctx.fetch=async()=>({ok:true,json:async()=>changed.shift()});
 await assert.rejects(ctx.fetchFullBomAuditSnapshot(),/已更新/);
});

test('audit list filters candidate BOM gaps and searches all loaded SKUs',()=>{
 const code=section('function setFullBomAuditFilter(key,value){','function downloadFullBomAuditCsv(){');
 const box={innerHTML:''};
 const rows=[
  {sku:'Z-NEW',name:'New',type:'成品',stock:0,updatedAt:'',children:[],usedIn:0,issues:[],similar:[],directStock:0},
  {sku:'Y-PART',name:'Part',type:'零件',stock:1,updatedAt:'',children:[],usedIn:0,issues:[],similar:[],directStock:0},
  {sku:'S-TRANSFER',name:'Transfer',type:'蝦皮用',stock:2,updatedAt:'',children:[],usedIn:0,issues:[],similar:[],directStock:0},
 ];
 const ctx=vm.createContext({window:{_fullBomAudit:{rows,q:'',status:'all',type:'all',sort:'sku',page:1}},
  document:{getElementById:()=>box},escapeHtml:x=>String(x)});
 vm.runInContext(code,ctx);
 ctx.setFullBomAuditFilter('status','needs_bom');
 assert.match(box.innerHTML,/Z-NEW/);
 assert.doesNotMatch(box.innerHTML,/Y-PART|S-TRANSFER/);
 ctx.setFullBomAuditFilter('status','all');
 ctx.setFullBomAuditFilter('q','part');
 assert.match(box.innerHTML,/Y-PART/);
 assert.doesNotMatch(box.innerHTML,/Z-NEW|S-TRANSFER/);
});

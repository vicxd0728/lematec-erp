const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function source(a,b){return html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));}
function setup(extra={}){const c=vm.createContext({isFresh:()=>true,resolveOrderPickPlan:()=>({items:[{code:'Y-1',stock:2,needed:5}]}),escapeHtml:esc,preflightBadge:(_level,label)=>label,...extra});vm.runInContext(source('function orderWorkDecision(','function _renderOrdersList('),c);vm.runInContext(source('function renderPreflightCenter(','async function saveAnnounce('),c);return c;}
test('row summary shows shortages and preserves full comparable quantities',()=>{
 const c=setup(),o={no:'TEST',status:'待排程'};assert.equal(c.orderWorkDecision(o).label,'缺料 1 項');
 const out=c.renderOrderWorkHint(o);for(const text of ['需求 5','現有 2','缺少 3','未預留庫存','<details'])assert.ok(out.includes(text));
});
test('stale snapshot never computes or claims a current shortage',()=>{
 let called=false;const c=setup({isFresh:()=>false,resolveOrderPickPlan:()=>{called=true;throw Error('unexpected');}});
 assert.equal(c.orderWorkDecision({status:'待排程'}).label,'庫存快照待更新');assert.equal(called,false);
});
test('unknown and zero balances remain distinct',()=>{
 for(const stock of [null,undefined,'',NaN]){const c=setup({resolveOrderPickPlan:()=>({items:[{stock,needed:1}]})});assert.equal(c.orderWorkDecision({status:'待排程'}).label,'庫存或需求待確認');}
 const c=setup({resolveOrderPickPlan:()=>({items:[{stock:0,needed:1}]})});assert.equal(c.orderWorkDecision({status:'待排程'}).label,'缺料 1 項');
});
test('data errors and untrusted labels remain visible and escaped',()=>{
 const c=setup({resolveOrderPickPlan:()=>{throw Error('<img src=x>');}});const out=c.renderOrderWorkHint({status:'待排程',no:'"<script>'});
 assert.match(out,/領料資料待確認/);assert.match(out,/&lt;img/);assert.doesNotMatch(out,/<img|<script/);
});
test('mode wording follows resolved plan and does not reinterpret order types',()=>{
 for(const [plan,word] of [[{transfer:true},'轉入蝦皮'],[{production:true},'直接子件'],[{},'訂購料號']]){
  const c=setup({resolveOrderPickPlan:()=>({...plan,items:[{stock:10,needed:1}]})});const h=c.orderWorkDecision({status:'待排程'});assert.equal(h.label,'目前快照未見缺料');assert.ok(h.detail.includes(word));
 }
 const c=setup({resolveOrderPickPlan:()=>{throw Error('must not inspect completed');}});assert.equal(c.renderOrderWorkHint({status:'已完成'}),'');assert.match(c.renderOrderWorkHint({status:'待檢驗'}),/等待品管確認/);
});
test('picking disclosure hides only redundant passing detail, retaining all stock impacts',()=>{
 const c=setup(),rows=[{lineLabel:'SHORT',detail:'需要 3，現有 0，缺少 3',error:'庫存不足',impact:-3},{lineLabel:'READY',detail:'需要 1，現有 20',impact:-1}];
 const out=c.renderPreflightCenter({rows,errors:1,groupReadyRows:true,blockedSummaryShown:true,collapseChecks:true,kpis:[{label:'來源',value:'supabase'}]});
 assert.doesNotMatch(out,/SHORT/);assert.match(out,/READY/);assert.match(out,/<details class="pick-disclosure"><summary>其他料件/);assert.match(out,/supabase/);
 const unchanged=c.renderPreflightCenter({rows,errors:1});assert.match(unchanged,/SHORT/);assert.match(unchanged,/READY/);assert.doesNotMatch(unchanged,/<details/);
});
test('all-ready picking remains expanded for confirmation',()=>{
 const c=setup();const out=c.renderPreflightCenter({rows:[{lineLabel:'READY',impact:-5}],groupReadyRows:true});assert.match(out,/READY/);assert.doesNotMatch(out,/<details/);
});
test('read-only summary has no write controls and retains existing operation permission gate',()=>{
 const c=setup();assert.doesNotMatch(c.renderOrderWorkHint({status:'待排程'}),/onclick|doPick|deleteOrder|notionAPI/);
 const list=source('function _renderOrdersList(','function orderTimelineEvents(');assert.match(list,/const canOperate=!isViewOnly\(\)/);assert.match(list,/canOperate\?/);assert.match(list,/<summary>編輯／刪除<\/summary>/);assert.match(list,/data-order-no=/);
 const pick=source('function openPickModal(','// ══ 品管檢驗單');assert.match(pick,/\$\{errors\?'disabled':''\}/);assert.match(pick,/blockedSummaryShown:true/);
});
test('mobile sorting preserves supported column directions without changing query filters',()=>{
 const SORT={};let rendered=0;const c=setup({SORT,renderTab:()=>rendered++});
 c.setOrderMobileSort('deadline:asc');assert.equal(SORT.orders.col,'deadline');assert.equal(SORT.orders.dir,'asc');assert.equal(rendered,1);
 c.setOrderMobileSort('unknown:desc');c.setOrderMobileSort('created:bad');assert.equal(rendered,1);
 assert.match(html,/\.order-list-table tr:first-child\{display:none\}/);assert.match(html,/id="orderMobileSort"/);assert.match(html,/data-label="狀態與作業摘要"/);
});

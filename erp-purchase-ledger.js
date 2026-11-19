/* Accounting-to-inventory review. No inventory mutation functions or automatic translations. */
(function(root){
 'use strict';
 const key=(supplier,label)=>JSON.stringify([supplier,label]);
 const number=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
 const candidateCache=new WeakMap();
 function candidates(label,materials){
  let cache=candidateCache.get(materials);if(!cache){cache=new Map();candidateCache.set(materials,cache);}
  if(cache.has(label))return cache.get(label);
  const exact=materials.filter(m=>m.code===label||m.sku===label);
  if(exact.length){const found=exact.map(m=>({...m,reason:'料號精確相符，待人工確認'}));cache.set(label,found);return found;}
  const normalize=v=>String(v||'').toUpperCase().replace(/[\s_()（）-]/g,'');
  const a=normalize(label);
  const grams=s=>new Set(Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)));
  const ga=grams(a);
  const found=materials.filter(m=>!(m.code||m.sku||'').startsWith('S-')).map(m=>{
   const code=m.code||m.sku,b=normalize(code),gb=grams(b);let common=0;for(const g of ga)if(gb.has(g))common++;
   const prefixMatch=!/^[YFZ]-/i.test(label)&&/^[YFZ]-/i.test(code)&&normalize(code.replace(/^[YFZ]-/i,''))===a;
   const score=a===b?3:prefixMatch?2:(ga.size+gb.size?2*common/(ga.size+gb.size):0);
   return {...m,score,reason:a===b?'符號／大小寫相近，待人工確認':prefixMatch?'補上料號前綴後相同，待人工確認':'僅部分字元相似，請核對數字與尾碼'};
  }).filter(m=>m.score>=.5).sort((a,b)=>b.score-a.score||(a.code||a.sku).localeCompare(b.code||b.sku)).slice(0,4);
  cache.set(label,found);return found;
 }
 function groups(rows,mappings,materials){
  const map=new Map(mappings.map(m=>[key(m.supplier,m.source_label),m])),byId=new Map(materials.map(m=>[m.supabaseId||m.supabase_id||m.id,m]));
  const result=new Map();
  for(const row of rows){
   const k=key(row.supplier,row.label);
   if(!result.has(k)){
    const mapping=map.get(k),material=mapping?.material_id?byId.get(mapping.material_id):null;
    result.set(k,{key:k,supplier:row.supplier,label:row.label,rows:[],quantity:0,amount:0,unknownAmount:0,mapping,material,
     status:mapping?.kind==='expense'?'expense':mapping?.kind==='material'?(material?'confirmed':'invalid'):'pending',
     candidates:candidates(row.label,materials)});
   }
   const g=result.get(k);g.rows.push(row);g.quantity+=row.quantity;
   const value=number(row.amount);if(value===null)g.unknownAmount++;else g.amount+=value;
  }
  return [...result.values()];
 }
 function compare(grouped,report){
  const items=new Map();
  for(const g of grouped.filter(x=>x.status==='confirmed')){
   const sku=g.material.code||g.material.sku;
   if(!items.has(sku))items.set(sku,{sku,unit:g.material.unit||'未填',quantity:0,unknownUnits:false,sourceRows:0});
   const item=items.get(sku);item.sourceRows+=g.rows.length;
   if(number(g.mapping.factor)===null)item.unknownUnits=true;else item.quantity+=g.quantity*Number(g.mapping.factor);
  }
  return [...items.values()].map(item=>{
   const hits=(report.rows||[]).filter(r=>r.sku===item.sku);
   const inbound=hits.some(r=>number(r.inbound)===null)?null:hits.reduce((s,r)=>s+Number(r.inbound),0);
   return {...item,inbound,inventoryRows:hits.length,difference:item.unknownUnits||inbound===null?null:item.quantity-inbound};
  });
 }
 function reviewCategory(g){
  if(g.status!=='pending')return '';
  return g.candidates.some(m=>(m.code||m.sku)===g.label)?'exact':g.candidates.length?'similar':'unmatched';
 }
 function filterGroups(grouped,status='all',query=''){
  const q=query.toLowerCase();
  return grouped.filter(g=>(status==='all'||g.status===status||reviewCategory(g)===status)&&(!q||(g.supplier+' '+g.label+' '+(g.material?.code||'')).toLowerCase().includes(q)));
 }
 function reviewCsv(grouped){
  const safe=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
  const matrix=[['廠商','原始品名','狀態','建議倉庫料號1','建議倉庫料號2','建議倉庫料號3','來源列號','人工處理方式','確認倉庫料號','備註'],...grouped.map(g=>[g.supplier,g.label,g.status==='pending'?(reviewCategory(g)==='unmatched'?'找不到候選':reviewCategory(g)==='exact'?'精確相符待確認':'相近待確認'):g.status,...[0,1,2].map(i=>g.candidates[i]?.code||g.candidates[i]?.sku||''),g.rows.map(r=>r.line).join('、'),'','',''])];
  return '\ufeff'+matrix.map(row=>row.map(safe).join(',')).join('\r\n');
 }
 const api={key,number,candidates,groups,compare,reviewCategory,filterGroups,reviewCsv};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.PurchaseLedger=api;
 if(typeof document==='undefined')return;
 const state={period:'2026-10',sub:'mapping',q:'',status:'all',page:1,batch:null,mappings:[],materials:[],loaded:false,busy:false,error:'',report:null,reportError:'',draft:null};
 const esc=v=>escapeHtml(v??'');
 const fmt=v=>number(v)===null?'—':Number(v).toLocaleString('zh-TW',{maximumFractionDigits:4});
 const writeAllowed=()=>['vic','manager','purchase','warehouse'].includes(ROLE);
 async function request(path,body){
  const res=await fetch(PROXY+'/api/purchase-ledger/'+path,{method:body?'POST':'GET',headers:erpWorkerHeaders(body?{'Content-Type':'application/json'}:{}),cache:'no-store',...(body?{body:JSON.stringify(body)}:{})});
  const data=await res.json();if(!res.ok||!data.ok)throw Error(data.error||'進銷存請求失敗');return data;
 }
 function redraw(){if(CURRENT_TAB==='purchaseLedger')document.getElementById('mainContent').innerHTML=renderPurchaseLedger();}
 root.loadPurchaseLedger=async function(){
  if(state.busy||state.draft?.saving)return;state.busy=true;state.error='';redraw();
  try{
   const [data,res]=await Promise.all([request('list?period='+state.period),fetch(PROXY+'/api/inventory/list?limit=20000',{headers:erpWorkerHeaders(),cache:'no-store'})]);
   const inventory=await res.json();if(!res.ok||!inventory.ok||!Array.isArray(inventory.materials))throw Error('正式庫存料號未完整讀取，請重試');
   state.batch=data.batch;state.mappings=data.mappings;state.materials=inventory.materials.filter(m=>!m.status||m.status==='啟用');state.loaded=true;state.report=null;state.reportError='';state.draft=null;
  }
  catch(e){state.error=e.message;state.loaded=false;state.batch=null;}
  finally{state.busy=false;redraw();}
 };
 root.purchaseLedgerChange=function(field,value){
  if(state.busy||state.draft?.saving)return;
  state[field]=value;state.page=1;
  if(field==='period'){state.loaded=false;state.batch=null;state.report=null;state.draft=null;loadPurchaseLedger();}else redraw();
 };
 root.purchaseLedgerSearch=function(){state.q=document.getElementById('pl-search')?.value.trim()||'';state.page=1;redraw();};
 function allGroups(){return groups(state.batch?.payload?.rows||[],state.mappings,state.materials);}
 const statusText={confirmed:'已確認料號',expense:'已確認非物料',pending:'待確認',invalid:'對照料號已失效'};
 function sourceLine(row){return `${state.batch?.payload?.sheet||''} 第 ${row.line} 列`;}
 root.renderPurchaseLedger=function(){
  if(!['vic','manager','purchase','warehouse','ai'].includes(ROLE))return '<div class="panel">目前角色沒有進銷存權限</div>';
  const grouped=allGroups(),rows=state.batch?.payload?.rows||[];
  const counts={all:grouped.length,confirmed:0,pending:0,expense:0,invalid:0};grouped.forEach(g=>counts[g.status]++);
  for(const category of ['exact','similar','unmatched'])counts[category]=grouped.filter(g=>reviewCategory(g)===category).length;
  const known=rows.filter(r=>number(r.amount)!==null),sum=known.reduce((s,r)=>s+Number(r.amount),0);
  const header=`<section class="module-brief"><div><h2>進銷存</h2><p>第一階段：9、10 月進貨資料與料號對照。確認對照不會建立料號或增加庫存。</p></div></section>
   <div class="panel pl-toolbar"><label>帳務月份 <select class="inp" onchange="purchaseLedgerChange('period',this.value)" ${state.busy?'disabled':''}><option value="2026-09" ${state.period==='2026-09'?'selected':''}>115 年 9 月</option><option value="2026-10" ${state.period==='2026-10'?'selected':''}>115 年 10 月</option></select></label><button class="btn btn-ghost" onclick="loadPurchaseLedger()" ${state.busy?'disabled':''}>${state.busy?'讀取中…':'重新讀取'}</button></div>`;
  if(state.error)return header+`<div class="panel pl-message" role="alert">${esc(state.error)}<p>資料未載入，不能當成沒有進貨；請按重新讀取。</p></div>`;
  if(!state.loaded)return header+'<div class="loading-row">正在讀取進貨來源與人工對照…</div>';
  if(!state.batch)return header+'<div class="panel pl-message">尚未帶入這個月的來源快照。雲端 ERP 不會直接讀取區網檔案；來源需由公司電腦的匯入工具送入。</div>';
  const cards=`<div class="dash-kpi-grid"><div class="kpi-card kpi-cyan"><div class="kpi-label">來源品項列</div><div class="kpi-num">${rows.length}</div><div class="kpi-sub">同一發票可有多列，非發票張數</div></div><div class="kpi-card kpi-amber"><div class="kpi-label">待確認對照</div><div class="kpi-num">${counts.pending+counts.invalid}</div><div class="kpi-sub">依廠商＋原始品名，共 ${grouped.length} 組</div></div><div class="kpi-card kpi-green"><div class="kpi-label">已確認物料／非物料</div><div class="kpi-num">${counts.confirmed} / ${counts.expense}</div><div class="kpi-sub">跨月份共用已保存的對照</div></div><div class="kpi-card"><div class="kpi-label">品項小計合計</div><div class="kpi-num" style="font-size:1.65rem">${fmt(sum)}</div><div class="kpi-sub">僅原表小計；非含稅帳款，缺值 ${rows.length-known.length} 列</div></div></div>`;
  const coverage=`<div class="panel pl-coverage" aria-label="對照進度">${[['confirmed','已確認料號'],['expense','非物料'],['pending','待確認'],['invalid','失效對照']].map(([s,l])=>`<div><span>${l} ${counts[s]} 組</span><meter min="0" max="${grouped.length||1}" value="${counts[s]}">${counts[s]}</meter></div>`).join('')}</div>`;
  const source=`<details class="panel pl-message"><summary>來源與核對規則</summary><p>${esc(state.batch.source_key)} · ${esc(state.batch.payload.sheet)} · 匯入 ${esc(state.batch.created_at)}<br>來源指紋 ${esc(state.batch.source_hash.slice(0,12))}；保留原始品名與 Excel 列號。排除月份標題、合計及空白公式列。數量不跨不同品項加總；單位換算未確認前不比較庫存數量。銀行、支票與付款資料未帶入本階段。</p><p>本頁尚未串接銷貨與自動區網同步。料號對照不會改寫 BOM、舊訂單或倉庫料號。</p></details>`;
  const tabs=`<div class="pl-tabs">${[['mapping','料號對照'],['details','進貨明細'],['compare','期間進出核對']].map(([s,l])=>`<button class="btn ${state.sub===s?'btn-blue':'btn-ghost'}" aria-pressed="${state.sub===s}" onclick="purchaseLedgerChange('sub','${s}')">${l}</button>`).join('')}</div>`;
  if(state.sub==='compare')return header+cards+tabs+renderComparison(grouped)+source;
  const filtered=filterGroups(grouped,state.status,state.q);
  const listed=state.sub==='details'?rows.filter(row=>filtered.some(g=>g.key===key(row.supplier,row.label))):filtered;
  const page=Math.max(1,Math.min(state.page,Math.ceil(listed.length/30)||1));state.page=page;
  const toolbar=`<div class="panel pl-toolbar"><input class="inp" id="pl-search" value="${esc(state.q)}" placeholder="搜尋廠商、原始品名或已確認料號" onkeydown="if(event.key==='Enter'&&!event.isComposing)purchaseLedgerSearch()"><button class="btn btn-blue" onclick="purchaseLedgerSearch()">搜尋</button><select class="inp" aria-label="對照篩選" onchange="purchaseLedgerChange('status',this.value)">${[['all','全部'],['similar','相近待確認'],['unmatched','找不到候選'],['exact','精確相符待確認'],...Object.entries(statusText)].map(([s,l])=>`<option value="${s}" ${state.status===s?'selected':''}>${l} ${counts[s]} 組品名</option>`).join('')}</select><button class="btn btn-ghost" onclick="exportPurchaseReview()" ${filtered.length?'':'disabled'}>下載目前篩選核對清單</button><span>符合 ${listed.length} ${state.sub==='details'?'列':'組'} · 第 ${page} 頁</span></div>`;
  let content;
  if(state.sub==='mapping')content=`<div class="pl-list">${filtered.slice((page-1)*30,page*30).map(g=>{
   const i=grouped.indexOf(g);const factor=number(g.mapping?.factor);
   return `<article class="panel pl-record"><div class="pl-record-head"><div><strong>${esc(g.label)}</strong><div class="pl-muted">${esc(g.supplier)} · ${g.rows.length} 列 · ${esc(sourceLine(g.rows[0]))}</div></div><span class="badge">${statusText[g.status]}</span></div><div class="pl-record-body"><div>ERP：<b>${g.material?esc(g.material.code||g.material.sku):g.status==='expense'?'非物料／費用':'尚未確認'}</b></div><div class="pl-muted">${g.status==='confirmed'?factor===null?'單位換算尚未確認，不計算數量差異':`來源數量 × ${fmt(factor)} → ${esc(g.material.unit||'ERP 單位')}`:g.candidates.length?'候選：'+g.candidates.map(m=>esc(m.code||m.sku)).join('、'):'沒有找到相近料號；可手動搜尋或標示非物料'}</div><div>原始數量合計 ${fmt(g.quantity)}${factor===null?'（單位待核）':''} · 小計 ${fmt(g.amount)}${g.unknownAmount?'，含缺值':''}</div>${writeAllowed()?`<button class="btn btn-blue" data-pl-group="${i}" onclick="openPurchaseMapping(Number(this.dataset.plGroup))">${g.mapping?'檢視／修改對照':'確認對照'}</button>`:'<span class="pl-muted">唯讀角色；對照由採購／倉管確認</span>'}</div></article>`;
  }).join('')||'<div class="panel pl-message">目前沒有符合條件的對照；可清除搜尋或切換狀態。</div>'}</div>`;
  else content=`<div class="pl-list">${listed.slice((page-1)*30,page*30).map(row=>`<article class="panel pl-record"><div class="pl-record-head"><strong>${esc(row.label)}</strong><span>${esc(sourceLine(row))}</span></div><div class="pl-record-body"><div>廠商：${esc(row.supplier)}</div><div>數量 ${fmt(row.quantity)} · 單價 ${fmt(row.unit_price)} · 小計 ${fmt(row.amount)}</div></div></article>`).join('')||'<div class="panel pl-message">沒有符合條件的進貨列。</div>'}</div>`;
  return header+cards+coverage+tabs+toolbar+content+`<div class="pl-tabs"><button class="btn btn-ghost" onclick="purchaseLedgerPage(-1)" ${page<=1?'disabled':''}>上一頁</button><button class="btn btn-ghost" onclick="purchaseLedgerPage(1)" ${page*30>=listed.length?'disabled':''}>下一頁</button></div>`+source;
 };
 root.purchaseLedgerPage=function(delta){state.page=Math.max(1,state.page+delta);redraw();};
 root.exportPurchaseReview=function(){
  const selected=filterGroups(allGroups(),state.status,state.q);if(!selected.length)return;
  const blob=new Blob([reviewCsv(selected)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`進貨料號核對_${state.period}_${state.status}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 root.openPurchaseMapping=function(index){
  if(!writeAllowed())return;const g=allGroups()[index];if(!g)return;
  state.draft={g,requestId:crypto.randomUUID(),saving:false};
  document.getElementById('modalInner').innerHTML=`<h3>確認型號對照</h3><p><b>${esc(g.label)}</b><br>${esc(g.supplier)} · 影響同廠商、同原始品名的各月份資料</p><p class="pl-muted">只保存對照；不新增／更名料號，不入庫、不扣料。</p><label>處理方式<select class="inp" id="pl-kind" onchange="purchaseMappingKind()"><option value="material">對應既有料號</option><option value="expense" ${g.status==='expense'?'selected':''}>非物料／費用</option><option value="pending" ${g.mapping?.kind==='pending'?'selected':''}>撤回確認，保留待處理</option></select></label><div id="pl-material-fields"><label>搜尋既有料號<input class="inp" id="pl-material-q" placeholder="輸入料號或名稱" oninput="purchaseMappingCandidates(this.value)"></label><div id="pl-candidates" class="pl-choice-list"></div><label>ERP 料號<select class="inp" id="pl-material"><option value="">— 請明確選擇 —</option></select></label><label><input type="checkbox" id="pl-unit-confirmed" ${number(g.mapping?.factor)!==null?'checked':''}> 已確認來源數量換算為 ERP 單位</label><label>每 1 來源單位＝多少 ERP 單位<input class="inp" type="number" min="0.000001" max="1000000" step="any" id="pl-factor" value="${esc(g.mapping?.factor??1)}"></label><p class="pl-muted">來源單位不明時不要勾選；仍可先保存料號對照。</p></div><label>確認備註<input class="inp" id="pl-note" maxlength="1000" value="${esc(g.mapping?.note||'')}"></label><div id="pl-save-state" role="status"></div><div class="pl-tabs"><button class="btn btn-ghost" id="pl-close" onclick="closeModal()">關閉</button><button class="btn btn-blue" id="pl-save" onclick="savePurchaseMapping()">確認儲存對照</button></div>`;
  purchaseMappingCandidates('',g.material?.supabase_id||g.material?.id);purchaseMappingKind();openSharedModal();
 };
 root.purchaseMappingKind=function(){document.getElementById('pl-material-fields').hidden=document.getElementById('pl-kind').value!=='material';};
 root.purchaseMappingCandidates=function(query='',selected=''){
  const g=state.draft?.g;if(!g)return;
  const q=query.trim().toLowerCase(),items=q?state.materials.filter(m=>((m.code||m.sku||'')+' '+(m.name||'')).toLowerCase().includes(q)).slice(0,40):g.candidates;
  const selectedMaterial=state.materials.find(m=>(m.supabase_id||m.id)===selected);
  const choices=[...new Map([...(selectedMaterial?[selectedMaterial]:[]),...items].map(m=>[m.supabase_id||m.id,m])).values()];
  document.getElementById('pl-material').innerHTML='<option value="">— 請明確選擇 —</option>'+choices.map(m=>`<option value="${esc(m.supabase_id||m.id)}" ${(m.supabase_id||m.id)===selected?'selected':''}>${esc(m.code||m.sku)} · ${esc(m.name)} · ${esc(m.unit||'')}</option>`).join('');
  document.getElementById('pl-candidates').innerHTML=choices.length?choices.map(m=>`<button class="btn btn-ghost" data-material-id="${esc(m.supabase_id||m.id)}" onclick="document.getElementById('pl-material').value=this.dataset.materialId">${esc(m.code||m.sku)} · ${esc(m.reason||'搜尋結果')}</button>`).join(''):'<p>找不到料號，請改用其他文字搜尋，或先保留待確認。</p>';
 };
 root.savePurchaseMapping=async function(){
  const d=state.draft;if(!d||d.saving||!writeAllowed())return;
  const status=document.getElementById('pl-save-state');
  if(d.uncertain){status.textContent='上次儲存結果未確認。請關閉後重新讀取，核對對照再修改，勿重送。';return;}
  const kind=document.getElementById('pl-kind').value,material=kind==='material'?document.getElementById('pl-material').value:null;
  const factor=kind==='material'&&document.getElementById('pl-unit-confirmed').checked?number(document.getElementById('pl-factor').value):null;
  if(kind==='material'&&!material){status.textContent='請選擇既有料號；找不到時先保留待確認。';return;}
  if(kind==='material'&&document.getElementById('pl-unit-confirmed').checked&&(!factor||factor<=0)){status.textContent='請填寫大於 0 的換算係數。';return;}
  const body={batch_id:state.batch.id,request_id:d.requestId,version:d.g.mapping?.version||0,supplier:d.g.supplier,label:d.g.label,kind,material_id:material,factor,note:document.getElementById('pl-note').value.trim()};
  d.saving=true;document.getElementById('pl-save').disabled=true;document.getElementById('pl-close').disabled=true;status.textContent='儲存並核對中…';
  try{
   const result=await request('mapping',body);
   const fresh=await request('list?period='+state.period),saved=fresh.mappings.find(m=>key(m.supplier,m.source_label)===key(body.supplier,body.label));
   if(!saved||saved.last_request!==result.mapping.last_request)throw Error('對照已送出，但讀回不一致；請重新讀取');
   state.mappings=fresh.mappings;state.batch=fresh.batch;state.report=null;state.draft=null;closeModal();redraw();showToast('對照已保存並核對，庫存未變動','success');
  }catch(e){d.uncertain=true;status.textContent=e.message+'。結果可能已保存；請關閉後重新讀取核對，勿重送。';showToast(status.textContent,'warn',10000);}
  finally{d.saving=false;const close=document.getElementById('pl-close');if(close)close.disabled=false;}
 };
 root.loadPurchaseComparison=async function(){
  if(state.busy)return;state.busy=true;state.reportError='';redraw();
  const [year,month]=state.period.split('-').map(Number),end=new Date(Date.UTC(year,month,0)).getUTCDate();
  try{
   const res=await fetch(PROXY+'/api/inventory/period-report?'+new URLSearchParams({start:state.period+'-01',end:state.period+'-'+end}),{headers:erpWorkerHeaders(),cache:'no-store'});
   const data=await res.json();if(!res.ok||!data.ok||!data.complete||!Array.isArray(data.rows))throw Error(data.error||'期間總表未完整載入');state.report=data;
  }catch(e){state.report=null;state.reportError=e.message;}finally{state.busy=false;redraw();}
 };
 function renderComparison(grouped){
  const intro=`<div class="panel pl-message"><b>帳務月份與實際入庫月份可能不同，差異只供追查，不代表庫存錯誤。</b><p>僅比較已人工確認的料號；數量需另確認單位換算。ERP 欄位取自正式期間進出總表的「進貨入庫」，不含組立產出、退貨或轉庫。沒有交易的料號顯示 0 進貨入庫，不能推論庫存為 0。</p><button class="btn btn-blue" onclick="loadPurchaseComparison()" ${state.busy?'disabled':''}>${state.busy?'讀取中…':'讀取本月期間進出總表'}</button></div>`;
  if(state.reportError)return intro+`<div class="panel pl-message" role="alert">${esc(state.reportError)}；尚未取得完整總表，不計算差異。</div>`;
  if(!state.report)return intro+'<div class="panel pl-message">請先讀取本月總表。未確認的品名與非物料不納入數量比較。</div>';
  const items=compare(grouped,state.report);
  return intro+`<p class="pl-muted">總表產生 ${esc(state.report.generated_at)} · 已確認 ${items.length} 個料號；待處理／非物料組別未納入。</p><div class="pl-list">${items.map(x=>`<article class="panel pl-record"><div class="pl-record-head"><b>${esc(x.sku)}</b><span>${esc(x.unit)}</span></div><div class="pl-record-body"><div>帳務進貨換算數量：${x.unknownUnits?'單位尚未確認':fmt(x.quantity)}</div><div>ERP 期間進貨入庫：${fmt(x.inbound)}</div><div>差異（帳務－入庫）：<b>${fmt(x.difference)}</b></div><div class="pl-muted">${x.sourceRows} 筆帳務列 · ${x.inventoryRows} 個倉庫彙總；請核對日期與收貨紀錄。</div></div></article>`).join('')||'<div class="panel pl-message">尚無人工確認的料號，請先完成料號對照。</div>'}</div>`;
 }
})(typeof globalThis==='undefined'?this:globalThis);

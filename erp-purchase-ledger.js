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
 function trialAssignments(grouped){
  return grouped.map(g=>{
   if(g.status==='expense')return {group:g,kind:'expense',provisional:false,reason:'人工已確認非物料'};
   if(g.status==='confirmed')return {group:g,kind:'material',material:g.material,provisional:false,factor:number(g.mapping.factor)??1,unitAssumed:number(g.mapping.factor)===null,reason:'沿用人工已確認的料號'};
   if(g.status==='invalid')return {group:g,kind:'unresolved',provisional:false,reason:'人工對照料號已失效，請重新選擇'};
   if(/運費|貨費|強制險|車險|保險|便當|稅金|薪資|油資|郵資|電話費|電費|房租/.test(g.label))return {group:g,kind:'expense',provisional:true,reason:'依文字暫列疑似費用，仍可校正'};
   const first=g.candidates[0];
   return first?{group:g,kind:'material',material:first,provisional:true,factor:1,unitAssumed:true,reason:first.reason}:{group:g,kind:'unresolved',provisional:true,reason:'目前沒有候選，不虛構料號'};
  });
 }
 function trialModel(assignments,report=null){
  if(report&&(!report.complete||!Array.isArray(report.rows)))throw Error('期間資料不完整，不能計算試跑差異');
  const buckets=new Map();
  for(const a of assignments.filter(a=>a.kind==='material')){
   const sku=a.material.code||a.material.sku;
   if(!buckets.has(sku))buckets.set(sku,{sku,unit:a.material.unit||'未填',quantity:0,amount:0,knownAmounts:0,unknownAmounts:0,provisional:false,unitAssumed:false,assignments:[]});
   const b=buckets.get(sku);b.quantity+=a.group.quantity*a.factor;b.amount+=a.group.amount;b.knownAmounts+=a.group.rows.length-a.group.unknownAmount;b.unknownAmounts+=a.group.unknownAmount;
   b.provisional ||= a.provisional;b.unitAssumed ||= a.unitAssumed;b.assignments.push(a);
  }
  return [...buckets.values()].map(b=>{
   const hits=report?(report.rows||[]).filter(r=>r.sku===b.sku):[];
   const total=field=>!report?null:hits.some(r=>number(r[field])===null)?null:hits.reduce((s,r)=>s+Number(r[field]),0);
   const inbound=total('inbound');
   return {...b,amount:b.knownAmounts?b.amount:null,inbound,outbound:total('outbound'),opening:hits.length?total('opening'):null,closing:hits.length?total('closing'):null,
    difference:inbound===null?null:b.quantity-inbound,hasPeriodMovements:hits.length>0};
  });
 }
 const api={key,number,candidates,groups,compare,reviewCategory,filterGroups,reviewCsv,trialAssignments,trialModel};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.PurchaseLedger=api;
 if(typeof document==='undefined')return;
 const state={period:'2026-10',sub:'trial',q:'',status:'all',page:1,trialLimit:20,batch:null,mappings:[],materials:[],loaded:false,busy:false,error:'',report:null,reportError:'',draft:null,lastSaved:''};
 const esc=v=>escapeHtml(v??'');
 const fmt=v=>number(v)===null?'—':Number(v).toLocaleString('zh-TW',{maximumFractionDigits:4});
 const writeAllowed=()=>['vic','manager','purchase','warehouse'].includes(ROLE);
 async function request(path,body){
  const res=await fetch(PROXY+'/api/purchase-ledger/'+path,{method:body?'POST':'GET',headers:erpWorkerHeaders(body?{'Content-Type':'application/json'}:{}),cache:'no-store',...(body?{body:JSON.stringify(body)}:{})});
  const data=await res.json();if(!res.ok||!data.ok)throw Error(data.error||'進銷存請求失敗');return data;
 }
 function lockPurchaseNavigation(){if(state.draft){document.querySelectorAll('.pl-toolbar input,.pl-toolbar select,.pl-toolbar button').forEach(e=>e.disabled=true);document.querySelectorAll('.pl-tabs button').forEach(e=>{if(!e.closest('.pl-inline-form'))e.disabled=true;});}}
 function restorePurchaseDraft(){
  const d=state.draft;if(!d||!document.getElementById('pl-material'))return;
  purchaseMappingCandidates('',d.values.material);purchaseMappingKind();lockPurchaseNavigation();
  if(d.saving||d.uncertain)document.querySelectorAll('.pl-inline-form input,.pl-inline-form select,.pl-inline-form .pl-choice-list button').forEach(e=>e.disabled=true);
  document.getElementById('pl-save').disabled=!!(d.saving||d.uncertain);
  const close=document.getElementById('pl-close');close.disabled=!!d.saving;close.textContent=d.uncertain?'結束編輯並重新讀取':'取消這筆編輯';
  document.getElementById('pl-save-state').textContent=d.saving?'儲存並核對中…':d.errorText||'';
 }
 function redraw(){if(CURRENT_TAB==='purchaseLedger'){document.getElementById('mainContent').innerHTML=renderPurchaseLedger();lockPurchaseNavigation();restorePurchaseDraft();}}
 root.loadPurchaseLedger=async function(){
  if(state.busy||state.draft?.saving){restorePurchaseDraft();return;}
  if(state.draft){lockPurchaseNavigation();restorePurchaseDraft();showToast('請先儲存或取消目前這筆對照，再重新讀取','warn');return;}
  state.busy=true;state.error='';state.trialLimit=20;redraw();
  try{
   const [data,res]=await Promise.all([request('list?period='+state.period),fetch(PROXY+'/api/inventory/list?limit=20000',{headers:erpWorkerHeaders(),cache:'no-store'})]);
   const inventory=await res.json();if(!res.ok||!inventory.ok||!Array.isArray(inventory.materials))throw Error('正式庫存料號未完整讀取，請重試');
   state.batch=data.batch;state.mappings=data.mappings;state.materials=inventory.materials.filter(m=>!m.status||m.status==='啟用');state.loaded=true;state.report=null;state.reportError='';state.draft=null;
  }
  catch(e){state.error=e.message;state.loaded=false;state.batch=null;}
  finally{state.busy=false;redraw();}
  if(state.loaded&&state.sub==='trial')await loadPurchaseComparison();
 };
 root.purchaseLedgerChange=function(field,value){
  if(state.busy||state.draft?.saving)return;
  if(state.draft){showToast('請先儲存或取消目前這筆對照，再切換條件','warn');return;}
  state[field]=value;state.page=1;
  if(field==='period'){state.loaded=false;state.batch=null;state.report=null;state.draft=null;loadPurchaseLedger();}else{redraw();if(field==='sub'&&value==='trial'&&state.loaded&&!state.report)loadPurchaseComparison();}
 };
 root.purchaseLedgerSearch=function(){if(state.draft){showToast('請先儲存或取消目前這筆對照','warn');return;}state.q=document.getElementById('pl-search')?.value.trim()||'';state.page=1;redraw();};
 function allGroups(){return groups(state.batch?.payload?.rows||[],state.mappings,state.materials);}
 root.morePurchaseTrial=function(){state.trialLimit+=20;redraw();};
 root.correctPurchaseTrial=function(index){
  if(state.busy||state.draft)return;
  const all=allGroups(),g=all[index];if(!g)return;
  state.sub='mapping';state.status='all';state.q=g.label;state.page=Math.floor(filterGroups(all,'all',g.label).indexOf(g)/30)+1;
  openPurchaseMapping(index);
 };
 function renderPurchaseTrial(grouped){
  const assignments=trialAssignments(grouped),model=trialModel(assignments,state.report);
  const manual=assignments.filter(a=>!a.provisional&&a.kind!=='unresolved').length;
  const provisional=assignments.filter(a=>a.provisional&&a.kind==='material').length;
  const expenses=assignments.filter(a=>a.kind==='expense'),unresolved=assignments.filter(a=>a.kind==='unresolved');
  const feeGuesses=expenses.filter(a=>a.provisional).length;
  const amount=assignments.reduce((s,a)=>s+a.group.amount,0),missingAmounts=assignments.reduce((s,a)=>s+a.group.unknownAmount,0);
  const fix=a=>writeAllowed()?`<button class="btn btn-blue btn-sm" data-group="${grouped.indexOf(a.group)}" onclick="correctPurchaseTrial(Number(this.dataset.group))" ${state.busy?'disabled':''}>檢查／校正這筆</button>`:'<span class="pl-muted">唯讀角色</span>';
  const note=`<div class="panel pl-message pl-trial-warning"><b>系統試跑 · 尚未核定</b><p>先用第一個候選料號暫配，未確認的單位暫按 1:1 試算；費用依文字暫分類。結果可以先看、逐筆校正，不代表正式進貨入庫、庫存錯誤或已確認對照。</p><button class="btn btn-blue" onclick="loadPurchaseLedger()" ${state.busy?'disabled':''}>${state.busy?'讀取來源／庫存總表中…':'重新試跑（只讀資料）'}</button><span class="pl-muted">不建立料號、不存正式對照、不增減庫存。</span></div>`;
  const kpis=`<div class="dash-kpi-grid pl-trial-summary"><div class="kpi-card kpi-cyan"><div class="kpi-label">可試算的物料組別</div><div class="kpi-num">${assignments.filter(a=>a.kind==='material').length}</div><div class="kpi-sub">暫配 ${provisional} 組 · 彙整成 ${model.length} 個倉庫料號</div></div><div class="kpi-card kpi-amber"><div class="kpi-label">未配到料號</div><div class="kpi-num">${unresolved.length}</div><div class="kpi-sub">保留原品名，不虛構編號</div></div><div class="kpi-card"><div class="kpi-label">費用／非物料組別</div><div class="kpi-num">${expenses.length}</div><div class="kpi-sub">${feeGuesses} 組為文字判斷，尚未人工確認</div></div><div class="kpi-card"><div class="kpi-label">來源品項小計</div><div class="kpi-num" style="font-size:1.7rem">${fmt(amount)}</div><div class="kpi-sub">原表小計，非含稅帳款；缺值 ${missingAmounts} 列</div></div></div>`;
  const coverage=`<div class="panel pl-coverage" aria-label="試跑分配狀態">${[['人工已確認',manual],['系統暫配料號',provisional],['疑似費用',feeGuesses],['未配／失效',unresolved.length]].map(([label,count])=>`<div><span>${label} ${count} 組</span><meter min="0" max="${grouped.length||1}" value="${count}">${count}</meter></div>`).join('')}</div>`;
  const reportState=state.report?`<p class="pl-muted">正式期間總表：${esc(state.period)} · 產生 ${esc(state.report.generated_at)}。出庫含領料，不等於銷貨；期初／末為交易推算帳面數。</p>`:`<div class="panel pl-message" role="status">${state.reportError?esc(state.reportError)+'；進貨暫配仍可查看，但不把庫存讀取失敗當作 0 入庫。':'正在讀取期間庫存；資料未完整載入前，入庫與差異顯示 —。'}</div>`;
  const sorted=[...model].sort((a,b)=>Math.abs(b.difference??0)-Math.abs(a.difference??0)).slice(0,state.trialLimit);
  const models=`<div class="panel pl-message"><h3>料號進出試算 · ${model.length} 個</h3><p>依暫算差異大小排列。每筆保留原始品名；暫配或單位假設可能造成大差異，先校正對照，不直接補庫存。</p></div><div class="pl-list">${sorted.map(m=>`<article class="panel pl-record"><div class="pl-record-head"><b>${esc(m.sku)}</b><span class="badge">${m.provisional?'含系統暫配':'人工料號'}${m.unitAssumed?' · 單位假設':''}</span></div><div class="pl-record-body"><div class="pl-trial-numbers"><div>帳務進貨${m.unitAssumed?'（暫按1:1）':''}<b>${fmt(m.quantity)}</b></div><div>ERP 進貨入庫<b>${fmt(m.inbound)}</b></div><div>暫算差異<b>${fmt(m.difference)}</b></div><div>ERP 領料／出庫<b>${fmt(m.outbound)}</b></div></div><div>帳面期初 ${fmt(m.opening)} → 期末 ${fmt(m.closing)} ${esc(m.unit)}</div><div>原品項小計 ${fmt(m.amount)}${m.unknownAmounts?'（含缺值）':''}</div>${state.report&&!m.hasPeriodMovements?'<p class="pl-muted">此期間無該料號交易；總表未提供期初／期末，不能推論目前庫存為 0。</p>':''}<details><summary>原始品名與校正（${m.assignments.length} 組）</summary>${m.assignments.map(a=>`<div class="pl-trial-source"><b>${esc(a.group.label)}</b><div>${esc(a.group.supplier)} · ${esc(sourceLine(a.group.rows[0]))}</div><div class="pl-muted">${esc(a.reason)}${a.unitAssumed?'；單位暫按 1:1':''}</div>${fix(a)}</div>`).join('')}</details></div></article>`).join('')||'<div class="panel pl-message">目前沒有可試算的物料料號；仍可查看下方未配品名與費用。</div>'}</div>`;
  const unassigned=`<details class="panel pl-message" ${!model.length&&unresolved.length?'open':''}><summary>未配到料號／失效對照：${unresolved.length} 組</summary><p>保留在模型外，不假造入庫數量或新料號。</p><div class="pl-list">${unresolved.map(a=>`<div class="pl-trial-source"><b>${esc(a.group.label)}</b><div>${esc(a.group.supplier)} · ${esc(sourceLine(a.group.rows[0]))}</div><div class="pl-muted">${esc(a.reason)}</div>${fix(a)}</div>`).join('')}</div></details>`;
  const fees=`<details class="panel pl-message"><summary>費用／非物料：${expenses.length} 組（${feeGuesses} 組未確認）</summary><p>未納入物料數量比較；文字分類可能錯誤，可改回對應物料。</p><div class="pl-list">${expenses.map(a=>`<div class="pl-trial-source"><b>${esc(a.group.label)}</b><div>${esc(a.group.supplier)} · 原品項小計 ${fmt(a.group.amount)}</div><div class="pl-muted">${esc(a.reason)}</div>${fix(a)}</div>`).join('')}</div></details>`;
  const more=`<div class="pl-tabs"><span>目前顯示 ${sorted.length} / ${model.length} 個料號</span>${sorted.length<model.length?'<button class="btn btn-ghost" onclick="morePurchaseTrial()">再顯示 20 個料號</button>':''}</div>`;
  return note+kpis+coverage+reportState+unassigned+models+more+fees;
 }
 const statusText={confirmed:'已確認料號',expense:'已確認非物料',pending:'待確認',invalid:'對照料號已失效'};
 function sourceLine(row){return `${state.batch?.payload?.sheet||''} 第 ${row.line} 列`;}
 root.renderPurchaseLedger=function(){
  if(!['vic','manager','purchase','warehouse','ai'].includes(ROLE))return '<div class="panel">目前角色沒有進銷存權限</div>';
  const grouped=allGroups(),rows=state.batch?.payload?.rows||[];
  const counts={all:grouped.length,confirmed:0,pending:0,expense:0,invalid:0};grouped.forEach(g=>counts[g.status]++);
  for(const category of ['exact','similar','unmatched'])counts[category]=grouped.filter(g=>reviewCategory(g)===category).length;
  const known=rows.filter(r=>number(r.amount)!==null),sum=known.reduce((s,r)=>s+Number(r.amount),0);
  const header=`<section class="module-brief"><div><h2>進銷存</h2><p>先用 9、10 月資料跑出模型，再逐步校正。系統暫配與人工確認分開標示，試跑不會增減庫存。</p></div></section>
   <div class="panel pl-toolbar"><label>帳務月份 <select class="inp" onchange="purchaseLedgerChange('period',this.value)" ${state.busy?'disabled':''}><option value="2026-09" ${state.period==='2026-09'?'selected':''}>115 年 9 月</option><option value="2026-10" ${state.period==='2026-10'?'selected':''}>115 年 10 月</option></select></label><button class="btn btn-ghost" onclick="loadPurchaseLedger()" ${state.busy?'disabled':''}>${state.busy?'讀取中…':'重新讀取'}</button></div>`;
  if(state.error)return header+`<div class="panel pl-message" role="alert">${esc(state.error)}<p>資料未載入，不能當成沒有進貨；請按重新讀取。</p></div>`;
  if(!state.loaded)return header+'<div class="loading-row">正在讀取進貨來源與人工對照…</div>';
  if(!state.batch)return header+'<div class="panel pl-message">尚未帶入這個月的來源快照。雲端 ERP 不會直接讀取區網檔案；來源需由公司電腦的匯入工具送入。</div>';
  const cards=`<div class="dash-kpi-grid"><div class="kpi-card kpi-cyan"><div class="kpi-label">來源品項列</div><div class="kpi-num">${rows.length}</div><div class="kpi-sub">同一發票可有多列，非發票張數</div></div><div class="kpi-card kpi-amber"><div class="kpi-label">待確認對照</div><div class="kpi-num">${counts.pending+counts.invalid}</div><div class="kpi-sub">依廠商＋原始品名，共 ${grouped.length} 組</div></div><div class="kpi-card kpi-green"><div class="kpi-label">已確認物料／非物料</div><div class="kpi-num">${counts.confirmed} / ${counts.expense}</div><div class="kpi-sub">跨月份共用已保存的對照</div></div><div class="kpi-card"><div class="kpi-label">品項小計合計</div><div class="kpi-num" style="font-size:1.65rem">${fmt(sum)}</div><div class="kpi-sub">僅原表小計；非含稅帳款，缺值 ${rows.length-known.length} 列</div></div></div>`;
  const coverage=`<div class="panel pl-coverage" aria-label="對照進度">${[['confirmed','已確認料號'],['expense','非物料'],['pending','待確認'],['invalid','失效對照']].map(([s,l])=>`<div><span>${l} ${counts[s]} 組</span><meter min="0" max="${grouped.length||1}" value="${counts[s]}">${counts[s]}</meter></div>`).join('')}</div>`;
  const source=`<details class="panel pl-message"><summary>來源與核對規則</summary><p>${esc(state.batch.source_key)} · ${esc(state.batch.payload.sheet)} · 匯入 ${esc(state.batch.created_at)}<br>來源指紋 ${esc(state.batch.source_hash.slice(0,12))}；保留原始品名與 Excel 列號。排除月份標題、合計及空白公式列。數量不跨不同品項加總；單位換算未確認前不比較庫存數量。銀行、支票與付款資料未帶入本階段。</p><p>本頁尚未串接銷貨與自動區網同步。料號對照不會改寫 BOM、舊訂單或倉庫料號。</p></details>`;
  const tabs=`<div class="pl-tabs">${[['trial','系統試跑'],['mapping','料號對照'],['details','進貨明細'],['compare','期間進出核對']].map(([s,l])=>`<button class="btn ${state.sub===s?'btn-blue':'btn-ghost'}" aria-pressed="${state.sub===s}" onclick="purchaseLedgerChange('sub','${s}')">${l}</button>`).join('')}</div>`;
  if(state.sub==='trial')return header+tabs+renderPurchaseTrial(grouped)+source;
  if(state.sub==='compare')return header+cards+tabs+renderComparison(grouped)+source;
  const filtered=filterGroups(grouped,state.status,state.q);
  const listed=state.sub==='details'?rows.filter(row=>filtered.some(g=>g.key===key(row.supplier,row.label))):filtered;
  const page=Math.max(1,Math.min(state.page,Math.ceil(listed.length/30)||1));state.page=page;
  const toolbar=`<div class="panel pl-toolbar"><input class="inp" id="pl-search" value="${esc(state.q)}" placeholder="搜尋廠商、原始品名或已確認料號" onkeydown="if(event.key==='Enter'&&!event.isComposing)purchaseLedgerSearch()"><button class="btn btn-blue" onclick="purchaseLedgerSearch()">搜尋</button><select class="inp" aria-label="對照篩選" onchange="purchaseLedgerChange('status',this.value)">${[['all','全部'],['similar','相近待確認'],['unmatched','找不到候選'],['exact','精確相符待確認'],...Object.entries(statusText)].map(([s,l])=>`<option value="${s}" ${state.status===s?'selected':''}>${l} ${counts[s]} 組品名</option>`).join('')}</select><button class="btn btn-ghost" onclick="exportPurchaseReview()" ${filtered.length?'':'disabled'}>下載目前篩選核對清單</button><span>符合 ${listed.length} ${state.sub==='details'?'列':'組'} · 第 ${page} 頁</span></div>`;
  let content;
  if(state.sub==='mapping')content=`${state.lastSaved?`<div class="panel pl-message" role="status"><b>${esc(state.lastSaved)}</b><p>已確認保存；只更新型號對照，庫存未變動。</p><button class="btn btn-blue" onclick="reviewNextPurchaseMapping()">下一筆待確認</button></div>`:''}<div class="pl-list pl-mapping-list">${filtered.slice((page-1)*30,page*30).map(g=>{
   const i=grouped.indexOf(g);const factor=number(g.mapping?.factor);
   const editing=state.draft?.g.key===g.key;
   const suggested=g.candidates.map(m=>`<button class="btn btn-ghost pl-candidate" data-pl-group="${i}" data-material-id="${esc(m.supabase_id||m.id)}" onclick="openPurchaseMapping(Number(this.dataset.plGroup),this.dataset.materialId)" ${writeAllowed()?'':'disabled'}><strong>${esc(m.code||m.sku)}</strong><span>${esc(m.reason)}</span><span>${writeAllowed()?'選擇此料號（尚未儲存）':'僅供查看'}</span></button>`).join('');
   return `<article class="panel pl-record" data-pl-row="${i}"><div class="pl-record-head"><b>${esc(g.supplier)}</b><span class="badge">${g.status==='pending'&&!g.candidates.length?'找不到候選／待確認':statusText[g.status]}</span></div><div class="pl-review-pair"><section class="pl-source"><div class="pl-muted">原始品名（來源保留）</div><strong class="pl-model">${esc(g.label)}</strong><div class="pl-muted">${g.rows.length} 列 · ${esc(sourceLine(g.rows[0]))}</div><div>原始數量 ${fmt(g.quantity)} · 小計 ${fmt(g.amount)}${g.unknownAmount?'，含缺值':''}</div><p class="pl-muted">同廠商、同原始品名的各月份共用這筆對照。確認不會修改原始品名或倉庫料號。</p></section><section class="pl-target"><div class="pl-muted">${g.mapping&&g.status!=='pending'?'目前已確認的對照':'建議倉庫料號（待你確認）'}</div>${g.status==='confirmed'?`<strong class="pl-model">${esc(g.material.code||g.material.sku)}</strong><div class="pl-muted">${factor===null?'單位換算尚未確認，不計算數量差異':`來源數量 × ${fmt(factor)} → ${esc(g.material.unit||'ERP 單位')}`}</div>`:g.status==='expense'?'<strong>已確認為非物料／費用</strong>':suggested||'<p>沒有找到相近料號，可手動搜尋，或確認為非物料。</p>'}${g.mapping?`<div class="pl-muted">最近確認角色：${esc(g.mapping.actor_role||'—')} · ${esc(g.mapping.updated_at||'—')}</div>`:''}${editing?inlinePurchaseForm(g):writeAllowed()?`<button class="btn btn-blue" data-pl-group="${i}" onclick="openPurchaseMapping(Number(this.dataset.plGroup))">${g.mapping?'修改這筆對照':'手動選料號／非物料'}</button>`:'<p class="pl-muted">唯讀角色；對照由採購／倉管確認。</p>'}</section></div></article>`;
  }).join('')||'<div class="panel pl-message">目前沒有符合條件的對照；可清除搜尋或切換狀態。</div>'}</div>`;
  else content=`<div class="pl-list">${listed.slice((page-1)*30,page*30).map(row=>`<article class="panel pl-record"><div class="pl-record-head"><strong>${esc(row.label)}</strong><span>${esc(sourceLine(row))}</span></div><div class="pl-record-body"><div>廠商：${esc(row.supplier)}</div><div>數量 ${fmt(row.quantity)} · 單價 ${fmt(row.unit_price)} · 小計 ${fmt(row.amount)}</div></div></article>`).join('')||'<div class="panel pl-message">沒有符合條件的進貨列。</div>'}</div>`;
  return header+cards+coverage+tabs+toolbar+content+`<div class="pl-tabs"><button class="btn btn-ghost" onclick="purchaseLedgerPage(-1)" ${page<=1?'disabled':''}>上一頁</button><button class="btn btn-ghost" onclick="purchaseLedgerPage(1)" ${page*30>=listed.length?'disabled':''}>下一頁</button></div>`+source;
 };
 root.purchaseLedgerPage=function(delta){if(state.draft){showToast('請先儲存或取消目前這筆對照','warn');return;}state.page=Math.max(1,state.page+delta);redraw();};
 root.exportPurchaseReview=function(){
  const selected=filterGroups(allGroups(),state.status,state.q);if(!selected.length)return;
  const blob=new Blob([reviewCsv(selected)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`進貨料號核對_${state.period}_${state.status}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 function inlinePurchaseForm(g){
  const v=state.draft.values;
  return `<div class="pl-inline-form"><h3>確認這筆對照</h3><p class="pl-muted">選擇不會自動儲存；核對左右內容後，按下方確認。</p><label>處理方式<select class="inp" id="pl-kind" onchange="purchaseMappingKind()">${[['material','對應既有料號'],['expense','非物料／費用'],['pending','撤回確認，保留待處理']].map(([k,l])=>`<option value="${k}" ${v.kind===k?'selected':''}>${l}</option>`).join('')}</select></label><div id="pl-material-fields" ${v.kind==='material'?'':'hidden'}><label>搜尋既有料號<input class="inp" id="pl-material-q" placeholder="輸入料號或名稱" oninput="purchaseMappingCandidates(this.value)"></label><div id="pl-candidates" class="pl-choice-list"></div><label>選定的 ERP 料號<select class="inp" id="pl-material" onchange="purchaseMappingSelection(this.value)"><option value="">— 請明確選擇 —</option></select></label><details><summary>選填：確認數量單位換算</summary><label><input type="checkbox" id="pl-unit-confirmed" ${v.unit?'checked':''} onchange="purchaseMappingDraft('unit',this.checked)"> 已確認來源數量換算為 ERP 單位</label><label>每 1 來源單位＝多少 ERP 單位<input class="inp" type="number" min="0.000001" max="1000000" step="any" id="pl-factor" value="${esc(v.factor)}" oninput="purchaseMappingDraft('factor',this.value)"></label><p class="pl-muted">單位不明可先不勾選，仍能保存料號對照。</p></details></div><label>確認備註<input class="inp" id="pl-note" maxlength="1000" value="${esc(v.note)}" oninput="purchaseMappingDraft('note',this.value)"></label><p id="pl-selection-summary" class="pl-message">尚未儲存</p><div id="pl-save-state" role="status"></div><div class="pl-tabs"><button class="btn btn-ghost" id="pl-close" onclick="cancelPurchaseMapping()">取消這筆編輯</button><button class="btn btn-blue" id="pl-save" onclick="savePurchaseMapping()">確認並儲存這筆對照</button></div></div>`;
 }
 root.purchaseMappingDraft=function(field,value){if(state.draft&&!state.draft.saving&&!state.draft.uncertain)state.draft.values[field]=value;};
 root.openPurchaseMapping=function(index,selected=''){
  if(!writeAllowed()||state.busy)return;const g=allGroups()[index];if(!g)return;
  if(state.draft&&(state.draft.saving||state.draft.uncertain)){showToast('目前這筆仍需完成讀回，請勿切換或重送','warn');return;}
  if(state.draft&&state.draft.g.key!==g.key){showToast('請先儲存或取消目前這筆對照，再處理下一筆','warn');return;}
  if(!state.draft){state.lastSaved='';state.draft={g,requestId:crypto.randomUUID(),saving:false,values:{kind:g.mapping?.kind==='expense'?'expense':'material',material:g.material?.supabase_id||g.material?.id||'',unit:number(g.mapping?.factor)!==null,factor:g.mapping?.factor??1,note:g.mapping?.note||''}};}
  if(selected){state.draft.values.material=selected;state.draft.values.kind='material';}
  redraw();
  document.querySelector(`[data-pl-row="${index}"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'});
 };
 root.cancelPurchaseMapping=function(){if(state.draft?.saving)return;const uncertain=state.draft?.uncertain;state.draft=null;redraw();if(uncertain)loadPurchaseLedger();};
 root.reviewNextPurchaseMapping=function(){
  if(state.draft){showToast('請先儲存或取消目前這筆對照','warn');return;}
  const all=allGroups(),visible=filterGroups(all,state.status,state.q),g=visible.find(x=>x.status==='pending'||x.status==='invalid');
  if(!g){showToast('目前篩選內已沒有待確認品名，可切換條件查看','success');return;}
  state.page=Math.floor(visible.indexOf(g)/30)+1;openPurchaseMapping(all.indexOf(g));
 };
 root.purchaseMappingSelection=function(value){
  purchaseMappingDraft('material',value);
  const m=state.materials.find(m=>(m.supabase_id||m.id)===value),kind=document.getElementById('pl-kind').value;
  document.getElementById('pl-selection-summary').textContent=state.draft.g.label+' → '+(kind==='expense'?'非物料／費用':kind==='pending'?'撤回至待確認':m?(m.code||m.sku):'尚未選擇料號')+'（尚未儲存）';
 };
 root.purchaseMappingKind=function(){const kind=document.getElementById('pl-kind').value;purchaseMappingDraft('kind',kind);document.getElementById('pl-material-fields').hidden=kind!=='material';purchaseMappingSelection(document.getElementById('pl-material').value);};
 root.purchaseMappingCandidates=function(query='',selected=''){
  const g=state.draft?.g;if(!g)return;
  const q=query.trim().toLowerCase(),items=q?state.materials.filter(m=>((m.code||m.sku||'')+' '+(m.name||'')).toLowerCase().includes(q)).slice(0,40):g.candidates;
  selected=selected||state.draft.values.material;
  const selectedMaterial=state.materials.find(m=>(m.supabase_id||m.id)===selected);
  const choices=[...new Map([...(selectedMaterial?[selectedMaterial]:[]),...items].map(m=>[m.supabase_id||m.id,m])).values()];
  document.getElementById('pl-material').innerHTML='<option value="">— 請明確選擇 —</option>'+choices.map(m=>`<option value="${esc(m.supabase_id||m.id)}" ${(m.supabase_id||m.id)===selected?'selected':''}>${esc(m.code||m.sku)} · ${esc(m.name)} · ${esc(m.unit||'')}</option>`).join('');
  document.getElementById('pl-candidates').innerHTML=!q?'':items.length?items.map(m=>`<button class="btn btn-ghost" data-material-id="${esc(m.supabase_id||m.id)}" onclick="document.getElementById('pl-material').value=this.dataset.materialId;purchaseMappingSelection(this.dataset.materialId)">${esc(m.code||m.sku)} · ${esc(m.reason||'搜尋結果')}</button>`).join(''):'<p>找不到料號，請改用其他文字搜尋，或先保留待確認。</p>';
  purchaseMappingSelection(document.getElementById('pl-material').value);
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
  document.querySelectorAll('.pl-inline-form input,.pl-inline-form select,.pl-inline-form .pl-choice-list button').forEach(e=>e.disabled=true);
  try{
   const result=await request('mapping',body);
   const fresh=await request('list?period='+state.period),saved=fresh.mappings.find(m=>key(m.supplier,m.source_label)===key(body.supplier,body.label));
   if(!saved||saved.last_request!==result.mapping.last_request)throw Error('對照已送出，但讀回不一致；請重新讀取');
   state.mappings=fresh.mappings;state.batch=fresh.batch;state.report=null;state.lastSaved=body.label+' → '+(body.kind==='expense'?'非物料／費用':body.kind==='pending'?'待確認':state.materials.find(m=>(m.supabase_id||m.id)===body.material_id)?.code||body.material_id);state.draft=null;redraw();showToast('對照已保存並核對，庫存未變動','success');
  }catch(e){d.uncertain=true;d.errorText=e.message+'。結果可能已保存；請結束編輯並重新讀取核對，勿重送。';status.textContent=d.errorText;showToast(d.errorText,'warn',10000);}
  finally{d.saving=false;if(state.draft===d)restorePurchaseDraft();}
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

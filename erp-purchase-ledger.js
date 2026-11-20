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
  if(!report?.complete||!Array.isArray(report.rows))throw Error('期間資料不完整，不能計算正式核對差異');
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
 function comparisonCategory(item){return item.unknownUnits||item.difference===null?'unknown':Math.abs(item.difference)>=.00005?'difference':'matched';}
 function selectMappingMaterial(values,material){
  return values.material===material?values:{...values,material,unit:false,factor:'',unitReset:!!values.material||!!values.unitReset};
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
    difference:inbound===null?null:b.quantity-inbound,hasPeriodMovements:hits.length>0,reportLoaded:!!report};
  });
 }
 function trialDiagnostics(model){
  const flags=[];
  if(model.provisional)flags.push({code:'mapping',label:'料號尚未人工確認',action:'先核對原始品名與候選料號'});
  if(model.unitAssumed)flags.push({code:'unit',label:'單位暫按 1:1',action:'確認原表單位與倉庫單位，再填換算係數'});
  if(!model.reportLoaded)flags.push({code:'report',label:'期間庫存尚未取得',action:'先重新讀取總表，不把未知當成 0'});
  else if(!model.hasPeriodMovements)flags.push({code:'noMovement',label:'本月無該料號交易',action:'核對料號及收貨日期，可能與帳務月份不同'});
  else if(model.inbound===0)flags.push({code:'noInbound',label:'本月有異動，但無進貨入庫',action:'查入料／品管與收貨單據，不直接補庫存'});
  if(model.reportLoaded&&model.inbound===null)flags.push({code:'report',label:'期間數量資料不完整',action:'先核對正式總表來源'});
  if(model.difference!==null&&Math.abs(model.difference)>=.00005)flags.push({code:'difference',label:'暫算數量不同',action:'先查料號、單位，再查帳務月份與收貨單據'});
  if(model.provisional&&new Set(model.assignments.map(a=>a.group.label)).size>1)flags.push({code:'shared',label:'多個原品名暫配同一料號',action:'展開原始品名，檢查是否被相似字元誤配在一起'});
  if(!flags.length)flags.push({code:'matched',label:'本月數量一致',action:'依目前已確認對照與換算核對，並非實物盤點結果'});
  return flags;
 }
 function trialTransactions(report,sku){
  if(!report?.complete||!Array.isArray(report.transactions))return null;
  return report.transactions.filter(t=>t.materials?.sku===sku).sort((a,b)=>String(b.occurred_at||'').localeCompare(String(a.occurred_at||''))||String(b.id).localeCompare(String(a.id)));
 }
 function pendingItems(grouped,report){
  const items=[];
  grouped.forEach((g,index)=>{
   const type=g.status==='invalid'?'invalid':g.status==='pending'?'mapping':g.status==='confirmed'&&number(g.mapping.factor)===null?'unit':'';
   if(type)items.push({key:type+':'+g.key,type,sku:g.material?.code||g.material?.sku||'',groups:[index],difference:null});
  });
  if(report?.complete&&Array.isArray(report.rows))for(const item of compare(grouped,report)){
   if(item.unknownUnits||comparisonCategory(item)==='matched')continue;
   items.push({key:'quantity:'+item.sku,type:item.difference===null?'data':'quantity',sku:item.sku,groups:grouped.map((g,i)=>g.status==='confirmed'&&(g.material.code||g.material.sku)===item.sku?i:-1).filter(i=>i>=0),difference:item.difference,quantity:item.quantity,inbound:item.inbound,unit:item.unit});
  }
  return items;
 }
 function usageRanking(report){
  if(!report?.complete||!Array.isArray(report.rows))return null;
  if(report.rows.some(r=>number(r.outbound)===null))return null;
  const bySku=new Map();
  for(const row of report.rows){
   if(number(row.outbound)===null)continue;
   const k=key(row.sku,row.unit||'未填單位');
   if(!bySku.has(k))bySku.set(k,{sku:row.sku,name:row.name||'',unit:row.unit||'未填單位',quantity:0});
   bySku.get(k).quantity+=Number(row.outbound);
  }
  return [...bySku.values()].filter(x=>x.quantity>0).sort((a,b)=>b.quantity-a.quantity||a.sku.localeCompare(b.sku));
 }
 function purchaseOverview(grouped){
  const suppliers=new Map();let amount=0,known=0,missing=0;
  for(const g of grouped){
   if(!suppliers.has(g.supplier))suppliers.set(g.supplier,{supplier:g.supplier,amount:0,known:0,missing:0,rows:0});
   const s=suppliers.get(g.supplier);s.rows+=g.rows.length;s.amount+=g.amount;s.known+=g.rows.length-g.unknownAmount;s.missing+=g.unknownAmount;
   amount+=g.amount;known+=g.rows.length-g.unknownAmount;missing+=g.unknownAmount;
  }
  return {amount:known?amount:null,known,missing,suppliers:[...suppliers.values()].map(s=>({...s,amount:s.known?s.amount:null})).sort((a,b)=>(b.amount??-Infinity)-(a.amount??-Infinity)||a.supplier.localeCompare(b.supplier))};
 }
 function ledgerCsv(matrix){
  const cell=v=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,"'$&").replaceAll('"','""')+'"';
  return '\ufeff'+matrix.map(row=>row.map(cell).join(',')).join('\r\n');
 }
 const api={key,number,candidates,groups,compare,comparisonCategory,selectMappingMaterial,reviewCategory,filterGroups,reviewCsv,trialAssignments,trialModel,trialDiagnostics,trialTransactions,pendingItems,usageRanking,purchaseOverview,ledgerCsv};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.PurchaseLedger=api;
 if(typeof document==='undefined')return;
 const state={period:'2026-10',sub:'overview',q:'',status:'all',page:1,trialLimit:20,trialFilter:'all',compareFilter:'all',txLimits:{},monthlyQ:'',monthlyLimit:50,pendingFilter:'all',pendingLimit:20,usageUnit:'',previous:null,previousError:'',batch:null,mappings:[],materials:[],loaded:false,busy:false,error:'',report:null,reportError:'',draft:null,lastSaved:''};
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
   state.batch=data.batch;state.mappings=data.mappings;state.materials=inventory.materials.filter(m=>!m.status||m.status==='啟用');state.loaded=true;state.report=null;state.reportError='';state.txLimits={};state.previous=null;state.previousError='';state.draft=null;state.lastSaved='';
  }
  catch(e){state.error=e.message;state.loaded=false;state.batch=null;}
  finally{state.busy=false;redraw();}
  if(state.loaded&&['trial','monthly','pending','overview'].includes(state.sub))await loadPurchaseComparison();
 };
 root.purchaseLedgerChange=function(field,value){
  if(state.busy||state.draft?.saving)return;
  if(state.draft){showToast('請先儲存或取消目前這筆對照，再切換條件','warn');return;}
  state[field]=value;state.page=1;
  if(field==='sub')state.sourceSupplier='';
  if(field==='trialFilter')state.trialLimit=20;
  if(field==='pendingFilter')state.pendingLimit=20;
  if(field==='period'){state.loaded=false;state.batch=null;state.report=null;state.draft=null;loadPurchaseLedger();}else{redraw();if(field==='sub'&&['trial','monthly','pending','overview'].includes(value)&&state.loaded&&!state.report)loadPurchaseComparison();else if(field==='sub'&&value==='overview'&&!state.previous)loadPurchasePrevious();}
 };
 root.purchaseLedgerSearch=function(){if(state.draft){showToast('請先儲存或取消目前這筆對照','warn');return;}state.q=document.getElementById('pl-search')?.value.trim()||'';state.page=1;redraw();};
 function allGroups(){return groups(state.batch?.payload?.rows||[],state.mappings,state.materials);}
 root.morePurchaseTrial=function(){state.trialLimit+=20;redraw();};
 root.correctPurchaseTrial=function(index,focus=''){
  if(state.busy||state.draft)return;
  const all=allGroups(),g=all[index];if(!g)return;
  state.sub='mapping';state.status='all';state.q=g.label;state.page=Math.floor(filterGroups(all,'all',g.label).indexOf(g)/30)+1;
  openPurchaseMapping(index);
  if(focus==='unit'){const details=document.querySelector('.pl-inline-form details');if(details)details.open=true;document.getElementById('pl-factor')?.focus();}
 };
 function renderTrialReasons(model,grouped){
  const flags=trialDiagnostics(model),unit=model.assignments.find(a=>a.unitAssumed);
  return `<div class="pl-trial-reasons"><b>核對提示（可同時出現）</b><div class="pl-trial-tags">${flags.map(f=>`<span class="badge">${esc(f.label)}</span>`).join('')}</div><p>下一步：${esc(flags[0].action)}</p>${unit&&writeAllowed()?`<button class="btn btn-ghost btn-sm" data-group="${grouped.indexOf(unit.group)}" onclick="correctPurchaseTrial(Number(this.dataset.group),'unit')" ${state.busy?'disabled':''}>核對來源單位／換算</button>`:''}<details><summary>查看各項提示的核對方式</summary>${flags.map(f=>`<p><b>${esc(f.label)}</b>：${esc(f.action)}</p>`).join('')}</details></div>`;
 }
 function renderTrialTransactions(model){
  const rows=trialTransactions(state.report,model.sku);
  if(rows===null)return '<p class="pl-muted">尚未取得正式交易明細，不能據此認定沒有交易。</p>';
  const limit=state.txLimits[model.sku]||10;
  const when=v=>{if(!v)return '日期未填';const d=new Date(v);return Number.isNaN(d.getTime())?'日期待核對':d.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});};
  return `<details data-pl-tx="${esc(model.sku)}" ${limit>10?'open':''}><summary>本月正式庫存交易（${rows.length} 筆）</summary><p class="pl-muted">依交易時間由新到舊，目前顯示 ${Math.min(limit,rows.length)} / ${rows.length} 筆；只供追查，不會執行回料或補庫。</p>${rows.slice(0,limit).map(t=>`<div class="pl-trial-source"><b>${esc(t.source_number||'未填單號')} · ${esc(t.transaction_type||'異動')}</b><div>${esc(when(t.occurred_at))}（台灣時間） · 倉庫 ${esc(t.warehouses?.name||t.warehouses?.code||'未提供')}</div><div>異動 ${number(t.quantity_delta)>0?'+':''}${fmt(t.quantity_delta)} · ${fmt(t.quantity_before)} → ${fmt(t.quantity_after)}</div></div>`).join('')||'<p>該期間沒有這個料號的正式交易紀錄；請再核對料號及收貨日期。</p>'}${rows.length>limit?`<button class="btn btn-ghost" data-sku="${esc(model.sku)}" onclick="morePurchaseTransactions(this.dataset.sku)">再顯示 10 筆交易</button>`:''}</details>`;
 }
 root.morePurchaseTransactions=function(sku){state.txLimits[sku]=(state.txLimits[sku]||10)+10;redraw();};
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
  const filterOptions=[['all','全部料號'],['mapping','配號待確認'],['unit','單位待確認'],['noMovement','本月無交易'],['noInbound','有異動但無進貨入庫'],['difference','暫算數量不同'],['shared','多品名暫配同料號'],['report','總表待取得／待核對'],['matched','本月數量一致']];
  const filteredModels=model.filter(m=>state.trialFilter==='all'||trialDiagnostics(m).some(f=>f.code===state.trialFilter));
  const filter=`<div class="panel pl-toolbar"><label>試跑差異篩選<select class="inp" aria-label="試跑差異篩選" onchange="purchaseLedgerChange('trialFilter',this.value)">${filterOptions.map(([value,label])=>`<option value="${value}" ${state.trialFilter===value?'selected':''}>${label} ${value==='all'?model.length:model.filter(m=>trialDiagnostics(m).some(f=>f.code===value)).length} 個</option>`).join('')}</select></label><span class="pl-muted">同一料號可有多項提示，各類數量不可直接相加。</span></div>`;
  const sorted=[...filteredModels].sort((a,b)=>Math.abs(b.difference??0)-Math.abs(a.difference??0)).slice(0,state.trialLimit);
  const models=`<div class="panel pl-message"><h3>料號進出試算 · 符合 ${filteredModels.length} / 全月 ${model.length} 個</h3><p>依暫算差異大小排列。提示是核對線索，不代表已查明原因；可展開原始品名及正式交易逐步查驗。</p></div><div class="pl-list pl-trial-models">${sorted.map(m=>`<article class="panel pl-record"><div class="pl-record-head"><b>${esc(m.sku)}</b><span class="badge">${m.provisional?'含系統暫配':'人工料號'}${m.unitAssumed?' · 單位假設':''}</span></div><div class="pl-record-body">${renderTrialReasons(m,grouped)}<div class="pl-trial-numbers"><div>帳務進貨${m.unitAssumed?'（暫按1:1）':''}<b>${fmt(m.quantity)}</b></div><div>ERP 進貨入庫<b>${fmt(m.inbound)}</b></div><div>暫算差異<b>${fmt(m.difference)}</b></div><div>ERP 領料／出庫<b>${fmt(m.outbound)}</b></div></div><div>帳面期初 ${fmt(m.opening)} → 期末 ${fmt(m.closing)} ${esc(m.unit)}</div><div>原品項小計 ${fmt(m.amount)}${m.unknownAmounts?'（含缺值）':''}</div>${state.report&&!m.hasPeriodMovements?'<p class="pl-muted">此期間無該料號交易；總表未提供期初／期末，不能推論目前庫存為 0。</p>':''}<details class="pl-trial-originals"><summary>原始品名與校正（${m.assignments.length} 組）</summary>${m.assignments.map(a=>`<div class="pl-trial-source"><b>${esc(a.group.label)}</b><div>${esc(a.group.supplier)} · ${esc(sourceLine(a.group.rows[0]))}</div><div class="pl-muted">${esc(a.reason)}${a.unitAssumed?'；單位暫按 1:1':''}</div>${fix(a)}</div>`).join('')}</details>${renderTrialTransactions(m)}</div></article>`).join('')||`<div class="panel pl-message">${state.busy?'資料仍在讀取，暫不判定此類為 0。':'目前沒有符合此提示的料號；可切回「全部料號」。'}</div>`}</div>`;
  const unassigned=`<details class="panel pl-message" ${!model.length&&unresolved.length?'open':''}><summary>未配到料號／失效對照：${unresolved.length} 組</summary><p>保留在模型外，不假造入庫數量或新料號。</p><div class="pl-list">${unresolved.map(a=>`<div class="pl-trial-source"><b>${esc(a.group.label)}</b><div>${esc(a.group.supplier)} · ${esc(sourceLine(a.group.rows[0]))}</div><div class="pl-muted">${esc(a.reason)}</div>${fix(a)}</div>`).join('')}</div></details>`;
  const fees=`<details class="panel pl-message"><summary>費用／非物料：${expenses.length} 組（${feeGuesses} 組未確認）</summary><p>未納入物料數量比較；文字分類可能錯誤，可改回對應物料。</p><div class="pl-list">${expenses.map(a=>`<div class="pl-trial-source"><b>${esc(a.group.label)}</b><div>${esc(a.group.supplier)} · 原品項小計 ${fmt(a.group.amount)}</div><div class="pl-muted">${esc(a.reason)}</div>${fix(a)}</div>`).join('')}</div></details>`;
  const more=`<div class="pl-tabs"><span>目前顯示 ${sorted.length} / 篩選內 ${filteredModels.length} 個料號</span>${sorted.length<filteredModels.length?'<button class="btn btn-ghost" onclick="morePurchaseTrial()">再顯示 20 個料號</button>':''}</div>`;
  return note+kpis+coverage+reportState+unassigned+filter+models+more+fees;
 }
 const statusText={confirmed:'已確認料號',expense:'已確認非物料',pending:'待確認',invalid:'對照料號已失效'};
 const pendingText={mapping:'料號待確認',invalid:'對照已失效',unit:'單位待確認',quantity:'入庫數量不同',data:'入庫資料待核'};
 function reportNotice(){
  return state.report?`<p class="pl-muted">${esc(state.period)} · 正式交易產生 ${esc(state.report.generated_at)}（依台灣日期查詢）。資料為查詢快照，未鎖定月結。</p>`:`<div class="panel pl-message" role="status">${state.reportError?esc(state.reportError)+'；未取得總表，不把未知當成 0。':'正在讀取完整期間庫存總表…'}${state.busy?'':'<button class="btn btn-blue" onclick="loadPurchaseComparison()">重新讀取期間資料</button>'}</div>`;
 }
 function renderMonthly(){
  const intro='<div class="panel pl-message"><b>倉管｜每月物料進出總表</b><p>按倉庫與料號分列；期初＋各類增加－各類減少＝期末。只列本月有異動料號；帳面不等於盤點，未知不填零。</p></div>';
  if(!state.report)return intro+reportNotice();
  const d=state.report,q=state.monthlyQ.toLowerCase(),all=d.rows,rows=all.filter(r=>[r.sku,r.name,r.warehouse].some(v=>String(v||'').toLowerCase().includes(q)));
  const cols=inventoryReportColumns();
  return intro+reportNotice()+`<div class="panel pl-toolbar"><input class="inp" id="pl-monthly-search" aria-label="搜尋月總表" placeholder="搜尋料號、名稱或倉庫" value="${esc(state.monthlyQ)}" onkeydown="if(event.key==='Enter'&&!event.isComposing)searchPurchaseMonthly()"><button class="btn btn-blue" onclick="searchPurchaseMonthly()">搜尋總表</button><button class="btn btn-ghost" onclick="clearPurchaseMonthly()">清除搜尋</button><button class="btn btn-ghost" onclick="exportPurchaseMonthly()">下載月總表 Excel</button><button class="btn btn-ghost" onclick="previewPurchaseMonthly()">列印月總表／PDF</button></div><p class="pl-muted">符合 ${rows.length} / 全月 ${all.length} 個倉庫／料號 · ${d.transactions?.length??'未知'} 筆交易 · 交易鏈待核 ${all.filter(r=>r.checked!==true).length} 項。匯出與列印包含全月，不受搜尋或顯示筆數限制；不同料號不混加數量。</p><div class="table-wrap inventory-scroll-table" tabindex="0" role="region" aria-label="每月物料進出總表"><table class="inv-period-table"><thead><tr>${cols.map(([,label])=>`<th>${label}</th>`).join('')}<th>交易明細</th></tr></thead><tbody>${rows.slice(0,state.monthlyLimit).map(r=>`<tr>${cols.map(([k,label])=>`<td data-label="${label}">${esc(r[k]===null||r[k]===undefined?'待核對':r[k])}</td>`).join('')}<td data-label="交易明細"><button class="btn btn-ghost" data-key="${esc(r.key)}" onclick="openPurchaseMonthlyDetails(this.dataset.key)">查看交易</button></td></tr>`).join('')||`<tr><td colspan="${cols.length+1}">${all.length?'搜尋沒有符合項目，可清除搜尋。':'這個月沒有正式交易；不能推論所有庫存為零。'}</td></tr>`}</tbody></table></div><div class="pl-tabs"><span>顯示 ${Math.min(rows.length,state.monthlyLimit)} / ${rows.length} 項</span>${rows.length>state.monthlyLimit?'<button class="btn btn-ghost" onclick="morePurchaseRows(\'monthly\')">再顯示 50 項</button>':''}</div>`;
 }
 function renderPending(grouped){
  const all=pendingItems(grouped,state.report),rows=all.filter(x=>state.pendingFilter==='all'||x.type===state.pendingFilter);
  return `<div class="panel pl-message"><b>採購／行政｜進貨待核清單</b><p>先核對料號與單位，再追查入庫差額。差額按料號彙整，不指稱某家供應商漏交；本頁不自動補庫、結案或改對照。</p></div>`+reportNotice()+`<div class="pl-tabs" aria-label="待核原因篩選">${[['all','全部待核'],...Object.entries(pendingText)].map(([type,label])=>`<button class="btn ${state.pendingFilter===type?'btn-blue':'btn-ghost'}" aria-pressed="${state.pendingFilter===type}" data-filter="${type}" onclick="purchaseLedgerChange('pendingFilter',this.dataset.filter)">${label} ${type==='all'?all.length:all.filter(x=>x.type===type).length}</button>`).join('')}</div><div class="panel pl-toolbar"><span>符合 ${rows.length} / 目前可判定 ${all.length} 項 · 一項可能包含多筆來源列</span><button class="btn btn-ghost" onclick="exportPurchasePending()" ${rows.length?'':'disabled'}>下載目前待核清單</button></div>${!state.report?'<p class="pl-message">目前只列配號、失效與單位問題；入庫數量差異尚未檢查，不能視為已全部核對。</p>':''}<div class="pl-list pl-pending-list">${rows.slice(0,state.pendingLimit).map(item=>`<article class="panel pl-record"><div class="pl-record-head"><b>${esc(item.sku||grouped[item.groups[0]].label)}</b><span class="badge">${esc(pendingText[item.type])}</span></div><div class="pl-record-body">${item.type==='quantity'?`<div>帳務換算 ${fmt(item.quantity)} · 正式進貨入庫 ${fmt(item.inbound)} · 差額 ${fmt(item.difference)} ${esc(item.unit)}</div><p>核對收貨單、入料／品管紀錄及是否跨月，差額不是補庫依據。</p>`:item.type==='data'?'<p>入庫數量資料不足，先核對正式期間交易。</p>':`<p>${item.type==='unit'?'尚未確認數量換算，暫不計算此料號差額。':item.type==='invalid'?'原對照料號無法使用，保留原紀錄，請人工查驗。':'確認原品名對應哪個既有料號；相似候選不會自動保存。'}</p>`}${item.groups.map(i=>{const g=grouped[i];return `<div class="pl-trial-source"><b>${esc(g.label)}</b><div>${esc(g.supplier)} · Excel 第 ${g.rows.map(r=>r.line).join('、')} 列</div><div>原始數量 ${fmt(g.quantity)} · ${g.material?esc(g.material.code||g.material.sku):'尚未確認倉庫料號'}</div>${writeAllowed()?`<button class="btn btn-blue" data-group="${i}" onclick="correctPurchaseTrial(Number(this.dataset.group),'unit')">${item.type==='quantity'||item.type==='data'?'查看來源對照':'核對這筆來源'}</button>`:'<span class="pl-muted">唯讀角色</span>'}</div>`;}).join('')}${item.sku&&state.report?renderTrialTransactions(item):''}</div></article>`).join('')||`<div class="panel pl-message">${all.length?'目前篩選沒有符合項目。':state.report?'依已載入來源與總表，沒有待核項目；不代表實物盤點完成。':'目前沒有配號或單位待核項目，入庫差異仍待取得總表。'}</div>`}</div>${rows.length>state.pendingLimit?'<div class="pl-tabs"><button class="btn btn-ghost" onclick="morePurchaseRows(\'pending\')">再顯示 20 項</button></div>':''}`;
 }
 function renderBars(title,items,value,label){
  const max=Math.max(1,...items.map(x=>Math.abs(number(value(x))??0)));
  return `<section class="panel pl-message pl-chart"><h3>${esc(title)}</h3><ol>${items.map(x=>`<li><div><span>${esc(label(x))}</span><b>${fmt(value(x))}</b></div><div class="pl-bar-track" aria-hidden="true"><span style="width:${Math.min(100,100*Math.abs(number(value(x))??0)/max)}%"></span></div></li>`).join('')||'<li>目前沒有可呈現的數據。</li>'}</ol></section>`;
 }
 function renderOverview(grouped){
  const overview=purchaseOverview(grouped),usage=usageRanking(state.report),units=[...new Set((usage||[]).map(x=>x.unit))];
  if(!units.includes(state.usageUnit))state.usageUnit=units[0]||'';
  const ranked=(usage||[]).filter(x=>x.unit===state.usageUnit).slice(0,10),previous=state.previous?.batch?purchaseOverview(groups(state.previous.batch.payload.rows,state.previous.mappings,state.materials)):null;
  const pending=pendingItems(grouped,state.report);
  const kpi=(label,value,note)=>`<div class="kpi-card pl-overview-kpi"><div class="kpi-label">${label}</div><div class="kpi-num" style="font-size:1.6rem">${value}</div><div class="kpi-sub">${note}</div></div>`;
  const trend=state.period==='2026-10'?[{period:'2026-09',amount:previous?.amount??null},{period:state.period,amount:overview.amount}]:[{period:state.period,amount:overview.amount}];
  return `<div class="panel pl-message"><b>主管｜採購與用料概覽</b><p>先看來源金額、供應商與用料線索，再進總表或待核清單。金額為原表品項小計，含待配號及費用，不是含稅帳款、已確認物料採購成本或毛利；幣別以原表為準。</p></div><div class="dash-kpi-grid">${kpi('來源品項小計',fmt(overview.amount),`已知 ${overview.known} 列 · 缺金額 ${overview.missing} 列`)}${kpi('原始供應商',overview.suppliers.length,'依來源廠商文字區分，未自動合併')}${kpi('目前可判定待核',pending.length+' 項',state.report?'含配號、單位與入庫差異':'入庫差異尚未檢查')}${kpi('有領料／出庫料號',usage===null?'—':usage.length,'按料號＋單位計數，非銷售排行')}</div><div class="pl-tabs"><button class="btn btn-blue" onclick="purchaseLedgerChange('sub','pending')">處理進貨待核清單</button><button class="btn btn-ghost" onclick="purchaseLedgerChange('sub','monthly')">查看每月物料進出總表</button></div>`+reportNotice()+`<div class="pl-chart-grid">${renderBars('月別來源品項小計',trend,x=>x.amount,x=>x.period+(x.amount===null?'（未取得）':''))}${renderBars('供應商來源小計排行（前 8 名）',overview.suppliers.filter(x=>x.amount!==null).slice(0,8),x=>x.amount,x=>x.supplier)}</div><p class="pl-muted">月別圖只呈現已帶入的 9、10 月；缺值不當零。${overview.missing?'已知金額合計不是完整月金額。':''}${state.previousError?esc(state.previousError):''}</p><div class="panel pl-toolbar"><label>領料／出庫排行單位<select class="inp" aria-label="用料排行單位" onchange="purchaseLedgerChange('usageUnit',this.value)">${units.map(unit=>`<option ${unit===state.usageUnit?'selected':''}>${esc(unit)}</option>`).join('')||'<option>尚無可用資料</option>'}</select></label><span>不同單位分開看；不計入轉庫、手動調整，領料不等於實際消耗或銷貨。</span></div>${usage===null?'<div class="panel pl-message">完整期間總表尚未取得，不顯示用料排行為零。</div>':renderBars('領料／出庫數量排行（'+(state.usageUnit||'未填單位')+'，前 10 名）',ranked,x=>x.quantity,x=>x.sku)}<details class="panel pl-message"><summary>供應商明細與來源入口（${overview.suppliers.length} 家）</summary>${overview.suppliers.map(s=>`<div class="pl-trial-source"><b>${esc(s.supplier)}</b><div>已知小計 ${fmt(s.amount)} · ${s.rows} 列 · 缺金額 ${s.missing} 列</div><button class="btn btn-ghost" data-supplier="${esc(s.supplier)}" onclick="openPurchaseSupplier(this.dataset.supplier)">查看該供應商來源</button></div>`).join('')}</details>`;
 }
 function sourceLine(row){return `${state.batch?.payload?.sheet||''} 第 ${row.line} 列`;}
 root.renderPurchaseLedger=function(){
  if(!['vic','manager','purchase','warehouse','ai'].includes(ROLE))return '<div class="panel">目前角色沒有進銷存權限</div>';
  const grouped=allGroups(),rows=state.batch?.payload?.rows||[];
  const counts={all:grouped.length,confirmed:0,pending:0,expense:0,invalid:0};grouped.forEach(g=>counts[g.status]++);
  for(const category of ['exact','similar','unmatched'])counts[category]=grouped.filter(g=>reviewCategory(g)===category).length;
  const known=rows.filter(r=>number(r.amount)!==null),sum=known.reduce((s,r)=>s+Number(r.amount),0);
  const header=`<section class="module-brief"><div><h2>進銷存</h2><p>倉管看每月進出、採購追待核項目、主管看採購與用料。先用已帶入的 9、10 月資料；查詢與試跑不增減庫存。</p></div></section>
   <div class="panel pl-toolbar"><label>帳務月份 <select class="inp" onchange="purchaseLedgerChange('period',this.value)" ${state.busy?'disabled':''}><option value="2026-09" ${state.period==='2026-09'?'selected':''}>115 年 9 月</option><option value="2026-10" ${state.period==='2026-10'?'selected':''}>115 年 10 月</option></select></label><button class="btn btn-ghost" onclick="loadPurchaseLedger()" ${state.busy?'disabled':''}>${state.busy?'讀取中…':'重新讀取'}</button></div>`;
  if(state.error)return header+`<div class="panel pl-message" role="alert">${esc(state.error)}<p>資料未載入，不能當成沒有進貨；請按重新讀取。</p></div>`;
  if(!state.loaded)return header+'<div class="loading-row">正在讀取進貨來源與人工對照…</div>';
  if(!state.batch)return header+'<div class="panel pl-message">尚未帶入這個月的來源快照。雲端 ERP 不會直接讀取區網檔案；來源需由公司電腦的匯入工具送入。</div>';
  const cards=`<div class="dash-kpi-grid"><div class="kpi-card kpi-cyan"><div class="kpi-label">來源品項列</div><div class="kpi-num">${rows.length}</div><div class="kpi-sub">同一發票可有多列，非發票張數</div></div><div class="kpi-card kpi-amber"><div class="kpi-label">待確認對照</div><div class="kpi-num">${counts.pending+counts.invalid}</div><div class="kpi-sub">依廠商＋原始品名，共 ${grouped.length} 組</div></div><div class="kpi-card kpi-green"><div class="kpi-label">已確認物料／非物料</div><div class="kpi-num">${counts.confirmed} / ${counts.expense}</div><div class="kpi-sub">跨月份共用已保存的對照</div></div><div class="kpi-card"><div class="kpi-label">品項小計合計</div><div class="kpi-num" style="font-size:1.65rem">${fmt(sum)}</div><div class="kpi-sub">僅原表小計；非含稅帳款，缺值 ${rows.length-known.length} 列</div></div></div>`;
  const coverage=`<div class="panel pl-coverage" aria-label="對照進度">${[['confirmed','已確認料號'],['expense','非物料'],['pending','待確認'],['invalid','失效對照']].map(([s,l])=>`<div><span>${l} ${counts[s]} 組</span><meter min="0" max="${grouped.length||1}" value="${counts[s]}">${counts[s]}</meter></div>`).join('')}</div>`;
  const source=`<details class="panel pl-message"><summary>來源與核對規則</summary><p>${esc(state.batch.source_key)} · ${esc(state.batch.payload.sheet)} · 匯入 ${esc(state.batch.created_at)}<br>來源指紋 ${esc(state.batch.source_hash.slice(0,12))}；保留原始品名與 Excel 列號。排除月份標題、合計及空白公式列。數量不跨不同品項加總；單位換算未確認前不比較庫存數量。銀行、支票與付款資料未帶入本階段。</p><p>本頁尚未串接銷貨與自動區網同步。料號對照不會改寫 BOM、舊訂單或倉庫料號。</p></details>`;
  const nav=items=>items.map(([s,l])=>`<button class="btn ${state.sub===s?'btn-blue':'btn-ghost'}" aria-pressed="${state.sub===s}" onclick="purchaseLedgerChange('sub','${s}')">${l}</button>`).join('');
  const tabs=`<div class="pl-tabs" aria-label="進銷存工作入口">${nav([['overview','採購與用料概覽'],['monthly','每月物料進出總表'],['pending','進貨待核清單']])}</div><details class="pl-source-tools" ${['trial','mapping','details','compare'].includes(state.sub)?'open':''}><summary>料號與來源核對工具</summary><div class="pl-tabs">${nav([['trial','系統試跑'],['mapping','料號對照'],['details','進貨明細'],['compare','期間進出核對']])}</div></details>`;
  if(state.sub==='monthly')return header+tabs+renderMonthly()+source;
  if(state.sub==='pending')return header+tabs+renderPending(grouped)+source;
  if(state.sub==='overview')return header+tabs+renderOverview(grouped)+source;
  if(state.sub==='trial')return header+tabs+renderPurchaseTrial(grouped)+source;
  if(state.sub==='compare')return header+tabs+renderComparison(grouped)+source;
  const filtered=filterGroups(grouped,state.status,state.q).filter(g=>state.sub!=='details'||!state.sourceSupplier||g.supplier===state.sourceSupplier);
  const supplierScope=state.sub==='details'&&state.sourceSupplier?`<div class="panel pl-toolbar"><b>供應商範圍：${esc(state.sourceSupplier)}（精確名稱）</b><button class="btn btn-ghost" onclick="clearPurchaseSupplier()">清除供應商範圍</button></div>`:'';
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
  return header+cards+coverage+tabs+supplierScope+toolbar+content+`<div class="pl-tabs"><button class="btn btn-ghost" onclick="purchaseLedgerPage(-1)" ${page<=1?'disabled':''}>上一頁</button><button class="btn btn-ghost" onclick="purchaseLedgerPage(1)" ${page*30>=listed.length?'disabled':''}>下一頁</button></div>`+source;
 };
 root.purchaseLedgerPage=function(delta){if(state.draft){showToast('請先儲存或取消目前這筆對照','warn');return;}state.page=Math.max(1,state.page+delta);redraw();};
 root.exportPurchaseReview=function(){
  const selected=filterGroups(allGroups(),state.status,state.q).filter(g=>state.sub!=='details'||!state.sourceSupplier||g.supplier===state.sourceSupplier);if(!selected.length)return;
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
  if(selected){state.draft.values=selectMappingMaterial(state.draft.values,selected);state.draft.values.kind='material';}
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
  if(state.draft&&!state.draft.saving&&!state.draft.uncertain)state.draft.values=selectMappingMaterial(state.draft.values,value);
  const v=state.draft.values;document.getElementById('pl-unit-confirmed').checked=v.unit;document.getElementById('pl-factor').value=v.factor;
  let warning=document.getElementById('pl-unit-warning');if(!warning){warning=document.createElement('p');warning.id='pl-unit-warning';warning.setAttribute('role','status');document.getElementById('pl-material-fields').prepend(warning);}
  warning.textContent=v.unitReset?'料號已變更；舊換算不會沿用，請為目前料號重新確認。':'';
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
  if(state.busy||state.draft)return;state.busy=true;state.reportError='';redraw();
  const [year,month]=state.period.split('-').map(Number),end=new Date(Date.UTC(year,month,0)).getUTCDate();
  try{
   const res=await fetch(PROXY+'/api/inventory/period-report?'+new URLSearchParams({start:state.period+'-01',end:state.period+'-'+end}),{headers:erpWorkerHeaders(),cache:'no-store'});
   const data=await res.json();if(!res.ok||!data.ok||!data.complete||!Array.isArray(data.rows)||!Array.isArray(data.transactions))throw Error(data.error||'期間總表未完整載入');state.report=data;
  }catch(e){state.report=null;state.reportError=e.message;}finally{state.busy=false;redraw();}
  if(state.sub==='overview')await loadPurchasePrevious();
 };
 root.loadPurchasePrevious=async function(){
  if(state.busy||state.draft||state.period!=='2026-10'||state.previous)return;
  state.busy=true;redraw();
  try{state.previous=await request('list?period=2026-09');state.previousError=state.previous.batch?'':'9 月尚無來源快照，不能做完整月別比較。';}
  catch(e){state.previousError='9 月來源未取得：'+e.message;}
  finally{state.busy=false;redraw();}
 };
 root.searchPurchaseMonthly=function(){state.monthlyQ=document.getElementById('pl-monthly-search')?.value.trim()||'';state.monthlyLimit=50;redraw();};
 root.clearPurchaseMonthly=function(){state.monthlyQ='';state.monthlyLimit=50;redraw();};
 root.morePurchaseRows=function(type){if(type==='monthly')state.monthlyLimit+=50;else if(type==='pending')state.pendingLimit+=20;redraw();};
 root.openPurchaseSupplier=function(supplier){if(state.busy||state.draft)return;state.sub='details';state.status='all';state.q='';state.sourceSupplier=supplier;state.page=1;redraw();};
 root.clearPurchaseSupplier=function(){state.sourceSupplier='';state.page=1;redraw();};
 root.openPurchaseMonthlyDetails=function(key,page=1){
  const d=state.report,row=d?.rows.find(r=>r.key===key);if(!row)return;
  const tx=d.transactions.filter(t=>t.warehouse_id+':'+t.material_id===key),pages=Math.max(1,Math.ceil(tx.length/100));page=Math.max(1,Math.min(page,pages));
  document.getElementById('modalInner').innerHTML=`<h3>${esc(row.sku)} · ${esc(row.warehouse)}</h3><p>${esc(state.period)} · ${tx.length} 筆正式交易，第 ${page} / ${pages} 頁；唯讀查詢。</p>${tx.slice((page-1)*100,page*100).map(t=>`<div class="pl-trial-source"><b>${esc(t.source_number||'未填單號')} · ${esc(t.transaction_type)}</b><div>${esc(new Date(t.occurred_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}))}</div><div>${fmt(t.quantity_before)} → ${fmt(t.quantity_after)}（異動 ${fmt(t.quantity_delta)}）</div></div>`).join('')||'<p>未取得該筆逐筆明細，不推論為沒有交易。</p>'}<div class="pl-tabs"><button class="btn btn-ghost" data-key="${esc(key)}" onclick="openPurchaseMonthlyDetails(this.dataset.key,${page-1})" ${page<=1?'disabled':''}>上一頁明細</button><button class="btn btn-ghost" data-key="${esc(key)}" onclick="openPurchaseMonthlyDetails(this.dataset.key,${page+1})" ${page>=pages?'disabled':''}>下一頁明細</button><button class="btn btn-ghost" onclick="closeModal()">關閉明細</button></div>`;openSharedModal();
 };
 root.exportPurchaseMonthly=async function(){
  const d=state.report;if(!d||state.exportBusy)return;state.exportBusy=true;
  try{
   await ensureXlsxLoaded();const data=inventoryReportWorkbookData(d),book=XLSX.utils.book_new();
   const summary=XLSX.utils.aoa_to_sheet(data.summary),details=XLSX.utils.aoa_to_sheet(data.details);
   summary['!cols']=[{wch:16},{wch:30},{wch:36},{wch:8},...Array.from({length:12},()=>({wch:16})),{wch:32}];details['!cols']=[{wch:38},{wch:24},{wch:16},{wch:30},{wch:36},{wch:8},{wch:18},{wch:22},{wch:16},{wch:16},{wch:16},{wch:28},{wch:44}];
   summary['!autofilter']={ref:'A5:Q'+data.summary.length};details['!autofilter']={ref:'A5:M'+data.details.length};
   XLSX.utils.book_append_sheet(book,summary,'料號彙總');XLSX.utils.book_append_sheet(book,details,'逐筆明細');
   XLSX.writeFile(book,'物料進出總表_'+d.start+'_'+d.end+'.xlsx',{bookType:'xlsx',compression:true});showToast('已送出完整月總表 Excel 下載','success');
  }catch(e){showToast('月總表匯出失敗：'+e.message,'warn');}finally{state.exportBusy=false;}
 };
 root.previewPurchaseMonthly=function(){
  if(!state.report)return;
  document.getElementById('modalInner').innerHTML='<h3>每月物料進出總表列印預覽</h3><p>A4 橫式；包含全月，不受搜尋限制。帳面非盤點，未鎖定月結。</p><iframe id="pl-monthly-print" title="月總表列印預覽" sandbox="allow-same-origin allow-modals" style="width:100%;height:55vh" onload="document.getElementById(\'pl-print-button\').disabled=false"></iframe><div class="pl-tabs"><button id="pl-print-button" class="btn btn-blue" disabled onclick="printPurchaseMonthly()">列印／另存 PDF</button><button class="btn btn-ghost" onclick="closeModal()">關閉預覽</button></div>';
  document.getElementById('pl-monthly-print').srcdoc=buildInventoryPeriodPrint(state.report);openSharedModal();
 };
 root.printPurchaseMonthly=function(){try{const win=document.getElementById('pl-monthly-print').contentWindow;win.focus();win.print();}catch(e){showToast('無法開啟列印，請用電腦瀏覽器重試','warn');}};
 root.exportPurchasePending=function(){
  const grouped=allGroups(),items=pendingItems(grouped,state.report).filter(x=>state.pendingFilter==='all'||x.type===state.pendingFilter);
  const csv=ledgerCsv([['月份','待核原因','倉庫料號','原始廠商','原始品名','Excel列號','帳務換算數量','正式入庫','差額','單位','來源指紋'],...items.map(x=>[state.period,pendingText[x.type],x.sku,x.groups.map(i=>grouped[i].supplier).join('、'),x.groups.map(i=>grouped[i].label).join('、'),x.groups.flatMap(i=>grouped[i].rows.map(r=>r.line)).join('、'),x.quantity,x.inbound,x.difference,x.unit,state.batch.source_hash])]);
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='進貨待核_'+state.period+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 function renderComparison(grouped){
  const intro=`<div class="panel pl-message"><b>已確認料號的帳務進貨 × 正式進貨入庫</b><p>差異只供追查，不代表庫存錯誤；單位未確認時不計算差異。</p><button class="btn btn-blue" onclick="loadPurchaseComparison()" ${state.busy?'disabled':''}>${state.busy?'讀取中…':'讀取本月期間進出總表'}</button><details><summary>比較口徑與限制</summary><p>帳務月份與實際入庫月份可能不同。ERP 欄位取自正式期間進出總表的「進貨入庫」，不含組立產出、退貨或轉庫。沒有交易的料號顯示 0 進貨入庫，不能推論庫存為 0；數量一致也不代表已完成實物盤點。</p></details></div>`;
  if(state.reportError)return intro+`<div class="panel pl-message" role="alert">${esc(state.reportError)}；尚未取得完整總表，不計算差異。</div>`;
  if(!state.report)return intro+'<div class="panel pl-message">請先讀取本月總表。未確認的品名與非物料不納入數量比較。</div>';
  const items=compare(grouped,state.report);
  const options=[['all','全部已確認料號'],['difference','數量不同'],['matched','數量一致'],['unknown','單位／資料待確認']];
  const visible=items.filter(x=>state.compareFilter==='all'||comparisonCategory(x)===state.compareFilter);
  const summary=`<div class="panel pl-coverage" aria-label="正式核對統計">${options.map(([k,label])=>`<div><b>${label}</b><div>${k==='all'?items.length:items.filter(x=>comparisonCategory(x)===k).length} 個料號</div></div>`).join('')}</div><div class="panel pl-toolbar"><label>核對結果<select class="inp" aria-label="正式核對結果篩選" onchange="purchaseLedgerChange('compareFilter',this.value)">${options.map(([value,label])=>`<option value="${value}" ${value===state.compareFilter?'selected':''}>${label}</option>`).join('')}</select></label><span>符合 ${visible.length} / ${items.length} 個已確認料號</span></div>`;
  return intro+`<p class="pl-muted">${esc(state.period)} · 總表產生 ${esc(state.report.generated_at)}；待處理 ${grouped.filter(g=>g.status==='pending'||g.status==='invalid').length} 組、非物料 ${grouped.filter(g=>g.status==='expense').length} 組未納入。只有料號與單位皆確認，才計算差異；一致也不代表實物盤點完成。</p>`+summary+`<div class="pl-list pl-comparison-list">${visible.map(x=>{
   const sources=grouped.filter(g=>g.status==='confirmed'&&(g.material.code||g.material.sku)===x.sku);
   return `<article class="panel pl-record"><div class="pl-record-head"><b>${esc(x.sku)}</b><span class="badge">${esc(options.find(([k])=>k===comparisonCategory(x))[1])}</span></div><div class="pl-record-body"><div>帳務進貨換算數量：${x.unknownUnits?'單位尚未確認':fmt(x.quantity)} ${esc(x.unit)}</div><div>ERP 期間進貨入庫：${fmt(x.inbound)}</div><div>差異（帳務－入庫）：<b>${fmt(x.difference)}</b></div><div class="pl-muted">${x.sourceRows} 筆帳務列 · ${x.inventoryRows} 個倉庫彙總；請核對日期與收貨紀錄。</div><details class="pl-compare-sources"><summary>帳務來源與換算（${sources.length} 組）</summary>${sources.map(g=>`<div class="pl-trial-source"><b>${esc(g.label)}</b><div>${esc(g.supplier)} · Excel 第 ${g.rows.map(r=>r.line).join('、')} 列</div><div>原數量 ${fmt(g.quantity)} × ${fmt(g.mapping.factor)} → ${number(g.mapping.factor)===null?'單位待確認':fmt(g.quantity*Number(g.mapping.factor))+' '+esc(x.unit)}</div>${writeAllowed()?`<button class="btn btn-ghost" data-group="${grouped.indexOf(g)}" onclick="correctPurchaseTrial(Number(this.dataset.group),'unit')">核對這筆來源／換算</button>`:''}</div>`).join('')}</details>${renderTrialTransactions(x)}</div></article>`;
  }).join('')||`<div class="panel pl-message">${items.length?'目前篩選沒有符合的料號，可切回全部已確認料號。':'尚無人工確認的料號，請先完成料號對照。'}</div>`}</div>`;
 }
})(typeof globalThis==='undefined'?this:globalThis);

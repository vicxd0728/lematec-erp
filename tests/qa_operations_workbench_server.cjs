// Local-only acceptance: actual published/local UI functions, synthetic state, no credentials.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),crypto=require('node:crypto');
const sourcePath=process.env.ERP_QA_SOURCE||path.join(__dirname,'../index.html');
let state;function reset(name='refreshFail'){state={name,approvals:0,moves:0,balance:10,approved:[],failedOnce:false,refreshFailed:false};}reset();
function fixtures(){return Array.from({length:125},(_,i)=>({id:'ib-'+i,supabaseId:'sup-'+i,no:'IB-QA-'+(i+1),matId:'m-'+i,matCode:'Y-QA-'+String(i+1).padStart(3,'0'),matName:'測試零件'+(i+1),supplier:i%2?'廠商乙':'廠商甲',qty:2,date:'2026-10-21',qcStatus:i<2&&!state.approved.includes('ib-'+i)?'待品檢':'品檢通過',stStatus:i<2&&!state.approved.includes('ib-'+i)?'待入庫':'已入庫'}));}
function page(){
 const html=fs.readFileSync(sourcePath,'utf8'),hash=crypto.createHash('sha256').update(html).digest('hex');
 const cut=(a,b)=>{const x=html.indexOf(a),y=html.indexOf(b,x);if(x<0||y<x)throw Error('Missing section '+a);return html.slice(x,y);};
 const styles=[...html.slice(0,html.indexOf('</head>')).matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(x=>x[0]).join('\n')+'<style>#qaSource{overflow-wrap:anywhere;font-size:12px}</style>';
 const functions=[cut('function operationalReadState(','async function readPicks('),cut('function pickingVisualStage(','function inboundListFilters('),cut('function inboundListFilters(','function openResubmitInbound('),cut('function qcPendingSearchState(','function orderAuditLogText('),cut('function selectedQCBatchInboundIds(','function openInboundApprovePreflight(')].join('\n');
 const setup=`let CURRENT_TAB='picking',ROLE='warehouse',QC_SUB='pending',QC_DATE='0',QC_KIND='all',QC_FILTER='all',SORT={};
 const ORDER_RETURN_REQUEST_STATUS='待回料確認',_qcInspectionsError='',_qcInspectionsLoading=false;
 window._picksLoaded=true;window._inboundsLoaded=true;window._coreLoaded=true;window._pickingDataSource='supabase';window._inboundDataSource='supabase';window._qcInspections=[];
 let inbounds=${JSON.stringify(fixtures())};const mats=inbounds.map(i=>({id:i.matId,code:i.matCode,name:i.matName})),orders=[{id:'order-1',no:'ORD-QA-1',customer:'客戶甲',product:'Y-QA-001',productId:'m-0',qty:2,status:'待檢驗'}];
 const picks=inbounds.map((i,n)=>({id:'pick-'+n,supabaseId:'pick-'+n,no:'PK-QA-'+(n+1),orderId:'order-1',product:'組立零件',qty:2,date:i.date,status:'已領料',items:[{matId:i.matId,code:i.matCode,name:i.matName,qty:2,pickedQty:2,status:'已領料'}]}));
 const ROLES={warehouse:{tabs:['orders','picking','inbound','qc']},qc:{tabs:['picking','inbound','qc']},viewer:{tabs:['picking','inbound','qc']}};
 const escapeHtml=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'),canonicalPageId=v=>String(v||'').replaceAll('-',''),isViewOnly=()=>ROLE==='viewer',isAdminRole=()=>false,dashboardCanCreateInbound=()=>ROLE==='warehouse',applyDateFilterValue=(v,r)=>r,applySort=(k,r)=>{const s=SORT[k];return s?[...r].sort((a,b)=>(s.type==='num'?Number(a[s.col])-Number(b[s.col]):String(a[s.col]||'').localeCompare(String(b[s.col]||'')))*(s.dir==='asc'?1:-1)):r},TH=(t,c,l,k,cls)=>'<th class="'+(cls||'')+'">'+l+'</th>',pill=v=>'<span class="pill">'+escapeHtml(v)+'</span>';
 const canConfirmOrderReturnRequest=()=>ROLE==='warehouse',buildPickingReversalRows=()=>[],completedOrderPickingRows=()=>[],canRequestOrderReturn=()=>false,isFresh=()=>true,shortageSourceOrderLink=()=>'',qcInspectionRangeDays=()=>30,qcLoadTimeLabel=()=> '合成資料',qcInspectionsReady=()=>true,getInspectionOrders=()=>orders,orderProductName=o=>o.product,renderErpVisualRows=()=>'';
 function renderTab(tab=CURRENT_TAB){CURRENT_TAB=tab;document.getElementById('mainContent').innerHTML=tab==='picking'?renderPicking():tab==='inbound'?renderInbound():renderQCTab();}
 function goQA(tab,role){ROLE=role;renderTab(tab);}function openSharedModal(){document.getElementById('qaModal').hidden=false;}function closeModal(){document.getElementById('qaModal').hidden=true;}
 function showToast(s){document.getElementById('qaToast').textContent=s;}const sleep=ms=>new Promise(r=>setTimeout(r,Math.min(ms,100)));
 async function approveQC(id){const response=await fetch('/qa/approve',{method:'POST',body:JSON.stringify({id})});const data=await response.json();if(!response.ok)throw Error(data.error);await readQAState();return data;}
 async function refreshAffectedData(){const r=await fetch('/qa/refresh');const d=await r.json();await readQAState();if(!r.ok)throw Error(d.error);inbounds=d.rows;}
 async function readQAState(){document.getElementById('qaState').textContent=JSON.stringify(await(await fetch('/qa/state')).json());}
 async function resetQA(name){await fetch('/qa/reset',{method:'POST',body:JSON.stringify({name})});location.reload();}
 window.addEventListener('error',e=>document.getElementById('qaErrors').textContent+=e.message+'\\n');
 `;
 return `<!doctype html><html lang="zh-Hant" data-theme="premium"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>領料入料品管隔離驗收</title>${styles}<style>body{padding:12px}#mainContent{position:static!important;height:auto!important;overflow:visible!important;padding:4px!important;min-width:0;width:100%}#qaNav{border:1px solid cyan;padding:12px;display:flex;flex-wrap:wrap;gap:8px}#qaState,#qaErrors{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}#qaModal{position:fixed;inset:0;background:#000b;z-index:5000;overflow:auto;padding:16px}#qaModal[hidden]{display:none!important}#modalInner{max-width:780px;margin:20px auto;padding:20px;background:var(--bg2);border:1px solid var(--border);border-radius:14px}</style><body><nav id="qaNav"><b>隔離驗收 · 正式連線0 · ${state.name}</b><button class="btn btn-blue" onclick="goQA('picking','warehouse')">領料查詢</button><button class="btn btn-blue" onclick="goQA('inbound','warehouse')">入料查詢</button><button class="btn btn-blue" onclick="goQA('qc','qc')">品管作業</button><button class="btn btn-ghost" onclick="goQA('qc','viewer')">唯讀品管</button><button class="btn btn-ghost" onclick="resetQA('refreshFail')">測試重讀失敗</button><button class="btn btn-ghost" onclick="resetQA('itemFail')">測試單筆失敗</button><button class="btn btn-ghost" onclick="resetQA('lostResponse')">測試回應遺失</button></nav><div id="qaSource" data-source-hash="${hash}">來源 SHA256 ${hash}</div><div id="qaToast" role="status"></div><pre id="qaState"></pre><pre id="qaErrors"></pre><main id="mainContent"></main><div id="qaModal" hidden><div id="modalInner"></div></div><script>${setup}${functions}\nrenderTab();readQAState();</script></body></html>`;
}
http.createServer(async(req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'");res.setHeader('Cache-Control','no-store');let body='';for await(const b of req)body+=b;
 const json=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 try{
  if(req.url==='/'&&req.method==='GET'){res.setHeader('Content-Type','text/html;charset=utf8');return res.end(page());}
  if(req.url==='/qa/state')return json(200,{...state,production_requests:0});
  if(req.url==='/qa/reset'&&req.method==='POST'){const name=JSON.parse(body).name;if(!['refreshFail','itemFail','lostResponse'].includes(name))throw Error('invalid fixture');reset(name);return json(200,state);}
  if(req.url==='/qa/refresh'&&req.method==='GET'){
   if(state.name==='refreshFail'&&!state.refreshFailed){state.refreshFailed=true;return json(503,{error:'隔離測試：列表讀取中斷'});}return json(200,{rows:fixtures()});
  }
  if(req.url==='/qa/approve'&&req.method==='POST'){
   const id=JSON.parse(body).id;if(!['ib-0','ib-1'].includes(id))throw Error('fixture IDs only');state.approvals++;await new Promise(r=>setTimeout(r,600));
   if(state.name==='itemFail'&&id==='ib-1'&&!state.failedOnce){state.failedOnce=true;return json(503,{error:'隔離測試：服務暫時無法處理'});}
   const duplicate=state.approved.includes(id);if(!duplicate){state.approved.push(id);state.moves++;state.balance+=2;}
   if(state.name==='lostResponse'&&id==='ib-1'&&!state.failedOnce){state.failedOnce=true;return json(503,{error:'隔離測試：送出後未收到回應'});}
   return json(200,{ok:true,duplicate});
  }json(404,{error:'local QA routes only'});
 }catch(e){json(400,{error:e.message});}
}).listen(8772,'127.0.0.1',()=>console.log('Isolated operations QA http://127.0.0.1:8772 ; source '+sourcePath));

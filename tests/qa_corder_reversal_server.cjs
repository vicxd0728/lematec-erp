// Isolated browser QA only: actual UI/Worker functions, memory adapters, loopback HTTP.
const http=require('node:http'),fs=require('node:fs'),{harness}=require('./helpers/corder_reversal_harness.cjs');
const html=fs.readFileSync('index.html','utf8');let h=harness({status:'出貨中',failure:'patchFail'}),caseName='cancelPatch';
const cases={cancelPatch:{status:'出貨中',failure:'patchFail'},cancelLost:{status:'出貨中',failure:'lostResponse'},returnLost:{failure:'lostResponse'},returnPatch:{failure:'patchFail'},returnLog:{failure:'logFail'},returnNormal:{},cancelScrap:{status:'出貨中'},returnScrap:{}};
function clientOrder(){const p=h.state.page.properties,text=k=>(p[k].rich_text||p[k].title).map(x=>x.text.content).join('');return {id:h.pageId,no:text('訂單號碼'),shopeeNo:text('蝦皮訂單號碼'),buyer:text('買家帳號'),matCode:text('品名'),matName:text('品名'),qty:p.數量.number,matId:text('料件ID'),status:p.狀態.select.name,note:text('備註'),created:'2026-10-20'};}
function page(){
 const styles=[...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(x=>x[0]).join('\n');
 const renderer=html.slice(html.indexOf('function corderSelectionIds('),html.indexOf('function pickShortageMaterialMatch('));
 const helpers=html.slice(html.indexOf('function parseCorderStockRefs('),html.indexOf('function filterCorderMatOptions('));
 const actions=html.slice(html.indexOf('async function returnCorderStock('),html.indexOf('function openEditCorder('));
 const setup=`const ROLE='sales',CURRENT_TAB='corders',PROXY='',CORDER_SEQUENCE_STATE={next_number:20001},DATA_LOAD_MODE={corders:'all'},DATA_LOAD_DAYS={corders:30},FIRST_LOAD_DAYS=30;
 window._cordersLoaded=true;window.corders=[${JSON.stringify(clientOrder())}];const mats=[{id:'${h.a}',code:'S-QA-A',name:'測試零件A',stock:9},{id:'${h.b}',code:'S-QA-B',name:'測試零件B',stock:8}];
 const isViewOnly=()=>false,isAdminRole=()=>false,denyViewOnlyAction=()=>false,getCorderSearchDraft=()=>'',nextCorderInternalNo=()=> 'SHPTW20001',corderSequenceReady=()=>true,limitedDataHint=()=>'',escapeHtml=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),searchIncludesAll=(s,q)=>s.includes(q),erpWorkerHeaders=x=>({...x,'X-ERP-Role':'sales'}),normalizeSku=s=>s,orderAuditLogText=r=>r.original_action||'',orderAuditMaterialKey=r=>r.material_id,todayStr=()=> '2026-10-20';
 async function assertCorderStockActionIdentity(){} // Worker independently validates the authoritative identity.
 function openModal(){document.getElementById('qaModal').hidden=false;}function closeModal(){document.getElementById('qaModal').hidden=true;}
 function renderTab(){document.getElementById('mainContent').innerHTML=renderCorders();}
 function showToast(text){document.getElementById('qaToast').textContent=text;readState();}
 async function readState(){const s=await (await fetch('/qa/state')).json();document.getElementById('qaState').textContent=JSON.stringify(s);return s;}
 async function refreshAffectedData(){const s=await readState();Object.assign(window.corders[0],{status:s.status,note:s.note});await loadCorderReversalPending();}
 function logUserAction(){}
 async function resetCase(name){localStorage.removeItem('erp-corder-reversal:${h.pageId}');await fetch('/qa/reset',{method:'POST',body:JSON.stringify({name})});location.reload();}
 window.addEventListener('resize',()=>renderTab());
 `;
 return `<!doctype html><html lang="zh-Hant" data-theme="premium"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ERP 取消退貨隔離驗收</title>${styles}<style>body{padding:12px}.qa-banner{border:1px solid cyan;padding:12px;background:#10313c}.qa-banner button{margin:4px}#qaState{white-space:normal;overflow-wrap:anywhere;font-size:12px}#qaToast{padding:12px;overflow-wrap:anywhere}#qaModal{position:fixed;inset:0;background:#000b;z-index:5000;overflow:auto;padding:16px}#qaModal[hidden]{display:none!important}#modalInner{max-width:760px;margin:20px auto;padding:20px;background:var(--bg2);border:1px solid var(--border);border-radius:14px}</style><body><div class="qa-banner"><b>隔離驗收 · 業務角色 · 無正式資料或憑證 · 正式庫存異動0</b><p>案例 ${caseName}；測試庫存A=9／B=8，原訂單3組，每組A×1／B×2</p>${Object.keys(cases).map(k=>`<button class="btn btn-ghost" onclick="resetCase('${k}')">${k}</button>`).join('')}<pre id="qaState"></pre></div><div id="qaToast" role="status"></div><main id="mainContent"></main><div id="qaModal" hidden><div id="modalInner"></div></div><script>${setup}${helpers}${actions}${renderer}\nloadCorderReversalPending().then(()=>{renderTab();readState();});</script></body></html>`;
}
http.createServer(async(req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");res.setHeader('Cache-Control','no-store');let body='';for await(const b of req)body+=b;
 try{
 if(req.url==='/'&&req.method==='GET'){res.setHeader('Content-Type','text/html;charset=utf8');res.end(page());return;}
 if(req.url==='/qa/reset'){const name=JSON.parse(body).name;if(!cases[name])throw Error('invalid case');h=harness(cases[name]);caseName=name;}
 else if(req.url==='/api/corder/reversal'){
  if(req.method==='GET'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,pending:h.state.ledger?.pending?[{page_id:h.pageId,action:h.state.ledger.pending.action}]:[]}));return;}
  await new Promise(r=>setTimeout(r,1000));const result=await h.run(JSON.parse(body));res.statusCode=result.status;res.setHeader('Content-Type','application/json');res.end(await result.text());return;
 }else if(req.url.startsWith('/api/stock-log/list')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,rows:[],has_more:false}));return;}
 else if(req.url!=='/qa/state'){res.statusCode=404;res.end();return;}
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({case:caseName,...h.snapshot()}));
 }catch(e){res.statusCode=400;res.end(JSON.stringify({error:e.message}));}
}).listen(8770,'127.0.0.1',()=>console.log('Isolated C-end cancel/return QA http://127.0.0.1:8770 ; no credentials/external network'));

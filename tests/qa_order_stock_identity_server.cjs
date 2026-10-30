// Localhost-only, real frontend actions + real Worker functions, memory data only.
const http=require('node:http'),fs=require('node:fs'),{harness}=require('./helpers/order_stock_identity_harness.cjs');
const html=fs.readFileSync(process.env.ERP_QA_SOURCE||'index.html','utf8');
const cases={similar:{},archiveLost:{failure:'archiveLost'},returnLost:{owned:true,failure:'lostResponse'},readFail:{readFail:true}};
let mode='similar',h=harness(cases[mode]);
function page(){
 const styles=[...html.split('</head>')[0].matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(x=>x[0]).join('\n');
 const helpers=html.slice(html.indexOf('function orderAuditLogText('),html.indexOf('const _orderStockInReversalLocks='));
 const del=html.slice(html.indexOf('async function deleteOrder(oid,'),html.indexOf('// ── 料件主檔編輯'));
 const role=mode==='returnLost'?'warehouse':'sales';
 const setup=`const ROLE='${role}',CURRENT_TAB='orders',PROXY='';let orders=${JSON.stringify(h.ids)};
 const canonicalPageId=s=>String(s||'').replaceAll('-',''),escapeHtml=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'),erpWorkerHeaders=x=>({...x,'X-ERP-Role':ROLE}),denyViewOnlyAction=()=>false,canConfirmOrderReturnRequest=()=>ROLE==='warehouse';
 const openOrderPickingBlockedModal=()=>{throw Error('unexpected active picks in delete case')},loadOrderPickingGuardRows=async()=>[],logUserAction=()=>{},renderTab=()=>{readState();};
 function openModal(){document.getElementById('modal').hidden=false;readState();}function closeModal(){document.getElementById('modal').hidden=true;}
 function showToast(s){document.getElementById('toast').textContent=s;readState();}
 async function readState(){document.getElementById('state').textContent=JSON.stringify(await(await fetch('/qa/state')).json());}
 async function refreshAffectedData(){await readState();closeModal();}
 async function reset(name){await fetch('/qa/reset',{method:'POST',body:JSON.stringify({mode:name})});location.reload();}
 `;
 return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<style>body{padding:16px;color:#eef6ff;background:#0b141d}h1{font-size:22px}main{max-width:1000px;margin:auto}.proof{border:1px solid #36c5cf;border-radius:12px;padding:14px;margin:12px 0}button{min-height:44px;white-space:normal;margin:5px}pre{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}#modal{position:fixed;inset:0;background:#000b;z-index:9999;overflow:auto;padding:12px}#modal[hidden]{display:none!important}#modalInner{background:#101d29;padding:18px;border:1px solid #36c5cf;border-radius:12px;max-width:650px;margin:20px auto}#modalInner p{overflow-wrap:anywhere}.form-actions{flex-wrap:wrap}#toast{overflow-wrap:anywhere}</style><title>原訂單 ID 隔離驗收</title></head><body><main><h1>原訂單 ID · 刪單與回料隔離驗收</h1><p>角色：${role}；無正式資料、無正式憑證，正式庫存寫入 0</p><div class="proof">${Object.keys(cases).map(k=>`<button class="btn btn-ghost" onclick="reset('${k}')">${k}</button>`).join('')}<pre id="state"></pre></div><div id="toast" role="status"></div><section class="proof"><h2>100501 · 測試訂單</h2><p>其他獨立訂單 AU100501／IT100501／CN100501 必須保留。</p><button class="btn btn-red" onclick="deleteOrder('${h.ids[0].id}','100501')">刪除測試訂單</button><button class="btn btn-green" onclick="performOrderIdentityReversal('${h.ids[0].id}','100501','reverse_picking','續接')" ${role==='sales'?'disabled':''}>倉管確認原單回料</button></section></main><div id="modal" hidden><div id="modalInner"></div></div><script>${setup}${helpers}${del}readState();</script></body></html>`;
}
http.createServer(async(req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'none';script-src 'unsafe-inline';style-src 'unsafe-inline';connect-src 'self';base-uri 'none';form-action 'none'");res.setHeader('Cache-Control','no-store');let body='';for await(const chunk of req)body+=chunk;
 try{
  if(req.url==='/'&&req.method==='GET'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(page());return;}
  if(req.url==='/qa/reset'){mode=JSON.parse(body).mode;if(!cases[mode])throw Error('invalid isolated case');h=harness(cases[mode]);}
  else if(req.url.startsWith('/api/orders/stock-audit')){const id=new URL(req.url,'http://localhost').searchParams.get('order_id');const response=await h.run('GET',id,{},req.headers['x-erp-role']);res.statusCode=response.status;res.setHeader('Content-Type','application/json');res.end(await response.text());return;}
  else if(req.url==='/api/orders/stock-action'){const b=JSON.parse(body);const response=await h.run('POST',b.order_id,b,req.headers['x-erp-role']);res.statusCode=response.status;res.setHeader('Content-Type','application/json');res.end(await response.text());return;}
  else if(req.url!=='/qa/state'){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({mode,...h.snapshot()}));
 }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}
}).listen(8772,'127.0.0.1',()=>console.log('Isolated order-ID QA http://127.0.0.1:8772; memory only, external requests 0'));

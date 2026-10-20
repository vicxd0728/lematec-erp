// Loopback-only UI fixture. No credentials, proxy, business writes or external adapters.
const http=require('node:http'),fs=require('node:fs'),cp=require('node:child_process');
const before=cp.execFileSync('git',['show','HEAD:index.html'],{encoding:'utf8',maxBuffer:6e6});
function page(url){
 const html=url.searchParams.has('before')?before:fs.readFileSync('index.html','utf8');
 const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
 // Styles embedded in print-document template strings are not application styles.
 const styles=[...html.slice(0,html.indexOf('</head>')).matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(x=>x[0]).join('\n');
 const functions=[cut('function getOrderFilters(', 'function getCorderSearchDraft('),cut('function updateOrderFilter(', 'function searchIncludesAll('),
 cut(html.includes('function getInventoryFilterState(')?'function getInventoryFilterState(':'function _invQuick(', 'function openSelectedSafetyStockBatch('),cut('function inventoryVisualStatus(', 'function renderInventoryStockVisual('),
 cut('function renderInventory(){','function renderInventoryInsightPanel('),cut('function _invFilter(', 'let _mpItems='),
 cut('function orderCustomerLabel(', 'function shortageSourceOrderFromNote('),cut('function setOrderMobileSort(', 'function orderTimelineEvents(')
 ].join('\n');
 const money=html.slice(html.indexOf('function formatOptionalMoney('),html.indexOf('\n}',html.indexOf('function formatOptionalMoney('))+2);
 const setup=`let CURRENT_TAB='inventory';const ROLE='warehouse',SORT={},boms=[],ROLES={warehouse:{tabs:['orders','inventory']}};
 const mats=Array.from({length:125},(_,i)=>({id:'mat-'+i,notionId:'mirror-'+i,code:'Y-QA-'+String(i+1).padStart(3,'0'),name:i===0?'測試長名稱清洗加工管件':'測試零件'+(i+1),type:'零件',stock:i===1?null:i===0?0:i,safe:10}));
 const orders=[{id:'order-1',no:'QA-ORDER-001',productId:'unavailable',matCode:'Y-QA-MISSING',product:'原單保存的零件',customer:'測試國內客戶',orderType:'國內',created:'2026-10-21',deadline:'2026-10-28',status:'待出貨',qty:100},{id:'order-2',no:'QA-ORDER-002',productId:'mat-2',customer:'測試國內客戶',orderType:'國內',created:'2026-10-20',status:'生產中',qty:2}];
 window._coreLoaded=${!url.searchParams.has('unloaded')};${url.searchParams.has('empty')||url.searchParams.has('unloaded')?'orders.length=0;':''}window._invState=${url.searchParams.has('legacy')?"{q:'',type:'all',stockMin:'',stockMax:'',page:1,pageSize:100}":"null"};
 const _supabaseInventoryState={loaded:true},getInventoryReadSet=()=>({rows:mats,label:'隔離測試主資料'}),getInventoryReadSource=()=> 'supabase',isViewOnly=()=>false,isAdminRole=()=>false,canAuditBomRole=()=>false,canImportBomRole=()=>false;
 const escapeHtml=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'),normalizeSku=s=>String(s||'').toUpperCase(),applySort=(k,rows)=>rows,TH=(k,c,l,t,cls)=>'<th class="'+(cls||'')+'">'+l+'</th>',pill=s=>'<span class="pill">'+escapeHtml(s)+'</span>';
 const inventoryReportTabs=()=>'',renderInventorySourceSwitch=()=>'<div class="info-box">隔離查詢 · Supabase 測試主資料</div>',renderInventoryStockVisual=()=>'',renderInventoryInsightPanel=()=>'',renderInventoryInsightDrawer=()=>'';
 const dashboardCanCreateOrder=()=>false,canCompleteShipmentRole=()=>true,applyDateFilterValue=(v,rows)=>rows,orderSearchBlob=o=>Object.values(o).join(' '),searchIncludesAll=(s,q)=>String(q).toLowerCase().split(/\\s+/).every(x=>String(s).toLowerCase().includes(x)),isShopeeProductionOrder=()=>false,isSfgProductionOrder=()=>false,renderOrderWorkHint=()=>'',findOrderCustomer=()=>null,todayStr=()=> '2026-10-21';
 function renderTab(tab=CURRENT_TAB){CURRENT_TAB=tab;document.getElementById('mainContent').innerHTML=tab==='inventory'?renderInventory():_renderOrdersList('',[]);}
 function switchTab(tab){renderTab(tab);}function showToast(s){document.getElementById('qaStatus').textContent=s;}
 // Deliberately no write implementation; fixture cannot change any business system.
 function openSelectedSafetyStockBatch(){showToast('隔離環境：不送出任何設定或庫存異動');}
 window.addEventListener('error',e=>document.getElementById('qaErrors').textContent+=e.message+'\\n');
 `;
 return `<!doctype html><html lang="zh-Hant" data-theme="premium"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ERP 查詢隔離驗收</title>${styles}<style>body{padding:12px}#mainContent{position:static!important;overflow:visible!important;height:auto!important;padding:4px!important;width:100%!important;min-width:0}#qaNav{padding:10px;border:1px solid cyan;margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap}#qaErrors{color:red;white-space:pre-wrap}</style><body><nav id="qaNav"><b>隔離資料 · 倉庫角色 · 無正式連線</b><button class="btn btn-blue" onclick="switchTab('inventory')">庫存查詢</button><button class="btn btn-blue" onclick="switchTab('orders')">訂單查詢</button></nav><div id="qaStatus" role="status"></div><pre id="qaErrors"></pre><main id="mainContent"></main><script>${setup}${functions}${money}\nrenderTab();</script></body></html>`;
}
http.createServer((req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'");
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.statusCode=405;return res.end('Read-only QA');}
 try{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(page(new URL(req.url,'http://127.0.0.1:8771')));}catch(e){res.statusCode=500;res.end(String(e));}
}).listen(8771,'127.0.0.1',()=>console.log('Read-only lookup fixture http://127.0.0.1:8771 (125 materials, 2 orders, zero external adapters)'));

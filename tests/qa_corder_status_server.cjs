// Real C-end list renderer with synthetic data and no formal API adapters.
const fs=require('node:fs'),http=require('node:http');const html=fs.readFileSync('index.html','utf8');const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const styles=html.slice(0,html.indexOf('</head>')).match(/<style[^>]*>[\s\S]*?<\/style>/g).join('\n').replace(/@import[^;]+;/g,'');
const funcs=cut('function corderSelectionIds(','function pickShortageMaterialMatch(')+cut('function getCorderSearchDraft(','function getCustomerFilters(');
const page=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<style>body{padding:12px}main{max-width:1200px;margin:auto}button.corder-stat{min-height:44px}</style><main><h2>C端統計篩選｜隔離驗收</h2><p>合成資料 · 唯讀角色 · 不連正式庫存</p><div id="mainContent"></div></main><script>
let CURRENT_TAB='corders';const ROLE='viewer',CORDER_SEQUENCE_STATE={next_number:17000},DATA_LOAD_MODE={corders:'recent'},DATA_LOAD_DAYS={corders:30},FIRST_LOAD_DAYS=30;
window._cordersLoaded=true;window._CO_Q='OLD';window._CO_SHIP='OTHER';window._CO_DAYS='7';
window.corders=[{id:'a',no:'SHARED-ORDER',matCode:'S-QA-A',matId:'m',status:'出貨中',qty:1},{id:'b',no:'SHARED-ORDER',matCode:'S-QA-B',matId:'m',status:'出貨中',qty:2},{id:'c',no:'RETURN-FULL',matCode:'S-QA-C',matId:'m',status:'已退貨',qty:1},{id:'d',no:'RETURN-PART',matCode:'S-QA-D',matId:'m',status:'部分退貨',qty:1},{id:'e',no:'LEGACY-UNLINKED',status:'已完成',qty:1}];
const isViewOnly=()=>true,isAdminRole=()=>false,nextCorderInternalNo=()=> 'SHPTW17000',corderSequenceReady=()=>true,limitedDataHint=()=>'<div>隔離已載入品項 5 筆</div>',renderCorderImportResult=()=>'',corderReturnStatusColor=()=>({bg:'black',fg:'white'}),escapeHtml=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),searchIncludesAll=(s,q)=>s.includes(q);
function renderTab(){document.querySelector('#mainContent').innerHTML=renderCorders()}function showToast(s){alert(s)}function requestFullDataForSearch(){}function taipeiDateKey(){return '2026-11-17'}
${funcs}
renderTab();</script>`;
http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'");res.end(page);}).listen(8780,'127.0.0.1',()=>console.log('QA http://127.0.0.1:8780'));

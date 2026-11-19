// Isolated renderer fixture. All data and mutations stay in browser memory.
const fs=require('node:fs'),http=require('node:http');
const html=fs.readFileSync('index.html','utf8'),styles=html.match(/<style[^>]*>[\s\S]*?<\/style>/g).slice(0,2).join('\n').replace(/@import[^;]+;/g,'');
const script=fs.readFileSync('erp-purchase-ledger.js','utf8');
const page=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<style>body{padding:16px}#mainContent{max-width:1160px;margin:auto}#modalBg{display:none;position:fixed;inset:0;overflow:auto;background:#000a;padding:16px;z-index:999}#modalBg.open{display:block}#modalInner{margin:auto;max-width:650px;width:100%;box-sizing:border-box;background:var(--bg2);padding:20px;border-radius:14px}.btn{min-height:44px}</style><p>隔離合成資料｜不連正式庫存</p><div id="mainContent"></div><div id="modalBg"><div id="modalInner"></div></div><script>
let ROLE=new URLSearchParams(location.search).get('role')||'purchase',CURRENT_TAB='purchaseLedger';const PROXY='https://isolated.invalid';const erpWorkerHeaders=()=>({});
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function openSharedModal(){document.getElementById('modalBg').classList.add('open')}function closeModal(){document.getElementById('modalBg').classList.remove('open')}function showToast(s){window.notice=s}
let saved=[],saveCount=0,failSave=false,failRead=false,failPeriod=false;window.fakeState=()=>({saved,saveCount});window.failNextSave=()=>failSave=true;window.failNextRead=()=>failRead=true;window.failNextPeriod=()=>failPeriod=true;
const materials=[{id:'11111111-1111-4111-8111-111111111111',code:'Y-DEMO-01',name:'測試接頭',unit:'個',status:'啟用'},{id:'22222222-2222-4222-8222-222222222222',code:'Y-DEMO-02',name:'測試套筒',unit:'個',status:'啟用'}];
window.fetch=async(url,opts={})=>{
 if(url.includes('/inventory/list'))return Response.json({ok:true,materials});
 if(url.includes('/inventory/period-report')){if(failPeriod){failPeriod=false;return Response.json({error:'合成期間總表失敗'},{status:503})}return Response.json({ok:true,complete:true,generated_at:'2026-11-19',rows:[{sku:'Y-DEMO-01',inbound:8}]});}
 if(url.includes('/purchase-ledger/mapping')){saveCount++;if(failSave){failSave=false;throw Error('合成斷線測試')}const b=JSON.parse(opts.body);const m={supplier:b.supplier,source_label:b.label,kind:b.kind,material_id:b.material_id,factor:b.factor,version:b.version+1,note:b.note,last_request:b.request_id};saved=saved.filter(x=>x.supplier!==b.supplier||x.source_label!==b.label);saved.push(m);return Response.json({ok:true,mapping:m});}
 if(failRead){failRead=false;return Response.json({error:'合成讀取失敗'},{status:503})}
 const period=new URL(url).searchParams.get('period');const rows=period==='2026-09'?[{line:4,supplier:'合成供應商',label:'Y-DEMO01',quantity:10,unit_price:2,amount:20}]:[{line:7,supplier:'合成供應商',label:'Y-DEMO01',quantity:10,unit_price:2,amount:20},{line:8,supplier:'物流商',label:'運費（含特殊字元 <test>）',quantity:1,unit_price:50,amount:50}];
 return Response.json({ok:true,batch:{id:'33333333-3333-4333-8333-333333333333',source_key:'115進貨明細表.xlsx',source_hash:'a'.repeat(64),created_at:'2026-11-19',payload:{sheet:'仂邁1',rows}},mappings:saved});
};
${script}
loadPurchaseLedger().then(()=>{if(new URLSearchParams(location.search).get('view')!=='trial')purchaseLedgerChange('sub','mapping')});</script>`;
http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'");res.end(page);}).listen(8781,'127.0.0.1',()=>console.log('QA http://127.0.0.1:8781'));

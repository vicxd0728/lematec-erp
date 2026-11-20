// Isolated renderer fixture. All data and mutations stay in browser memory.
const fs=require('node:fs'),http=require('node:http');
const html=fs.readFileSync('index.html','utf8'),styles=html.match(/<style[^>]*>[\s\S]*?<\/style>/g).slice(0,2).join('\n').replace(/@import[^;]+;/g,'');
const script=fs.readFileSync('erp-purchase-ledger.js','utf8');
const extract=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));
const reportHelpers=extract('function inventoryReportColumns(){','function inventoryReportTable(')+extract('function inventoryReportSafeText(','async function exportInventoryPeriodReport(')+extract('function buildInventoryPeriodPrint(','function previewInventoryPeriodPrint(');
const page=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<style>body{padding:16px}#mainContent{max-width:1160px;margin:auto}#modalBg{display:none;position:fixed;inset:0;overflow:auto;background:#000a;padding:16px;z-index:999}#modalBg.open{display:block}#modalInner{margin:auto;max-width:650px;width:100%;box-sizing:border-box;background:var(--bg2);padding:20px;border-radius:14px}.btn{min-height:44px}</style><p>隔離合成資料｜不連正式庫存</p><div id="mainContent"></div><div id="modalBg"><div id="modalInner"></div></div><script>
let ROLE=new URLSearchParams(location.search).get('role')||'purchase',CURRENT_TAB='purchaseLedger';const PROXY='https://isolated.invalid';const erpWorkerHeaders=()=>({});
const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function openSharedModal(){document.getElementById('modalBg').classList.add('open')}function closeModal(){document.getElementById('modalBg').classList.remove('open')}function showToast(s){window.notice=s}
let saved=[],saveCount=0,failSave=false,failRead=false,failPeriod=false,holdSave=false,releaseSave=null,calls=[];window.fakeState=()=>({saved,saveCount,calls});window.failNextSave=()=>failSave=true;window.failNextRead=()=>failRead=true;window.failNextPeriod=()=>failPeriod=true;window.holdNextSave=()=>holdSave=true;window.releaseHeldSave=()=>{releaseSave?.();releaseSave=null};
${reportHelpers}
async function ensureXlsxLoaded(){};const XLSX={utils:{book_new:()=>({sheets:[]}),aoa_to_sheet:rows=>rows,book_append_sheet:(book,rows,name)=>book.sheets.push({name,rows})},writeFile:(book,name)=>{window.exportedBook={book,name}}};
const materials=[{id:'11111111-1111-4111-8111-111111111111',code:'Y-DEMO-01',name:'測試接頭',unit:'個',status:'啟用'},{id:'22222222-2222-4222-8222-222222222222',code:'Y-DEMO-02',name:'測試套筒',unit:'個',status:'啟用'}];
if(new URLSearchParams(location.search).has('seed'))saved=[{supplier:'合成供應商',source_label:'Y-DEMO01',kind:'material',material_id:materials[0].id,factor:2.5,version:1,note:'已確認備註',last_request:'original-request'}];
window.fetch=async(url,opts={})=>{
 calls.push({url,method:opts.method||'GET'});
 if(url.includes('/inventory/list'))return Response.json({ok:true,materials});
 if(url.includes('/inventory/period-report')){
  if(failPeriod){failPeriod=false;return Response.json({error:'合成期間總表失敗'},{status:503})}
  const date=new URL(url).searchParams.get('start');
  const transactions=[{id:'tx-one',warehouse_id:'wh1',material_id:materials[0].id,materials:{sku:'Y-DEMO-01'},occurred_at:date+'T01:00:00Z',source_number:'IB-TEST-ONE',transaction_type:'入庫',quantity_delta:8,quantity_before:0,quantity_after:8},{id:'tx-other',warehouse_id:'wh1',material_id:materials[1].id,materials:{sku:'Y-DEMO-02'},occurred_at:date+'T02:00:00Z',source_number:'OTHER-SKU-RECEIPT',transaction_type:'入庫',quantity_delta:99,quantity_before:0,quantity_after:99}];
  if(new URLSearchParams(location.search).has('history'))for(let i=2;i<=12;i++)transactions.push({...transactions[0],id:'tx-'+i,source_number:'IB-TEST-'+String(i).padStart(2,'0'),occurred_at:date+'T'+String(i).padStart(2,'0')+':00:00Z',quantity_delta:0,quantity_before:8});
  const summary={key:'wh1:'+materials[0].id,warehouse:'測試倉庫',sku:'Y-DEMO-01',name:'測試接頭',unit:'個',opening:0,closing:8,inbound:8,production:0,return_in:0,outbound:0,transfer_in:0,transfer_out:0,adjustment:0,other_in:0,other_out:0,count:1,checked:true};
  const reportRows=[summary];
  if(new URLSearchParams(location.search).has('scale')){
   reportRows[0]={...summary,production:2,outbound:2,closing:8};
   reportRows.push({...summary,key:'wh1:'+materials[1].id,sku:'Y-DEMO-02',unit:'公斤',inbound:99,outbound:7,closing:92});
   for(let i=0;i<54;i++)reportRows.push({...summary,key:'wh1:scale-'+i,sku:'Y-SCALE-'+i,name:'大量合成項目',inbound:1,closing:1});
  }
  return Response.json({ok:true,complete:true,start:date,end:date.slice(0,7)+'-30',generated_at:'2026-11-19',rows:reportRows,transactions});
 }
 if(url.includes('/purchase-ledger/mapping')){saveCount++;if(holdSave){holdSave=false;await new Promise(resolve=>releaseSave=resolve)}if(failSave){failSave=false;throw Error('合成斷線測試')}const b=JSON.parse(opts.body);const m={supplier:b.supplier,source_label:b.label,kind:b.kind,material_id:b.material_id,factor:b.factor,version:b.version+1,note:b.note,last_request:b.request_id};saved=saved.filter(x=>x.supplier!==b.supplier||x.source_label!==b.label);saved.push(m);return Response.json({ok:true,mapping:m});}
 if(failRead){failRead=false;return Response.json({error:'合成讀取失敗'},{status:503})}
 const period=new URL(url).searchParams.get('period');const rows=period==='2026-09'?[{line:4,supplier:'合成供應商',label:'Y-DEMO01',quantity:10,unit_price:2,amount:20}]:[{line:7,supplier:'合成供應商',label:'Y-DEMO01',quantity:10,unit_price:2,amount:20},{line:8,supplier:'物流商',label:'運費（含特殊字元 <test>）',quantity:1,unit_price:50,amount:50}];
 if(new URLSearchParams(location.search).has('collision'))rows.push({line:9,supplier:'合成供應商二',label:'Y-DEMO01',quantity:3,unit_price:2,amount:6});
 return Response.json({ok:true,batch:{id:'33333333-3333-4333-8333-333333333333',source_key:'115進貨明細表.xlsx',source_hash:'a'.repeat(64),created_at:'2026-11-19',payload:{sheet:'仂邁1',rows}},mappings:saved});
};
${script}
loadPurchaseLedger().then(()=>purchaseLedgerChange('sub',new URLSearchParams(location.search).get('view')||'mapping'));</script>`;
http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'");res.end(page);}).listen(8781,'127.0.0.1',()=>console.log('QA http://127.0.0.1:8781'));

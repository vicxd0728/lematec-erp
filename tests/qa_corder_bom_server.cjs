const http=require('http'),fs=require('fs');
const html=fs.readFileSync('index.html','utf8'),cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const styles=html.match(/<style[^>]*>[\s\S]*?<\/style>/g).slice(0,2).join('\n').replace(/@import[^;]+;/g,'');
const code=[cut('let _inventoryCoreReadTail=','function setSyncState('),cut('function mapSupabaseInventoryMaterial(','const BOM_NOTION_MIRROR_QUEUE_KEY='),cut('function mapSupabaseInventoryBomRows(','function mapNotionInventoryBomRows('),cut('function parseCorderStockRefs(','function filterCorderMatOptions('),cut('async function prepareCorderImportPreflight(','async function requestCorderResume('),cut('function preflightBadge(','async function saveAnnounce(')].join('\n');
const setup=`
const PROXY='https://isolated.invalid',ROLE='sales';let mats=[],boms=[],_bomDataReady=false,_bomDataError='',_bomDataSource='not-loaded',_bomDataFallbackReason='',_supabaseInventoryState={},supabaseInventoryMats=[];
const CORDER_SEQUENCE_STATE={next_number:16748},normalizeSku=s=>String(s||'').trim().toUpperCase(),corderSameOrderKey=(s,b)=>s+'|'+b,formatCorderNo=n=>'SHPTW'+n,findMatBySku=sku=>mats.find(m=>m.code===sku);
const escapeHtml=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const incoming=['S-Z-SDG-03CD','S-Z-SKC-A-11AS-P3','S-F-DTC-16-E','S-Z-DTC-02-2'].map((sku,i)=>({sourceRow:i+2,sku,qty:1,shopeeNo:'QA-'+i,buyer:'隔離測試買家'}));
window.corders=[];let fail=true,hold=false,release,requests=[];
window.setFailure=v=>fail=v;window.holdNextBom=()=>hold=true;window.releaseBom=()=>release?.();window.qaState=()=>({requests,ready:_bomDataReady});
window.fetch=async(url,options={})=>{
 requests.push({url,method:options.method||'GET'});if(options.method&&options.method!=='GET')throw Error('No mutations allowed');
 if(url.includes('/inventory/list'))return Response.json({ok:true,materials:incoming.map((x,i)=>({id:'s'+i,notion_page_id:'p'+i,sku:x.sku,stock:100}))});
 if(url.includes('/inventory/bom/list')){if(hold){hold=false;await new Promise(r=>release=r)}if(fail)return Response.json({error:'測試：BOM 服務暫時中斷 <503>'},{status:503});return Response.json({ok:true,row_count:4,rows:incoming.map((x,i)=>({id:'b'+i,parent_notion_page_id:'p'+i,child_notion_page_id:'p'+i,parent_sku:x.sku,child_sku:x.sku,quantity:1}))});}
 throw Error('Unexpected request');
};
function showToast(s){document.getElementById('qaToast').textContent=s}function openSharedModal(){document.getElementById('modalBg').style.display='block'}function closeModal(){document.getElementById('modalBg').style.display='none'}
function applyCorderImportPreflight(){throw Error('Business writes disabled in fixture')}
`;
const page=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<style>body{padding:16px}#modalBg{padding:8px}#modalInner{box-sizing:border-box;width:100%;max-width:1100px;margin:auto;padding:18px;background:var(--bg2);border:1px solid var(--border);border-radius:14px;overflow-wrap:anywhere}.form-actions{flex-wrap:wrap}.form-actions .btn{min-height:44px}.table-wrap{overflow:auto}</style><p>業務角色｜隔離合成資料｜不連正式訂單／庫存</p><p id="qaToast"></p><div id="modalBg"><div id="modalInner"></div></div><script>${setup}\n${code}\nprepareCorderImportPreflight(incoming).then(openCorderImportPreflightModal)</script>`;
http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'");res.end(page)}).listen(8782,'127.0.0.1',()=>console.log('QA http://127.0.0.1:8782'));

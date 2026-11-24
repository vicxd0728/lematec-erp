// Actual production preview/submit code, synthetic orders and mocked stock APIs only.
const http=require('node:http'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8'),cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const styles=html.match(/<style[^>]*>[\s\S]*?<\/style>/g).slice(0,2).join('\n').replace(/@import[^;]+;/g,'');
const code=[cut('function isShopeeProductionOrder','function canMoveOrderStatus'),cut('function resolveCorderShipPlan(','function corderReturnRefsForQty('),cut('function preflightBadge(','async function saveAnnounce('),cut('function openPickModal(','// ══ 品管檢驗單'),cut('function openPickPreview(','// ══ 品管直接在 Notion')].join('\n');
const setup=`
const ROLE='warehouse',_bomDataSource='supabase';let _bomDataReady=true,mode='ready',writes=[],picks=[];
const mats=[{id:'parent',code:'S-KIT',name:'S-KIT',stock:0},{id:'a',code:'S-PART-A',name:'S-PART-A',stock:20},{id:'b',code:'S-PART-B',name:'S-PART-B',stock:10}];
let boms=[{parentId:'parent',childId:'a',qty:2},{parentId:'parent',childId:'b',qty:1}];
const orders=[{id:'order',no:'QA-S-001',cust:'隔離測試客戶',product:'S-KIT',productId:'parent',orderType:'國外',qty:3,status:'待排程'}];
const normalizeSku=s=>String(s||'').trim().toUpperCase(),canonicalPageId=s=>s,todayStr=()=> '2026-11-24';
const escapeHtml=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function showToast(s){document.getElementById('qaToast').textContent=s}function openModal(){document.getElementById('modalInner').hidden=false}function closeModal(){document.getElementById('modalInner').hidden=true}
const loadPickShortageFollowups=async()=>{},ensurePickingNotionMirror=async()=>{},updateWorkflowPageAfterInventory=async()=>({pending:false}),loadPicks=async()=>{},refreshAffectedData=async()=>{},logUserAction=()=>{},logStockChange=async()=>{};
const pickingWorkerRequest=async(path,req)=>{writes.push({stage:path,items:req.body.items});if(mode==='failure')throw Error('測試：連線中斷，尚未扣料，請在原訂單重試');return {existing:mode==='recovery',completed:mode==='complete',row:{id:'pick',items:req.body.items.map(i=>({matId:i.material_notion_page_id,pickedQty:0,notionId:'n-'+i.material_notion_page_id}))}}};
const mapSupabasePick=r=>({...r,no:'QA-PK-001',supabaseId:r.id,notionId:'mirror'}),updateSupabasePickingStatus=async()=>{};
const applyInventoryBatchAndMirror=async(items)=>{writes.push({batch:items});return {items:items.map(i=>({pageId:i.pageId,before:20,after:20+i.delta,delta:i.delta,duplicate:false}))}};
window.qaState=()=>({mode,writes});
window.scenario=s=>{mode=s;writes=[];orders[0].status='待排程';mats[1].stock=s==='shortage'?2:20;_bomDataReady=s!=='unloaded';document.getElementById('qaToast').textContent='';openPickModal('order')};
`;
const page=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<style>body{padding:12px}.qa-tools{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}#modalInner{box-sizing:border-box;width:100%;max-width:1000px;margin:auto;padding:18px;background:var(--bg2);border:1px solid var(--border);border-radius:14px;overflow-wrap:anywhere}.form-actions{flex-wrap:wrap}.btn{min-height:44px}</style><p>隔離驗收｜倉管角色｜合成資料｜不連正式庫存</p><div class="qa-tools">${[['ready','正常預覽'],['shortage','子件缺料'],['failure','模擬失敗'],['complete','原憑證續接'],['unloaded','BOM 未載入']].map(([s,l])=>`<button class="btn btn-ghost" onclick="scenario('${s}')">${l}</button>`).join('')}</div><p id="qaToast" role="status"></p><div id="modalInner"></div><script>${setup}\n${code}\nscenario('ready')</script>`;
http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'");res.end(page)}).listen(8783,'127.0.0.1',()=>console.log('QA http://127.0.0.1:8783'));

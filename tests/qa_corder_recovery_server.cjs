// Local-only browser acceptance harness. No credentials, external fetch, or real data.
const http=require('node:http'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(process.env.ERP_QA_SOURCE||path.join(root,'index.html'),'utf8'),worker=fs.readFileSync(path.join(root,'cloudflare-worker-green-wave-c22f-FULL-UPDATED.js'),'utf8');
const pageId='11111111-1111-4111-8111-111111111111',matId='22222222-2222-4222-8222-222222222222',notionMat='33333333-3333-4333-8333-333333333333',txId='44444444-4444-4444-8444-444444444444';
const rich=s=>({rich_text:[{text:{content:s}}]});let state,context;
function reset(mode){
 state={mode,requests:0,moves:0,balance:12,tx:[],logs:[],faultUsed:false,page:{id:pageId,parent:{database_id:'qa-db'},properties:{訂單號碼:{title:[{text:{content:'SHPTW20000'}}]},品名:rich('S-QA-ONLY'),數量:{number:1},料件ID:rich(notionMat+':1'),備註:rich('[ERP_CORDER_V2] QA ONLY'),狀態:{select:{name:'需確認'}}}}};
 if(mode==='renumber'){state.moves=1;state.balance=11;state.page.properties.蝦皮訂單號碼=rich('QA-SHOP-ORIGINAL');}
 context=vm.createContext({Response,Request,console,BOARD_DB:{corders:'qa-db'},canonicalNotionId:s=>String(s||'').replaceAll('-','').toLowerCase(),isUuid:s=>/^[0-9a-f-]{36}$/.test(s||''),cleanText:s=>String(s||''),erpClientAuthorized:async req=>req.headers.get('X-ERP-Role')==='sales',unauthorizedErpClient:()=>Response.json({error:'test role forbidden'},{status:403}),resp400:(_,error)=>Response.json({error},{status:400}),respOK:(_,data)=>Response.json(data),jh:()=>({'Content-Type':'application/json'}),erpBearerToken:()=> 'not-a-credential',getSupabaseInventoryContext:async()=>({organization:{id:'qa-org'},warehouse:{id:'qa-wh'}}),taipeiDateFromTimestamp:()=> '2026-10-20',
 fetch:async(url,request)=>{if(url.includes('/databases/'))return Response.json({results:[state.page],has_more:false});if(!url.startsWith('https://api.notion.com/v1/pages/'))throw Error('External destination forbidden');if(request.method==='PATCH'){if(state.mode==='patchFail'&&!state.faultUsed){state.faultUsed=true;return Response.json({message:'測試：訂單狀態儲存暫時失敗，原扣料憑證保留'},{status:503});}Object.assign(state.page.properties,JSON.parse(request.body).properties);}return Response.json(state.page);},
 supabaseAll:async()=>[],
 supabaseSingle:async(_e,p)=>p.includes('/materials?')?{id:matId,sku:'S-QA-ONLY',notion_page_id:notionMat,name:'隔離測試料件'}:{occurred_at:'2026-10-20T12:00:00Z'},
 supabaseFetch:async(_e,p,request={})=>{
  if(p.includes('/inventory_transactions?'))return state.tx;
  if(p.includes('/rpc/apply_corder_ship_once')){if(state.mode==='renumber')return {identity_conflict:true,original_order_number:'SHPTW16428'};const duplicate=state.tx.length>0;if(!duplicate){state.moves++;state.balance--;state.tx=[{id:txId,material_id:matId,quantity_delta:-1,quantity_before:12,quantity_after:11}];}if(state.mode==='lostResponse'&&!state.faultUsed){state.faultUsed=true;throw Error('QA response lost after commit');}return {duplicate,items:[{transaction_id:txId,material_id:matId,delta:-1,before_stock:12,after_stock:11}]};}
  if(p.includes('/erp_stock_logs?'))return state.logs;
  if(p==='/rest/v1/erp_stock_logs'){if(state.mode==='logFail'&&!state.faultUsed){state.faultUsed=true;throw Error('測試：操作明細暫時無法儲存，原扣料憑證保留');}state.logs=[{id:1}];return [];}
  if(p.startsWith('/rest/v1/erp_mirror_jobs?'))return [];
  throw Error('Unsupported isolated adapter path');
 }});
 vm.runInContext(worker.slice(worker.indexOf('function corderRecoverySnapshot('),worker.indexOf('async function erpCorderNumberState(')),context);
}
function snapshot(){return {mode:state.mode,requests:state.requests,moves:state.moves,balance:state.balance,formal_transactions:state.tx.length,logs:state.logs.length,status:state.page.properties.狀態.select.name,production_requests:0,html_sha256:crypto.createHash('sha256').update(html).digest('hex')};}
reset('lostResponse');
const styles=[...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map(x=>x[0]).join('\n');
const renderer=html.slice(html.indexOf('function corderSelectionIds('),html.indexOf('function pickShortageMaterialMatch('));
const resume=html.slice(html.indexOf('async function requestCorderResume('),html.indexOf('async function applyCorderImportPreflight('));
const setup=`
const ROLE='sales',CURRENT_TAB='corders',PROXY='',CORDER_SEQUENCE_STATE={next_number:20001};
const DATA_LOAD_MODE={corders:'all'},DATA_LOAD_DAYS={corders:30},FIRST_LOAD_DAYS=30;
window._cordersLoaded=true;window.corders=[{id:'${pageId}',no:'SHPTW20000',shopeeNo:'QA-ONLY',buyer:'隔離測試買家',matCode:'S-QA-ONLY',matId:'test',qty:1,status:'需確認',created:'2026-10-20'}];
const isViewOnly=()=>false,isAdminRole=()=>false,getCorderSearchDraft=()=>'',nextCorderInternalNo=()=> 'SHPTW20001',corderSequenceReady=()=>true,limitedDataHint=()=>'',corderReturnStatusColor=s=>s==='出貨中'?({bg:'#123e30',fg:'#50edab'}):({bg:'#4d3811',fg:'#ffc766'}),escapeHtml=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),searchIncludesAll=(s,q)=>s.includes(q),erpWorkerHeaders=x=>({...x,'X-ERP-Role':'sales'});
function renderTab(){document.getElementById('mainContent').innerHTML=renderCorders();}
function showToast(text,type){document.getElementById('qaToast').textContent=text;readState();}
async function refreshAffectedData(){await readState();}
async function readState(){const s=await (await fetch('/qa/state')).json();document.getElementById('qaState').textContent=JSON.stringify(s);}
async function resetCase(mode){await fetch('/qa/reset',{method:'POST',body:JSON.stringify({mode})});window.corders[0].status='需確認';window._corderResumeErrors={};window._corderResuming=new Set();document.getElementById('qaToast').textContent='';renderTab();await readState();}
window.addEventListener('resize',()=>renderTab());
`;
const testHtml=`<!doctype html><html lang="zh-Hant" data-theme="premium"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ERP 業務續接隔離驗收</title>${styles}<style>body{padding:12px}.qa-banner{background:#123b47;padding:12px;border:1px solid #44ddff;border-radius:8px;margin-bottom:12px}.qa-banner button{margin:4px}#qaToast{padding:10px;overflow-wrap:anywhere}#qaState{white-space:normal;overflow-wrap:anywhere;font-size:12px}.qa-banner p{margin:6px 0}</style><body><div class="qa-banner"><b>ERP V.384 同版程式 · 隔離測試 · 業務角色</b><p>無公司憑證／無正式資料／僅記憶體庫存／正式 API 請求 0</p><button class="btn btn-ghost" onclick="resetCase('lostResponse')">測試：扣料後斷線</button><button class="btn btn-ghost" onclick="resetCase('patchFail')">測試：狀態儲存失敗</button><button class="btn btn-ghost" onclick="resetCase('logFail')">測試：明細儲存失敗</button><pre id="qaState" aria-label="隔離交易統計"></pre></div><div id="qaToast" role="status"></div><main id="mainContent"></main><script>${setup}${renderer}${resume}\nrenderTab();readState();</script></body></html>`;
const server=http.createServer(async(req,res)=>{
 res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");res.setHeader('Cache-Control','no-store');
 let body='';for await(const c of req)body+=c;
 try{
  if(req.url==='/'&&req.method==='GET'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(testHtml.replace('ERP V.384 同版程式','ERP 換號防重同版程式').replace('<pre id="qaState"','<button class="btn btn-ghost" onclick="resetCase(\'renumber\')">測試：換號再次匯入</button><pre id="qaState"'));return;}
  if(req.url==='/qa/reset'&&req.method==='POST'){const mode=JSON.parse(body).mode;if(!['lostResponse','patchFail','logFail','renumber'].includes(mode))throw Error('Invalid case');reset(mode);}
  else if(req.url==='/api/corder/resume'&&req.method==='POST'){
   const request=JSON.parse(body);if(request.page_id!==pageId)throw Error('Only QA page allowed');
   state.requests++;const firstLost=state.mode==='lostResponse'&&!state.faultUsed;
   // Delay only the isolated response so a real browser can observe the disabled button.
   await new Promise(r=>setTimeout(r,1500));
   const result=await context.erpCorderResume(new Request('http://qa.local/api/corder/resume',{method:'POST',headers:{'X-ERP-Role':req.headers['x-erp-role']||''},body}),{},{});
   if(firstLost){res.writeHead(200,{'Content-Type':'application/json','Content-Length':'9999'});res.write('{"ok":');setTimeout(()=>res.destroy(),100);return;}res.statusCode=result.status;res.setHeader('Content-Type','application/json');res.end(await result.text());return;
  }else if(req.url!=='/qa/state'){res.statusCode=404;res.end();return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(snapshot()));
 }catch(e){res.statusCode=400;res.end(JSON.stringify({error:e.message}));}
});
server.listen(8769,'127.0.0.1',()=>console.log('Isolated C-end QA http://127.0.0.1:8769 ; no external network adapters or credentials; source SHA256 '+snapshot().html_sha256));

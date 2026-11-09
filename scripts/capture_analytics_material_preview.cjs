// Isolated visual proof. Uses synthetic records and never connects to ERP.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {spawn}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const root=path.join(__dirname,'..'),output=path.join(root,'output','analytics-material-preview');
fs.mkdirSync(output,{recursive:true});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const script=html.slice(html.indexOf('function analyticsRange()'),html.indexOf('function renderStockLog()'));
const ctx=vm.createContext({window:{},taipeiDateKey:value=>new Date(value).toISOString().slice(0,10),
  escapeHtml:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')});
vm.runInContext(script,ctx);
const end='2026-11-09',tx=[];
for(let i=1;i<=14;i++)for(const day of [2,8,17,29,38,49])tx.push({material_id:`m-${i}`,source_type:'order_pick_batch',quantity_delta:-i*(day<28?2:1),occurred_at:new Date(Date.parse(end+'T12:00:00Z')-day*86400000).toISOString(),materials:{sku:`Y-EXAMPLE-${String(i).padStart(2,'0')}`,name:'示範物料',unit:'件'}});
const mats=Array.from({length:14},(_,i)=>({supabaseId:`m-${i+1}`,id:`p-${i+1}`,code:`Y-EXAMPLE-${String(i+1).padStart(2,'0')}`,name:'示範物料',stock:20+i*3,unit:'件'}));
const model=ctx.analyticsMaterialModel({complete:true,source:'inventory_transactions',start:'2026-08-12',end,generated_at:end+'T12:00:00Z',transactions:tx},mats,[{id:'p-14',needed:12}], '90');
const style=html.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1]||'';
fs.writeFileSync(path.join(output,'preview.html'),`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${style}</style></head><body><main style="max-width:1280px;margin:24px auto;padding:16px"><h1>營運分析</h1>${ctx.analyticsMaterialPanel(model)}</main></body></html>`);
const profile=path.join(output,`profile-${process.pid}`);
const child=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-sandbox','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){
 let port;for(let i=0;i<100;i++){const file=path.join(profile,'DevToolsActivePort');if(fs.existsSync(file)){port=Number(fs.readFileSync(file,'utf8').split('\n')[0]);break;}await delay(100);}if(!port)throw Error('Chrome did not start');
 const pages=await(await fetch(`http://127.0.0.1:${port}/json`)).json(),socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});let id=0;const pending=new Map();
 socket.onmessage=event=>{const data=JSON.parse(event.data);if(!pending.has(data.id))return;const item=pending.get(data.id);pending.delete(data.id);data.error?item.reject(Error(data.error.message)):item.resolve(data.result)};
 const cmd=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}))});
 await cmd('Page.enable');
 for(const [label,width,height] of [['desktop',1440,1100],['mobile',390,950]]){
   await cmd('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:label==='mobile'});
   await cmd('Page.navigate',{url:pathToFileURL(path.join(output,'preview.html')).href});await delay(350);
   const measure=await cmd('Runtime.evaluate',{expression:'JSON.stringify({viewport:innerWidth,body:document.body.scrollWidth,panel:document.querySelector("#analytics-materials").getBoundingClientRect().width,table:document.querySelector(".analytics-material-table").scrollWidth,tableClient:document.querySelector(".analytics-material-table").clientWidth})',returnByValue:true});
   const shot=await cmd('Page.captureScreenshot',{format:'png'}),file=path.join(output,`${label}.png`);fs.writeFileSync(file,Buffer.from(shot.data,'base64'));
   console.log(label,measure.result.value,file);
 }
 socket.close();
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>child.kill());

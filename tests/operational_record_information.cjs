const fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const cut=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const funcs=cut('function recordDetailFields(','function setInboundMobileSort(')+cut('function renderQCExceptions(','function qcInspectionsReady(');
const ib={id:'inbound-1',no:'IB-DEMO',matCode:'Y-QA-001',qty:12,supplier:'隔離供應商',date:'2026-11-17',qcStatus:'品檢不合格',stStatus:'退回倉管',rejectReason:'尺寸不符',returnTo:'倉管',note:'重新加工後送檢'};
const qc={id:'qc-1',no:'QC-DEMO',orderRef:'IB-DEMO',matCode:'Y-QA-001',result:'不通過',qtyReq:12,qtyAct:12,qtyBad:2,badReason:'尺寸不符',handling:'重新加工',inspector:'測試品管',date:'2026-11-17',note:'隔離測試'};
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function setup(){const host={innerHTML:''},notices=[];const c=vm.createContext({window:{_qcInspections:[qc]},inbounds:[ib],document:{getElementById:()=>host},escapeHtml:esc,openSharedModal:()=>{},showToast:s=>notices.push(s),QC_DATE:'7',qcInspectionRangeDays:()=>7,todayStr:()=> '2026-11-17',pill:esc});vm.runInContext(funcs,c);return {c,host,notices};}
test('inbound details show source reason, target, next step and unknown receipt without changing rows',()=>{const {c,host}=setup(),before=JSON.stringify(c.inbounds);c.openInboundRecordDetails('inbound-1');for(const s of ['尺寸不符','退回對象','倉管','重新提交','不能據此判定沒有入庫'])assert.ok(host.innerHTML.includes(s));assert.equal(JSON.stringify(c.inbounds),before);c.openInboundRecordDetails('unknown');assert.equal(JSON.stringify(c.inbounds),before);});
test('QC detail uses exact ID, preserves zero and escapes operator text',()=>{const {c,host,notices}=setup();c.window._qcInspections.push({...qc,id:'qc-2',badReason:'<img src=x>',qtyBad:0});c.openQCRecordDetails('qc-2');assert.match(host.innerHTML,/&lt;img/);assert.doesNotMatch(host.innerHTML,/<img/);assert.match(host.innerHTML,/>0<\/div>/);c.openQCRecordDetails('missing');assert.equal(notices.length,1);});
test('report denominator excludes undecided records and empty report is unknown',()=>{const {c}=setup();assert.doesNotMatch(c.renderQCReport([]),/>100</);const out=c.renderQCReport([{...qc,result:'通過'},{...qc,result:'待檢驗'}]);assert.match(out,/>100</);assert.match(out,/1 已判定/);assert.match(out,/未判定 1/);assert.match(out,/近 7 天/);assert.doesNotMatch(out,/Notion 整理建議/);});
test('exception panel is data-backed and empty reasons remain unknown',()=>{const {c}=setup();const out=c.renderQCExceptions([{...qc,badReason:'',handling:'<script>'}]);assert.match(out,/未記錄/);assert.match(out,/&lt;script/);assert.match(out,/qc-1/);assert.doesNotMatch(out,/<script>/);assert.match(c.renderQCExceptions([]),/沒有不通過/);});
test('report narrows a broader cached population and keeps handling out of cause ranking',()=>{
 const {c}=setup();const rows=[{...qc,id:'recent',no:'QC-RECENT',date:'2026-11-10',badReason:'',handling:'退貨'},
 {...qc,id:'old',no:'QC-OLD',date:'2026-11-09',badReason:'舊原因'},
 {...qc,id:'pass',no:'QC-PASS',result:'通過',qtyBad:0,badReason:'舊備註'}];
 const before=JSON.stringify(rows),out=c.renderQCReport(rows);
 assert.match(out,/1 通過 \/ 2 已判定/);assert.doesNotMatch(out,/QC-OLD|舊原因/);
 const ranking=out.split('不良原因排行（檢驗筆數）')[1].split('最近檢驗紀錄')[0];
 assert.match(ranking,/原因未填/);assert.doesNotMatch(ranking,/退貨|舊備註/);assert.equal(JSON.stringify(rows),before);
 c.QC_DATE='0';assert.match(c.renderQCReport(rows),/QC-OLD/);
});
test('QC widening reloads and an in-flight request cannot mislabel its date coverage',async()=>{
 const queries=[],releases=[];
 const c=vm.createContext({window:{_qcInspections:[]},QC_DATE:'7',performance,console,DB:{qcInspection:'test'},markLoaded:()=>{},
 qcInspectionDateFilter:days=>({days}),dbQueryAll:async(_db,q)=>{queries.push(q);return new Promise(resolve=>releases.push(resolve));}});
 vm.runInContext("let _qcInspectionsLoaded=false,_qcInspectionsScope='',_qcInspectionsLoading=false,_qcInspectionsPromise=null,_qcInspectionsLoadingScope='',_qcInspectionsError='';"+cut('function qcInspectionLoadScope(','function qcInspectionLinkedToOrder('),c);
 const first=c.loadQCInspections();c.QC_DATE='90';const second=c.loadQCInspections();
 releases.shift()([]);await first;assert.equal(c.window._qcInspectionsRangeDays,7);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(queries.length,2);assert.equal(queries[1].filter.days,90);
 releases.shift()([]);await second;assert.equal(c.window._qcInspectionsRangeDays,90);
 c.QC_DATE='7';await c.loadQCInspections();assert.equal(queries.length,2);
 c.QC_DATE='0';const all=c.loadQCInspections();assert.equal(queries.length,3);releases.shift()([]);await all;
 assert.equal(c.window._qcInspectionsRangeDays,Infinity);
});
if(process.argv.includes('--serve')){
 const styles=html.slice(0,html.indexOf('</head>')).match(/<style[^>]*>[\s\S]*?<\/style>/g).join('\n').replace(/@import[^;]+;/g,'');
 const page=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<style>body{padding:16px}main{max-width:1000px;margin:auto}#modalBg{position:fixed;inset:0;display:none;overflow:auto;background:#0009;padding:16px;z-index:999}#modalBg.open{display:block}#modalInner{width:100%;max-width:700px;margin:auto;padding:18px;background:var(--bg2);box-sizing:border-box;border:1px solid var(--border);border-radius:12px}.btn{min-height:44px}#report>div{min-width:0}#report>div[style]{grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))!important}</style><main><h2>入料／品管資料查閱｜隔離驗收</h2><p>合成資料 · 無正式連線</p><button class="btn" onclick="openInboundRecordDetails('inbound-1')">查看入料明細</button><button class="btn" onclick="openQCRecordDetails('qc-1')">查看品檢明細</button><div id="report"></div></main><div id="modalBg"><div id="modalInner"></div></div><script>const inbounds=[${JSON.stringify(ib)}];window._qcInspections=[${JSON.stringify(qc)}];const QC_DATE='7',qcInspectionRangeDays=()=>7,todayStr=()=> '2026-11-17',escapeHtml=${esc.toString()},pill=escapeHtml;function openSharedModal(){document.querySelector('#modalBg').classList.add('open')}function closeModal(){document.querySelector('#modalBg').classList.remove('open')}function showToast(s){alert(s)}${funcs}document.querySelector('#report').innerHTML=renderQCReport(window._qcInspections);</script>`;
 require('node:http').createServer((req,res)=>{res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'");res.setHeader('Content-Type','text/html;charset=utf-8');res.end(page);}).listen(8777,'127.0.0.1',()=>console.log('QA http://127.0.0.1:8777'));
}

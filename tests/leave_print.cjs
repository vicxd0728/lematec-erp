const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const source=html.slice(html.indexOf('function leavePrintDateTime('),html.indexOf('function renderLeave(){'));
function setup(extra={}){
 const ctx=vm.createContext({escapeHtml:esc,normalizeLeaveStatus:s=>s==='approved'?'審核通過':s||'待審核',leaveDurationLabel:l=>`${l.days} 天（${l.hours} 小時）`,ROLE:'ai',ROLES:{ai:{tabs:['leave']}},leaves:[],showToast:()=>{},openSharedModal:()=>{},...extra});
 vm.runInContext(source,ctx);return ctx;
}
test('half B5 form includes stored fields, review status and stamp box without signatures',()=>{
 const c=setup(),doc=c.buildLeavePrintDocument({id:'l-1',name:'測試人員',title:'倉管',type:'事假',proxy:'代理甲',dateFrom:'2026-10-13',dateTo:'2026-10-14',days:1.5,hours:12,reason:'第一行\n第二行',status:'待審核'},'2026-10-13T02:00:00Z');
 for(const text of ['測試人員','倉管','事假','代理甲','2026-10-13','2026-10-14','1.5 天（12 小時）','第一行\n第二行','待審核','蓋章方框','紀錄：l-1'])assert.ok(doc.includes(text),text);
 assert.match(doc,/@page\{size:182mm 257mm;margin:7mm\}/);assert.match(doc,/grid-template-rows:119mm 119mm;gap:4mm/);
 assert.doesNotMatch(doc,/申請人簽名|主管簽核|列印不代表核准|簽名欄供紙本簽核/);
 assert.doesNotMatch(doc,/<script|https?:\/\//i);
});
test('untrusted staff content cannot execute in printed HTML and long reasons are retained',()=>{
 const c=setup(),reason='<img src=x onerror=alert(1)>\n'+ '長'.repeat(3000);
 const doc=c.buildLeavePrintDocument({name:'<script>alert(1)</script>',reason,reviewer:'<b>主管</b>',rejectReason:'<svg onload=x>',status:'不通過'});
 const parts=[...doc.matchAll(/<div class="reason">([\s\S]*?)<\/div>/g)].map(x=>x[1]).join('');
 assert.equal(parts,esc(reason+'\n不通過原因：<svg onload=x>'));assert.ok(doc.includes('&lt;script&gt;'));assert.doesNotMatch(doc,/<script|<img|<svg/);assert.doesNotMatch(doc,/overflow:hidden|text-overflow:ellipsis/);
});
test('dates have year and Taiwan time irrespective of browser locale; missing values do not invent review',()=>{
 const c=setup();assert.match(c.leavePrintDateTime('2026-12-31T18:05:00Z'),/2027.*01.*01.*02:05/);
 const doc=c.buildLeavePrintDocument({status:'待審核',dateFrom:'2026-10-13'});assert.ok(doc.includes('審核人：—'));assert.ok(doc.includes('審核時間：—'));assert.ok(doc.includes('2026-10-13'));
});
test('preview only uses existing accessible record and does not write business data',()=>{
 let opened=0,toasts=0;const frame={},modal={};const c=setup({leaves:[{id:'l1',name:'甲'}],document:{getElementById:id=>id==='modalInner'?modal:frame},openSharedModal:()=>opened++,showToast:()=>toasts++});
 c.openLeavePrint('missing');assert.equal(opened,0);c.openLeavePrint('l1');assert.equal(opened,1);assert.match(frame.srcdoc,/甲/);assert.match(modal.innerHTML,/sandbox="allow-same-origin allow-modals"/);
 c.ROLES.ai.tabs=[];c.openLeavePrint('l1');assert.equal(opened,1);assert.equal(toasts,2);assert.doesNotMatch(source,/notionAPI|updatePage|fetch\(|logUserAction/);
});
test('print waits for frame and fonts; missing frame is safe and cancellation does not change state',async()=>{
 let calls=[];const frame={dataset:{ready:'true'},contentDocument:{querySelectorAll:()=>[{scrollHeight:100,clientHeight:100,scrollWidth:100,clientWidth:100}],fonts:{ready:Promise.resolve().then(()=>calls.push('fonts'))}},contentWindow:{focus:()=>calls.push('focus'),print:()=>calls.push('print')}};
 const c=setup({document:{getElementById:id=>id==='leavePrintFrame'?frame:{}}});await c.printLeaveDocument();assert.deepEqual(calls,['fonts','focus','print']);
 frame.dataset.ready='false';await c.printLeaveDocument();assert.equal(calls.length,3);
});
test('two forms per B5 page; odd last page stays unfilled without duplication',()=>{
 const c=setup();
 for(const n of [1,2,3,5]){
  const doc=c.buildLeavePrintDocument(Array.from({length:n},(_,i)=>({id:`ROW-${i}`,name:`EMP-${i}`})));
  assert.equal((doc.match(/<section class="print-page"/g)||[]).length,Math.ceil(n/2));
  assert.equal((doc.match(/<article class="sheet"/g)||[]).length,n);
  for(let i=0;i<n;i++)assert.equal(doc.split(`紀錄：ROW-${i}`).length-1,1);
 }
});
test('continuation preserves unicode and newlines and stays in bounded chunks',()=>{
 const c=setup(),raw='😀長文\n'.repeat(100);const chunks=c.leavePrintReasonChunks(raw);
 assert.equal(chunks.join(''),raw);for(const part of chunks){assert.ok(Array.from(part).length<=120);assert.ok((part.match(/\n/g)||[]).length<=3);}
 assert.match(c.buildLeavePrintDocument({id:'long',reason:raw}),/續頁/);
});
test('batch selection deduplicates across filtered sets, clears all and rejects stale records',()=>{
 const button={setAttribute(k,v){this[k]=v;}},els=[{value:'a'},{value:'b'}];let opened=[],warn=[];
 const c=setup({leaves:[{id:'a'},{id:'b'},{id:'c'}],document:{getElementById:()=>button,querySelectorAll:()=>els},showToast:m=>warn.push(m)});
 c.openLeavePrintPreview=rows=>opened.push(rows.map(x=>x.id));
 c.openBatchLeavePrint();assert.equal(warn.length,1);
 c.selectVisibleLeavePrint();c.toggleLeavePrintSelection('a',true);c.toggleLeavePrintSelection('c',true);c.openBatchLeavePrint();assert.deepEqual(Array.from(opened[0]),['a','b','c']);assert.match(button.textContent,/3/);assert.equal(button['aria-label'],button.textContent);
 c.leaves.pop();c.openBatchLeavePrint();assert.equal(opened.length,1);assert.equal(warn.length,2);
 c.selectVisibleLeavePrint(true);assert.match(button.textContent,/0/);assert.ok(els.every(el=>!el.checked));
});
test('layout overflow blocks printing rather than clipping content',async()=>{
 let printed=false;const frame={dataset:{ready:'true'},contentDocument:{querySelectorAll:()=>[{scrollHeight:180,clientHeight:100}]},contentWindow:{print:()=>printed=true}},button={},message={};
 const c=setup({document:{getElementById:id=>id==='leavePrintFrame'?frame:id==='leavePrintButton'?button:message}});
 assert.equal(await c.prepareLeavePrint(),false);assert.equal(button.disabled,true);assert.match(message.textContent,/超出半張 B5/);await c.printLeaveDocument();assert.equal(printed,false);
});
test('pending and historical records both offer printing independent of mutation access',()=>{
 const render=html.slice(html.indexOf('function renderLeave(){'),html.indexOf('const leaveStats =',html.indexOf('function renderLeave(){')));
 assert.equal((render.match(/onclick="openLeavePrint\('/g)||[]).length,2);
});

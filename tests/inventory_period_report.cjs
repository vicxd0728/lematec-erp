const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test'),path=require('node:path');
const worker=fs.readFileSync(path.join(__dirname,'../cloudflare-worker-green-wave-c22f-FULL-UPDATED.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function setup(){
 const calls=[],ctx=vm.createContext({URL,Response,Date,cleanText:x=>String(x||''),erpClientAuthorized:async()=>true,unauthorizedErpClient:()=>new Response('{}',{status:401}),jh:c=>({...c,'Content-Type':'application/json'}),resp400:(c,e)=>new Response(JSON.stringify({error:e}),{status:400}),resp500:(c,e)=>new Response(JSON.stringify({error:e}),{status:500}),getSupabaseInventoryContext:async()=>({organization:{id:'org'}}),supabaseFetch:async(_env,url)=>{calls.push(url);return [];}});
 vm.runInContext(worker.slice(worker.indexOf('function inventoryPeriodRange('),worker.indexOf('async function erpInventoryList(')),ctx);return {ctx,calls};
}
const tx=(id,delta,before,extra={})=>({id,material_id:'m',warehouse_id:'w',quantity_delta:delta,quantity_before:before,quantity_after:before+delta,transaction_type:delta>0?'入料入庫':'領料扣除',materials:{sku:'Y-DEMO',name:'示範',unit:'件'},warehouses:{name:'主倉'},...extra});
test('Taipei inclusive period converts to correct UTC exclusive bounds and rejects invalid ranges',()=>{
 const {ctx}=setup(),r=ctx.inventoryPeriodRange('2026-10-01','2026-10-31');assert.equal(r.from,'2026-09-30T16:00:00.000Z');assert.equal(r.until,'2026-10-31T16:00:00.000Z');
 for(const [a,b] of [['','2026-10-01'],['2026-02-30','2026-03-01'],['2026-10-02','2026-10-01'],['2025-01-01','2026-10-01']])assert.throws(()=>ctx.inventoryPeriodRange(a,b));
});
test('decimal quantities reconcile exactly and warehouse separation preserves balances',()=>{
 const {ctx}=setup(),rows=ctx.inventoryPeriodAggregate([tx('1',0.03,10),tx('2',-0.01,10.03),tx('3',5,0,{warehouse_id:'w2'})]);assert.equal(rows.length,2);assert.equal(rows[0].opening,10);assert.equal(rows[0].closing,10.02);assert.equal(rows[0].net,0.02);assert.equal(rows[0].checked,true);
});
test('Shopee transfers are separate from stock receipts and production/returns/adjustment/unknown stay distinct',()=>{
 const {ctx}=setup();
 assert.equal(ctx.inventoryPeriodCategory(tx('1',1,0,{source_type:'shopee_transfer'})),'transfer_in');
 assert.equal(ctx.inventoryPeriodCategory(tx('1',-1,1,{source_type:'shopee_transfer'})),'transfer_out');
 for(const [type,expected] of [['生產完成','production'],['取消回料','return_in'],['盤點調整','adjustment'],['其他','other_in']])assert.equal(ctx.inventoryPeriodCategory(tx('1',1,0,{transaction_type:type})),expected);
 assert.equal(ctx.inventoryPeriodCategory(tx('1',-1,5,{transaction_type:'入料入庫'})),'other_out');
});
test('broken chains never fabricate opening/closing, duplicate transaction identities stop reporting',()=>{
 const {ctx}=setup(),rows=ctx.inventoryPeriodAggregate([tx('1',2,10),tx('2',-1,99)]);
 assert.equal(rows[0].checked,false);assert.equal(rows[0].opening,null);assert.equal(rows[0].closing,null);assert.equal(rows[0].inbound,2);assert.equal(rows[0].outbound,1);
 assert.throws(()=>ctx.inventoryPeriodAggregate([tx('1',1,0),tx('1',1,1)]));
});
test('report route requires company auth and inventory-viewing role before reading data',async()=>{
 for(const [authorized,role,status] of [[false,'warehouse',401],[true,'qc',403],[true,'',403]]){
  const {ctx,calls}=setup();ctx.erpClientAuthorized=async()=>authorized;
  const res=await ctx.erpInventoryPeriodReport(new Request('https://x/api/inventory/period-report?start=2026-10-01&end=2026-10-31',{headers:{'X-ERP-Role':role}}),{},{});assert.equal(res.status,status);assert.equal(calls.length,0);
 }
});
test('period reader pages past 500, scopes organization and snapshot time, returns only complete output',async()=>{
 const {ctx,calls}=setup();ctx.supabaseFetch=async(_e,url)=>{calls.push(url);return url.includes('offset=0')?Array.from({length:500},(_,i)=>tx(String(i),1,i)):[tx('last',1,500)];};
 const r=await ctx.erpInventoryPeriodReport(new Request('https://x/api/inventory/period-report?start=2026-10-01&end=2026-10-31',{headers:{'X-ERP-Role':'ai'}}),{},{});
 const d=await r.json();assert.equal(d.complete,true);assert.equal(d.transactions.length,501);assert.equal(d.rows[0].closing,501);assert.equal(calls.length,2);assert.match(calls[0],/organization_id=eq.org/);assert.match(calls[0],/created_at=lte/);assert.match(calls[0],/source_id,source_number,idempotency_key/);assert.equal(r.headers.get('Cache-Control'),'no-store');
});
test('upstream pagination error cannot produce an exportable partial report',async()=>{
 const {ctx}=setup();ctx.supabaseFetch=async()=>{throw new Error('offline');};
 const r=await ctx.erpInventoryPeriodReport(new Request('https://x/api/inventory/period-report?start=2026-10-01&end=2026-10-31',{headers:{'X-ERP-Role':'warehouse'}}),{},{});assert.equal(r.status,500);assert.equal((await r.json()).complete,undefined);
});
function front(){
 const ctx=vm.createContext({window:{},Date,URLSearchParams,todayStr:()=> '2026-10-15',CURRENT_TAB:'inventory',PROXY:'https://x',erpWorkerHeaders:()=>({}),renderTab:()=>{},showToast:()=>{},escapeHtml:x=>String(x??'').replace(/</g,'&lt;').replace(/"/g,'&quot;')});
 vm.runInContext(html.slice(html.indexOf('function inventoryReportState('),html.indexOf('function renderInventory(){')),ctx);return ctx;
}
test('export contains full summary/detail data despite UI filtering and neutralizes formula text',()=>{
 const ctx=front(),d={start:'2026-10-01',end:'2026-10-31',generated_at:'2026-10-31',rows:[{sku:'=BAD',name:'test',checked:false,opening:null,closing:null}],transactions:[tx('x',1,0,{source_number:'@BAD',occurred_at:'2026-10-01T00:00:00Z'})]};
 const book=ctx.inventoryReportWorkbookData(d);assert.ok(book.summary.some(r=>r.includes("'=BAD")));assert.ok(book.details.some(r=>r.includes("'@BAD")));assert.ok(book.summary.some(r=>r.includes('待核對')));
 const print=ctx.buildInventoryPeriodPrint(d);assert.match(print,/A4 landscape/);assert.match(print,/table-header-group/);assert.match(print,/待核對/);
});
test('failed report read clears the old result and disables stale exports',async()=>{
 const ctx=front(),s=ctx.inventoryReportState();s.data={old:true};ctx.fetch=async()=>({ok:false,json:async()=>({error:'offline'})});
 await ctx.loadInventoryPeriodReport();assert.equal(s.data,null);assert.equal(s.busy,false);assert.match(s.error,/offline/);assert.doesNotMatch(ctx.renderInventoryPeriodReport(),/匯出 Excel（完整期間）/);
});

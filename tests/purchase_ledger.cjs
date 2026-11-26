const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ledger=require('../erp-purchase-ledger.js');
const materials=[{id:'m1',code:'Y-SP-20-1',unit:'個'},{id:'m2',code:'Y-SP-20A-1',unit:'個'}];
const rows=[{line:2,supplier:'A',label:'Y-SP20-1',quantity:10,unit_price:2,amount:20},{line:3,supplier:'A',label:'Y-SP20-1',quantity:5,unit_price:2,amount:10},{line:4,supplier:'B',label:'Y-SP20-1',quantity:8,unit_price:2,amount:null}];

test('pending work preserves confirmed mappings and separates group tasks from one SKU discrepancy',()=>{
 const maps=[{supplier:'A',source_label:'Y-SP20-1',kind:'material',material_id:'m1',factor:2}];
 const grouped=ledger.groups(rows,maps,materials),before=JSON.stringify(grouped);
 const list=ledger.pendingItems(grouped,{complete:true,rows:[{sku:'Y-SP-20-1',inbound:8}]});
 assert.deepEqual(list.map(x=>x.type),['mapping','quantity']);assert.equal(list[1].difference,22);assert.deepEqual(list[1].groups,[0]);
 assert.equal(JSON.stringify(grouped),before);
 assert.deepEqual(ledger.pendingItems(grouped,null).map(x=>x.type),['mapping']);
 maps[0].factor=null;const unknown=ledger.pendingItems(ledger.groups(rows,maps,materials),{complete:true,rows:[]});
 assert.deepEqual(unknown.map(x=>x.type),['unit','mapping']);
});

test('usage rankings retain SKU and unit boundaries and do not count transfer or adjustment fields',()=>{
 const report={complete:true,rows:[{sku:'A',unit:'個',outbound:2,transfer_out:99,adjustment:-100},{sku:'A',unit:'個',outbound:3},{sku:'B',unit:'公斤',outbound:7},{sku:'C',unit:'個',outbound:0}]};
 const result=ledger.usageRanking(report);assert.equal(result.length,2);assert.equal(result.find(x=>x.sku==='A').quantity,5);assert.equal(result.find(x=>x.sku==='B').unit,'公斤');
 assert.equal(ledger.usageRanking(null),null);assert.equal(ledger.usageRanking({complete:true,rows:[{sku:'A'}]}),null);
});

test('purchase overview never turns missing amounts into zero and keeps expenses and negative credits visible',()=>{
 const grouped=ledger.groups([...rows,{...rows[0],line:9,supplier:'C',label:'運費',amount:-4}],[],materials),model=ledger.purchaseOverview(grouped);
 assert.equal(model.amount,26);assert.equal(model.missing,1);assert.equal(model.suppliers.find(x=>x.supplier==='B').amount,null);assert.equal(model.suppliers.find(x=>x.supplier==='C').amount,-4);
 assert.equal(ledger.purchaseOverview(ledger.groups([rows[2]],[],materials)).amount,null);
 assert.match(ledger.ledgerCsv([[' =unsafe()','正常',null]]),/' =unsafe/);
});

test('changing a selected material clears only draft conversion and never mutates saved mapping',()=>{
 const original={material:'m1',unit:true,factor:2.5,note:'keep note',kind:'material'};
 assert.equal(ledger.selectMappingMaterial(original,'m1'),original);
 const changed=ledger.selectMappingMaterial(original,'m2');
 assert.equal(changed.unit,false);assert.equal(changed.factor,'');assert.equal(changed.unitReset,true);assert.equal(changed.note,'keep note');
 assert.equal(original.unit,true);assert.equal(original.factor,2.5);assert.equal(original.material,'m1');
 assert.equal(ledger.selectMappingMaterial(changed,'m1').unit,false);
});

test('comparison categories partition all confirmed SKUs and refuse partial reports',()=>{
 const maps=[{supplier:'A',source_label:'Y-SP20-1',kind:'material',material_id:'m1',factor:null},{supplier:'B',source_label:'Y-SP20-1',kind:'material',material_id:'m2',factor:1}];
 const grouped=ledger.groups(rows,maps,materials),before=JSON.stringify(maps);
 assert.throws(()=>ledger.compare(grouped,{complete:false,rows:[]}));assert.throws(()=>ledger.compare(grouped,null));
 const items=ledger.compare(grouped,{complete:true,rows:[{sku:'Y-SP-20A-1',inbound:8}]});
 assert.deepEqual(items.map(ledger.comparisonCategory),['unknown','matched']);
 assert.equal(ledger.comparisonCategory({...items[1],difference:.00004}),'matched');
 assert.equal(ledger.comparisonCategory({...items[1],difference:1}),'difference');
 assert.equal(JSON.stringify(maps),before);
});
test('similar candidates and exact SKUs never confirm themselves; supplier identities remain separate',()=>{
 const result=ledger.groups(rows,[],materials);assert.equal(result.length,2);assert.equal(result[0].status,'pending');assert.equal(result[0].quantity,15);assert.equal(result[0].rows.length,2);assert.equal(result[0].candidates[0].id,'m1');
 assert.equal(ledger.groups([{...rows[0],label:'Y-SP-20-1'}],[],materials)[0].status,'pending');assert.equal(result[1].unknownAmount,1);
});
test('unit-unknown, zero movements and missing quantities remain distinct; discounts are retained',()=>{
 const mappings=[{supplier:'A',source_label:'Y-SP20-1',kind:'material',material_id:'m1',factor:null}];
 let grouped=ledger.groups(rows,mappings,materials),out=ledger.compare(grouped,{complete:true,rows:[]});assert.equal(out[0].difference,null);assert.equal(out[0].inbound,0);
 mappings[0].factor=2;grouped=ledger.groups(rows,mappings,materials);out=ledger.compare(grouped,{complete:true,rows:[{sku:'Y-SP-20-1',inbound:12},{sku:'Y-SP-20-1',inbound:3}]});assert.equal(out[0].quantity,30);assert.equal(out[0].difference,15);
 assert.equal(ledger.compare(grouped,{complete:true,rows:[{sku:'Y-SP-20-1',inbound:null}]})[0].difference,null);
 assert.equal(ledger.groups([{...rows[0],amount:-4}],[],materials)[0].amount,-4);
});
test('expense, reverted and orphaned mappings cannot become material quantity comparisons',()=>{
 for(const kind of ['expense','pending']){const groups=ledger.groups(rows,[{supplier:'A',source_label:'Y-SP20-1',kind}],materials);assert.equal(ledger.compare(groups,{complete:true,rows:[]}).length,0);}
 const groups=ledger.groups(rows,[{supplier:'A',source_label:'Y-SP20-1',kind:'material',material_id:'missing'}],materials);assert.equal(groups[0].status,'invalid');assert.equal(ledger.compare(groups,{complete:true,rows:[]}).length,0);
});
test('review filters partition only pending groups, preserve source rows and export safely without confirming',()=>{
 const input=[...rows,{...rows[0],line:5,label:'Y-SP-20-1'},{...rows[0],line:6,label:'費用 <test>'},{...rows[0],line:7,label:'=BAD()'}];
 const before=JSON.stringify(input),grouped=ledger.groups(input,[],materials);
 const exact=ledger.filterGroups(grouped,'exact'),similar=ledger.filterGroups(grouped,'similar'),unmatched=ledger.filterGroups(grouped,'unmatched');
 assert.equal(exact.length,1);assert.equal(similar.length,2);assert.equal(unmatched.length,2);
 assert.equal(exact.length+similar.length+unmatched.length,grouped.length);
 assert.equal(ledger.filterGroups(grouped,'similar','B').length,1);
 const csv=ledger.reviewCsv(unmatched);assert.ok(csv.startsWith('\ufeff'));assert.match(csv,/'=BAD\(\)/);assert.match(csv,/人工處理方式/);
 assert.equal(JSON.stringify(input),before);assert.ok(grouped.every(g=>g.status==='pending'));
});
test('complete suffix with missing warehouse prefix ranks ahead of a shorter near match',()=>{
 const rows=[{id:'a',code:'Y-FLT-D-01-1'},{id:'b',code:'Y-FLT-D-01-1-1'}];
 const found=ledger.candidates('FLT-D-01-1-1',rows);assert.equal(found[0].id,'b');assert.match(found[0].reason,/前綴/);
 assert.equal(ledger.groups([{supplier:'A',label:'FLT-D-01-1-1',quantity:1}],[],rows)[0].status,'pending');
});
test('trial assigns candidates and probable fees without changing formal mappings or source groups',()=>{
 const input=[...rows,{...rows[0],line:5,label:'運費'},{...rows[0],line:6,label:'無候選測試'}];
 const grouped=ledger.groups(input,[],materials),before=JSON.stringify(grouped),trial=ledger.trialAssignments(grouped);
 assert.equal(trial.filter(a=>a.kind==='material').length,2);assert.ok(trial.filter(a=>a.kind==='material').every(a=>a.provisional&&a.unitAssumed&&a.factor===1));
 assert.equal(trial.find(a=>a.group.label==='運費').kind,'expense');assert.equal(trial.find(a=>a.group.label==='無候選測試').kind,'unresolved');
 assert.equal(JSON.stringify(grouped),before);assert.ok(grouped.every(g=>g.status==='pending'&&!g.mapping));
});
test('trial honors manual decisions and isolates hypothetical quantities from confirmed-only comparisons',()=>{
 const maps=[{supplier:'A',source_label:'Y-SP20-1',kind:'material',material_id:'m2',factor:null}];
 const grouped=ledger.groups(rows,maps,materials),trial=ledger.trialAssignments(grouped);
 assert.equal(trial[0].material.id,'m2');assert.equal(trial[0].provisional,false);assert.equal(trial[0].unitAssumed,true);
 assert.equal(ledger.compare(grouped,{complete:true,rows:[]})[0].difference,null);
 const model=ledger.trialModel(trial,{complete:true,rows:[{sku:'Y-SP-20A-1',inbound:8,outbound:2,opening:12,closing:18}]});
 const found=model.find(m=>m.sku==='Y-SP-20A-1');assert.equal(found.quantity,15);assert.equal(found.difference,7);assert.equal(found.closing,18);
 assert.equal(ledger.trialModel(trial)[0].difference,null);
 assert.throws(()=>ledger.trialModel(trial,{complete:false,rows:[]}));
 const invalid=ledger.trialAssignments(ledger.groups(rows,[{...maps[0],material_id:'gone'}],materials));assert.equal(invalid[0].kind,'unresolved');
});
test('trial hints distinguish unknown reports, no movement, no receipts and overlapping assumptions',()=>{
 const grouped=ledger.groups(rows,[],materials),a=ledger.trialAssignments(grouped);
 const loading=ledger.trialModel(a)[0];assert.ok(ledger.trialDiagnostics(loading).some(f=>f.code==='report'));assert.ok(!ledger.trialDiagnostics(loading).some(f=>f.code==='noMovement'));
 const absent=ledger.trialModel(a,{complete:true,rows:[]})[0],flags=ledger.trialDiagnostics(absent).map(f=>f.code);
 for(const code of ['mapping','unit','noMovement','difference'])assert.ok(flags.includes(code));assert.ok(!flags.includes('noInbound'));
 const moved=ledger.trialModel(a,{complete:true,rows:[{sku:'Y-SP-20-1',inbound:0,outbound:1,opening:2,closing:1}]})[0];
 assert.ok(ledger.trialDiagnostics(moved).some(f=>f.code==='noInbound'));assert.ok(!ledger.trialDiagnostics(moved).some(f=>f.code==='noMovement'));
 const exact={...moved,provisional:false,unitAssumed:false,inbound:23,difference:0};assert.equal(ledger.trialDiagnostics(exact)[0].code,'matched');
 assert.ok(ledger.trialDiagnostics({...exact,difference:.0001}).some(f=>f.code==='difference'));
});
test('many distinct provisional source labels are flagged without declaring a proven wrong mapping',()=>{
 const grouped=ledger.groups([{...rows[0],label:'SP20-1'},{...rows[1],label:'SP-20-1'}],[],materials);
 const model=ledger.trialModel(ledger.trialAssignments(grouped),{complete:true,rows:[]})[0];assert.ok(ledger.trialDiagnostics(model).some(f=>f.code==='shared'));
 const before=JSON.stringify(model);ledger.trialDiagnostics(model);assert.equal(JSON.stringify(model),before);
});
test('transaction readback is exact-SKU, sorted, read-only, and unavailable is distinct from empty',()=>{
 const tx=[{id:'a',occurred_at:'2026-10-01',materials:{sku:'Y-1'}},{id:'b',occurred_at:'2026-10-02',materials:{sku:'Y-11'}},{id:'c',occurred_at:'2026-10-03',materials:{sku:'Y-1'}}];
 const before=JSON.stringify(tx);assert.deepEqual(ledger.trialTransactions({complete:true,transactions:tx},'Y-1').map(t=>t.id),['c','a']);assert.equal(JSON.stringify(tx),before);
 assert.equal(ledger.trialTransactions({complete:true,rows:[]},'Y-1'),null);assert.deepEqual(ledger.trialTransactions({complete:true,transactions:[]},'Y-1'),[]);
});
test('purchase helper prefers current network logic and retains cached helper only for offline fallback',async()=>{
 for(const offline of [false,true,'server-error']){
  const handlers={},puts=[];let result;
  const ctx=vm.createContext({URL,self:{location:{origin:'https://erp.invalid'},addEventListener:(name,handler)=>handlers[name]=handler},
   caches:{match:async()=>new Response('cached-helper'),open:async()=>({put:(...args)=>puts.push(args)})},
   fetch:async()=>{if(offline===true)throw Error('offline');if(offline==='server-error')return new Response('failed-helper',{status:503});return new Response('fresh-helper');}});
  vm.runInContext(fs.readFileSync('sw.js','utf8'),ctx);
  handlers.fetch({request:new Request('https://erp.invalid/erp-purchase-ledger.js?build=V.TEST'),respondWith:p=>result=p});
  assert.equal(await (await result).text(),offline?'cached-helper':'fresh-helper');
 }
});
const source=fs.readFileSync('cloudflare-worker-green-wave-c22f-FULL-UPDATED.js','utf8');
const block=source.slice(source.indexOf('function purchaseLedgerSource('),source.indexOf('async function erpInventoryPeriodReport('));
const id='11111111-1111-4111-8111-111111111111';
function context(extra={}){
 const calls=[];const c=vm.createContext({Request,Response,URL,JSON,encodeURIComponent,cleanText:v=>String(v||'').trim(),isUuid:v=>/^[a-f0-9-]{36}$/i.test(v||''),
 erpClientAuthorized:async()=>true,unauthorizedErpClient:()=>Response.json({error:'Unauthorized'},{status:401}),getSupabaseInventoryContext:async()=>({organization:{id}}),jh:c=>c,
 resp400:(_c,e)=>Response.json({error:e},{status:400}),supabaseFetch:async(p,path,opts)=>{calls.push({path,opts});return [];},supabaseSingle:async()=>null,...extra});
 vm.runInContext(block,c);return {c,calls};
}
function req(path,role='purchase',body){const url=new URL('https://isolated.invalid/api/purchase-ledger/'+path);return [new Request(url,{method:body?'POST':'GET',headers:{'X-ERP-Role':role},...(body?{body:JSON.stringify(body)}:{})}),url];}
const batch={source_key:'115進貨明細表.xlsx',source_hash:'a'.repeat(64),period:'2026-10',payload:{sheet:'仂邁1',rows:[rows[0]]}};
test('batch validation rejects duplicate Excel lines, encrypted/raw attachments and extra financial fields',()=>{
 const {c}=context();assert.equal(c.purchaseLedgerValidateBatch(batch).rows.length,1);
 for(const change of [{...batch,period:'2026-13'},{...batch,period:'2027-01'},{...batch,payload:{...batch.payload,rows:[rows[0],rows[0]]}},{...batch,payload:{...batch.payload,rows:[{...rows[0],bank:'secret'}]}}])assert.throws(()=>c.purchaseLedgerValidateBatch(change));
});
test('financial read permissions and AI read-only writes are enforced at the Worker',async()=>{
 const {c,calls}=context();for(const role of ['sales','qc','viewer']){const [r,u]=req('list',role);assert.equal((await c.erpPurchaseLedger(r,{}, {},u)).status,403);}
 const [r,u]=req('import','ai',batch);assert.equal((await c.erpPurchaseLedger(r,{}, {},u)).status,403);assert.equal(calls.length,0);
 const unauth=context({erpClientAuthorized:async()=>false});const [a,b]=req('list');assert.equal((await unauth.c.erpPurchaseLedger(a,{}, {},b)).status,401);
});
test('month catalog is scoped and deduplicates versions; new years use the matching annual file',async()=>{
 const {c}=context({supabaseFetch:async()=>[
  {period:'2027-01',source_key:'116進貨明細表.xlsx'},
  {period:'2026-11',source_key:'115進貨明細表.xlsx'},
  {period:'2026-11',source_key:'115進貨明細表.xlsx'},
  {period:'2026-08',source_key:'114進貨明細表.xlsx'}
 ]});
 const [r,u]=req('periods','warehouse');
 assert.deepEqual((await (await c.erpPurchaseLedger(r,{}, {},u)).json()).periods,['2027-01','2026-11']);
 assert.equal(c.purchaseLedgerValidateBatch({...batch,period:'2027-01',source_key:'116進貨明細表.xlsx'}).rows.length,1);
});
test('import uses immutable metadata upsert and exact receipt readback only',async()=>{
 const {c,calls}=context({supabaseSingle:async()=>({id,payload:batch.payload})});const [r,u]=req('import','purchase',batch);
 assert.equal((await c.erpPurchaseLedger(r,{}, {},u)).status,200);assert.equal(calls.length,1);assert.match(calls[0].path,/erp_purchase_batches/);assert.equal(calls[0].opts.headers.Prefer,'resolution=ignore-duplicates');
});
test('mapping resolves source batch in the same organization and calls only the audit RPC',async()=>{
 const {c,calls}=context({supabaseSingle:async()=>({id,payload:batch.payload})});
 const body={batch_id:id,request_id:id,version:0,supplier:'A',label:'Y-SP20-1',kind:'material',material_id:id,factor:null,note:'確認'};
 const [r,u]=req('mapping','warehouse',body);assert.equal((await c.erpPurchaseLedger(r,{}, {},u)).status,200);assert.equal(calls.length,1);assert.equal(calls[0].path,'/rest/v1/rpc/erp_purchase_mapping_save');
 const [bad,url]=req('mapping','warehouse',{...body,label:'not in source'});assert.equal((await c.erpPurchaseLedger(bad,{}, {},url)).status,400);assert.equal(calls.length,1);
});

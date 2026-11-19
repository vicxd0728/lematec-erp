const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ledger=require('../erp-purchase-ledger.js');
const materials=[{id:'m1',code:'Y-SP-20-1',unit:'個'},{id:'m2',code:'Y-SP-20A-1',unit:'個'}];
const rows=[{line:2,supplier:'A',label:'Y-SP20-1',quantity:10,unit_price:2,amount:20},{line:3,supplier:'A',label:'Y-SP20-1',quantity:5,unit_price:2,amount:10},{line:4,supplier:'B',label:'Y-SP20-1',quantity:8,unit_price:2,amount:null}];
test('similar candidates and exact SKUs never confirm themselves; supplier identities remain separate',()=>{
 const result=ledger.groups(rows,[],materials);assert.equal(result.length,2);assert.equal(result[0].status,'pending');assert.equal(result[0].quantity,15);assert.equal(result[0].rows.length,2);assert.equal(result[0].candidates[0].id,'m1');
 assert.equal(ledger.groups([{...rows[0],label:'Y-SP-20-1'}],[],materials)[0].status,'pending');assert.equal(result[1].unknownAmount,1);
});
test('unit-unknown, zero movements and missing quantities remain distinct; discounts are retained',()=>{
 const mappings=[{supplier:'A',source_label:'Y-SP20-1',kind:'material',material_id:'m1',factor:null}];
 let grouped=ledger.groups(rows,mappings,materials),out=ledger.compare(grouped,{rows:[]});assert.equal(out[0].difference,null);assert.equal(out[0].inbound,0);
 mappings[0].factor=2;grouped=ledger.groups(rows,mappings,materials);out=ledger.compare(grouped,{rows:[{sku:'Y-SP-20-1',inbound:12},{sku:'Y-SP-20-1',inbound:3}]});assert.equal(out[0].quantity,30);assert.equal(out[0].difference,15);
 assert.equal(ledger.compare(grouped,{rows:[{sku:'Y-SP-20-1',inbound:null}]})[0].difference,null);
 assert.equal(ledger.groups([{...rows[0],amount:-4}],[],materials)[0].amount,-4);
});
test('expense, reverted and orphaned mappings cannot become material quantity comparisons',()=>{
 for(const kind of ['expense','pending']){const groups=ledger.groups(rows,[{supplier:'A',source_label:'Y-SP20-1',kind}],materials);assert.equal(ledger.compare(groups,{rows:[]}).length,0);}
 const groups=ledger.groups(rows,[{supplier:'A',source_label:'Y-SP20-1',kind:'material',material_id:'missing'}],materials);assert.equal(groups[0].status,'invalid');assert.equal(ledger.compare(groups,{rows:[]}).length,0);
});
const source=fs.readFileSync('cloudflare-worker-green-wave-c22f-FULL-UPDATED.js','utf8');
const block=source.slice(source.indexOf('function purchaseLedgerValidateBatch('),source.indexOf('async function erpInventoryPeriodReport('));
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
 for(const change of [{...batch,period:'2026-08'},{...batch,payload:{...batch.payload,rows:[rows[0],rows[0]]}},{...batch,payload:{...batch.payload,rows:[{...rows[0],bank:'secret'}]}}])assert.throws(()=>c.purchaseLedgerValidateBatch(change));
});
test('financial read permissions and AI read-only writes are enforced at the Worker',async()=>{
 const {c,calls}=context();for(const role of ['sales','qc','viewer']){const [r,u]=req('list',role);assert.equal((await c.erpPurchaseLedger(r,{}, {},u)).status,403);}
 const [r,u]=req('import','ai',batch);assert.equal((await c.erpPurchaseLedger(r,{}, {},u)).status,403);assert.equal(calls.length,0);
 const unauth=context({erpClientAuthorized:async()=>false});const [a,b]=req('list');assert.equal((await unauth.c.erpPurchaseLedger(a,{}, {},b)).status,401);
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

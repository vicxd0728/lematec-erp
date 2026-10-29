const {test}=require('node:test'),assert=require('node:assert/strict'),{harness}=require('./helpers/corder_reversal_harness.cjs');

test('all literal Worker quantity transaction types satisfy the deployed schema contract',()=>{
 const fs=require('node:fs'),schema=fs.readFileSync('tests/fixtures/inventory_transaction_type_check.sql','utf8'),worker=fs.readFileSync('cloudflare-worker-green-wave-c22f-FULL-UPDATED.js','utf8');
 const clause=schema.match(/constraint inventory_transaction_type_check check \(transaction_type in \(([^\n]+)\)\)/)[1];
 const allowed=new Set([...clause.matchAll(/'([^']+)'/g)].map(x=>x[1]));
 const types=[...worker.matchAll(/p_transaction_type\s*:\s*'([^']+)'/g)].map(x=>x[1]);
 assert(types.length>=2);for(const type of types)assert(allowed.has(type),'Unsupported inventory RPC type: '+type);
});

test('schema-rejected pending return resumes its frozen operation exactly once after deployment',async()=>{
 const h=harness({failure:'typeConstraint'}),body=h.intent();
 const failed=await (await h.run(body)).json();assert.match(failed.error,/inventory_transaction_type_check/);
 assert(h.state.ledger.pending);const originalId=h.state.ledger.pending.id;
 assert.equal(h.state.moves,0);assert.deepEqual(h.state.stocks,{[h.a]:9,[h.b]:8});
 const retry=await (await h.run({...body,operation_id:require('node:crypto').randomUUID(),qty:2,stock_mode:'scrap',resume:true})).json();
 assert(retry.ok);assert.equal(h.state.moves,1);assert.equal(h.state.stocks[h.a],10);assert.equal(h.state.stocks[h.b],10);
 assert(h.state.receipts.has('corder-reversal:'+originalId));assert.equal(h.state.ledger.completed[0].qty,1);
 assert((await (await h.run(body)).json()).duplicate);assert.equal(h.state.moves,1);
});
test('server-created flat inventory mirror tasks hydrate without replaying quantities',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),html=fs.readFileSync('index.html','utf8'),written={};
 const c=vm.createContext({reliabilityWorker:async()=>({jobs:[{module:'inventory_notion',dedupe_key:'inventory_notion:a',payload:{page_id:'a',sku:'S-A'}},{module:'inventory_notion',dedupe_key:'inventory_notion:b',payload:{task:{page_id:'b',sku:'S-B'}}}]}),reliableMirrorKey:(m,t)=>m+':'+t.page_id});
 for(const name of ['InventoryMirrorQueue','InventoryNotionMirrorQueue','WorkflowNotionSyncQueue','PendingBomNotionMirrors','NotesNotionMirrorQueue']){c['read'+name]=()=>[];c['write'+name]=rows=>written[name]=rows;}
 vm.runInContext(html.slice(html.indexOf('async function hydrateReliableMirrorJobs('),html.indexOf('async function flushReliableMirrorQueues(')),c);await c.hydrateReliableMirrorJobs();assert.equal(written.InventoryNotionMirrorQueue.length,2);assert.equal(written.InventoryNotionMirrorQueue[0].sku,'S-A');
});
test('pending original order outside recent history is loaded by exact page ID, including unfinished archive',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),html=fs.readFileSync('index.html','utf8'),h=harness();h.state.page.created_time='2020-01-01T00:00:00Z';h.state.page.archived=true;
 const text=p=>(p?.rich_text||p?.title||[]).map(x=>x.text?.content||'').join('');let reads=0;
 const c=vm.createContext({window:{corders:[]},isViewOnly:()=>false,isAdminRole:()=>false,ROLE:'sales',PROXY:'',DB:{corders:'qa-db'},canonicalPageId:s=>String(s||'').replaceAll('-',''),localStorage:{getItem:()=>null},erpWorkerHeaders:()=>({}),fetch:async()=>Response.json({ok:true,pending:[{page_id:h.pageId}]}),notionAPI:async(method,path)=>{assert.equal(method,'GET');assert.equal(path,'pages/'+h.pageId);reads++;return structuredClone(h.state.page);},getTitle:(p,k)=>text(p[k]),getRichText:(p,k)=>text(p[k])});
 vm.runInContext(html.slice(html.indexOf('function mapCorderPage('),html.indexOf('async function loadCorders(')),c);vm.runInContext(html.slice(html.indexOf('async function loadCorderReversalPending('),html.indexOf('const _corderReversalLocks=')),c);
 await c.loadCorderReversalPending();assert.equal(reads,1);assert.equal(c.window.corders[0].id,h.pageId);assert.equal(c.window.corders[0].qty,3);assert(c.window._corderReversalPending[h.pageId]);
});
for(const action of ['return','cancel','delete'])for(const failure of ['lostResponse','patchFail','logFail'])test(`${action}/${failure}: stored intent survives changed quantity/mode, reload and repeated response`,async()=>{
 const h=harness({status:action==='cancel'?'出貨中':'已完成',failure}),body=h.intent({action});
 assert.equal((await h.run(body)).status,409);assert.equal(h.state.moves,1);assert(h.state.ledger.pending);
 const changed=h.intent({action,qty:2,stock_mode:'scrap'});assert.equal((await h.run(changed)).status,409);assert.equal(h.state.moves,1);
 const retry=await (await h.run({...changed,resume:true})).json();assert(retry.ok);assert.equal(h.state.moves,1);assert.equal(h.state.logs.size,2);assert(!h.state.ledger.pending);
 assert((await (await h.run(body)).json()).duplicate);assert.equal(h.state.moves,1);
});
test('partial return then remaining return uses saved component ratios and cannot over-return',async()=>{
 const h=harness();assert((await (await h.run(h.intent())).json()).ok);assert.equal(h.state.stocks[h.a],10);assert.equal(h.state.stocks[h.b],10);
 assert.equal((await h.run(h.intent({qty:2}))).status,409); // stale expected quantity
 const next=h.intent({qty:2,expected:{qty:3,returned:1,status:'部分退貨',refs:`${h.a}:3;${h.b}:6`}});assert((await (await h.run(next)).json()).ok);assert.equal(h.state.stocks[h.a],12);assert.equal(h.state.stocks[h.b],14);assert.equal(h.snapshot().status,'已退貨');assert.equal(h.state.moves,2);
 assert.equal((await h.run(h.intent())).status,409);assert.equal(h.state.moves,2);
});
test('scrap records return quantity without changing inventory',async()=>{const h=harness();assert((await (await h.run(h.intent({stock_mode:'scrap'}))).json()).ok);assert.equal(h.state.moves,0);assert.equal(h.snapshot().status,'部分退貨');});
test('long original notes are preserved in bounded rich text chunks',async()=>{const h=harness();h.state.page.properties.備註={rich_text:[{text:{content:'原'.repeat(3500)}}]};assert((await (await h.run(h.intent())).json()).ok);assert(h.snapshot().note.startsWith('原'.repeat(3500)));assert(h.state.page.properties.備註.rich_text.every(x=>x.text.content.length<=1800));});
test('legacy single saved material ID returns that S SKU without consulting current BOM',async()=>{const h=harness();h.state.page.properties.料件ID={rich_text:[{text:{content:h.a}}]};const body=h.intent();body.expected.refs=h.a;assert((await (await h.run(body)).json()).ok);assert.equal(h.state.stocks[h.a],10);assert.equal(h.state.stocks[h.b],8);assert.equal(h.state.logs.size,1);});
test('concurrent different actions/quantities share one durable claim',async()=>{const h=harness({status:'出貨中'}),x=h.intent({action:'cancel'}),y=h.intent({action:'delete'});const results=await Promise.all([h.run(x),h.run(y)]);assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(h.state.moves,1);});
test('cancel after return and stale device attempts cannot add stock',async()=>{const h=harness(),old=h.intent({action:'cancel'});await h.run(h.intent());assert.equal((await h.run(old)).status,409);assert.equal(h.state.moves,1);});
test('legacy ambiguous returns, missing refs, wrong roles and unconfirmed stock stop before changes',async()=>{for(const mode of ['legacy','refs','role','status']){const h=harness({legacy:mode==='legacy',status:mode==='status'?'需確認':'已完成'});if(mode==='refs')h.state.page.properties.料件ID.rich_text=[];assert.notEqual((await h.run(h.intent(),mode==='role'?'ai':'sales')).status,200);assert.equal(h.state.moves,0);}});

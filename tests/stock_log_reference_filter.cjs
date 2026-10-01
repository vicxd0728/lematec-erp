const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');

const worker=fs.readFileSync(path.join(__dirname,'../cloudflare-worker-green-wave-c22f-FULL-UPDATED.js'),'utf8');
const handler=worker.slice(worker.indexOf('async function erpStockLogList('),worker.indexOf('function isStockLogTestRow('));

function setup(){
  const paths=[];
  const ctx=vm.createContext({
    URL,Date,
    cleanText:v=>String(v||'').trim(),
    supabaseFetch:async (_env,p)=>{paths.push(p);return [];},
    respOK:(_cors,payload)=>payload,
    resp400:(_cors,error)=>({status:400,error}),
    resp500:(_cors,error)=>({status:500,error}),
    isStockLogTestRow:()=>false,
  });
  vm.runInContext(handler,ctx);
  return {ctx,paths};
}

test('reference prefix narrows the database query before pagination',async()=>{
  const s=setup();
  const result=await s.ctx.erpStockLogList(new Request('https://erp.example/api/stock-log/list?mode=all&ref_prefix=SHPTW16283'),{},{});
  assert.equal(result.ok,true);
  assert(s.paths[0].includes('ref_no=like.SHPTW16283*'));
});

test('malformed reference prefix is rejected before database access',async()=>{
  const s=setup();
  const result=await s.ctx.erpStockLogList(new Request('https://erp.example/api/stock-log/list?ref_prefix=abc%29%2Cor%3D%281%29'),{},{});
  assert.equal(result.status,400);
  assert.equal(s.paths.length,0);
});

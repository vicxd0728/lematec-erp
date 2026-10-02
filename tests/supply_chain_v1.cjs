const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');

const source=fs.readFileSync(path.join(__dirname,'../cloudflare-worker-green-wave-c22f-FULL-UPDATED.js'),'utf8');
const block=source.slice(source.indexOf('// Supply-chain work is a tracking ledger.'),source.indexOf('async function erpInboundCreate'));
const org='00000000-0000-4000-8000-000000000001';
const op=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

function harness(){
  const jobs=new Map(),suppliers=new Map(),templates=new Map(),workTypes=new Map(),receipts=new Map(),inventoryWrites=[];
  async function supabaseFetch(_env,path,options={}){
    const url=new URL(path,'https://db.test');
    const params=url.searchParams;
    if(url.pathname.endsWith('/erp_supply_jobs')){
      if(options.method==='POST'){
        const row=JSON.parse(options.body);if(!jobs.has(row.id))jobs.set(row.id,{...row,version:1,current_step:0,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
        return null;
      }
      if(options.method==='PATCH'){
        const id=params.get('id').slice(3),version=Number(params.get('version').slice(3));
        const row=jobs.get(id);if(!row||row.version!==version)return [];
        Object.assign(row,JSON.parse(options.body));return [{...row}];
      }
      const id=params.get('id')?.slice(3);
      return id?(jobs.has(id)?[{...jobs.get(id)}]:[]):[...jobs.values()];
    }
    if(url.pathname.endsWith('/erp_supply_suppliers')){
      if(options.method==='POST'){let row=JSON.parse(options.body);suppliers.set(row.id,row);return null;}
      const id=params.get('id')?.slice(3);return id?(suppliers.has(id)?[suppliers.get(id)]:[]):[...suppliers.values()];
    }
    if(url.pathname.endsWith('/erp_supply_templates')){
      if(options.method==='POST'){let row=JSON.parse(options.body);templates.set(row.id,row);return null;}
      const id=params.get('id')?.slice(3);return id?(templates.has(id)?[templates.get(id)]:[]):[...templates.values()];
    }
    if(url.pathname.endsWith('/erp_supply_work_types')){
      if(options.method==='POST'){const row=JSON.parse(options.body);if(!workTypes.has(row.id))workTypes.set(row.id,row);return null;}
      const id=params.get('id')?.slice(3);return id?(workTypes.has(id)?[workTypes.get(id)]:[]):[...workTypes.values()];
    }
    if(url.pathname.endsWith('/inbound_receipts')){
      const id=params.get('id')?.slice(3),number=params.get('inbound_number')?.slice(3);
      let row=receipts.get(id);return row?.inbound_number===number?[row]:[];
    }
    inventoryWrites.push({path,options});throw new Error('unexpected database path '+path);
  }
  const ctx=vm.createContext({
    Request,Response,URL,Set,Date,Number,JSON,Array,console,
    cleanText:v=>String(v??'').trim(),
    encodeURIComponent,
    deterministicUuid:async value=>op([...value].reduce((sum,c)=>sum+c.charCodeAt(0),0)),
    getSupabaseInventoryContext:async()=>({organization:{id:org}}),
    erpClientAuthorized:async()=>true,
    unauthorizedErpClient:cors=>Response.json({error:'unauthorized'},{status:401,headers:cors}),
    jh:cors=>({...cors,'content-type':'application/json'}),
    respOK:(cors,data)=>Response.json(data,{headers:cors}),
    resp400:(cors,error)=>Response.json({error},{status:400,headers:cors}),
    resp500:(cors,error)=>Response.json({error},{status:500,headers:cors}),
    supabaseFetch,
    supabaseSingle:async(_env,path,allowMissing=false)=>{
      const rows=await supabaseFetch(null,path);if(rows[0])return rows[0];if(allowMissing)return null;throw Error('missing row');
    },
    taipeiISOString:()=> '2026-10-02T12:00:00+08:00',
  });
  vm.runInContext(block,ctx);
  const call=async(body)=>{
    const response=await ctx.erpSupplyWrite(new Request('https://erp.test/api/supply/write',{method:'POST',headers:{'X-ERP-Role':'purchase','Content-Type':'application/json'},body:JSON.stringify(body)}),{},{});
    return {status:response.status,data:await response.json()};
  };
  return {call,jobs,workTypes,receipts,inventoryWrites};
}

test('new work type is saved once and can be used on a later job',async()=>{
  const h=harness();
  let result=await h.call({action:'add_work_type',operation_id:op(70),name:'雷射雕刻'});
  assert.equal(result.status,200);assert.equal(result.data.row.name,'雷射雕刻');
  result=await h.call({action:'add_work_type',operation_id:op(71),name:'雷射雕刻'});
  assert.equal(result.status,200);assert.equal(h.workTypes.size,1);
  result=await h.call({action:'create',operation_id:op(72),title:'試作',steps:[{type:'雷射雕刻',supplier:'甲廠'}]});
  assert.equal(result.status,200);assert.equal(result.data.row.steps[0].type,'雷射雕刻');
  result=await h.call({action:'create',operation_id:op(73),title:'錯誤工項',steps:[{type:'未登記加工',supplier:'甲廠'}]});
  assert.equal(result.status,500);assert.equal(h.jobs.has(op(73)),false);
});

test('create, insert after current, advance, then close leaves inventory untouched',async()=>{
  const h=harness(),id=op(1);
  let result=await h.call({action:'create',operation_id:id,title:'外部原料製作',steps:[{type:'沖壓',supplier:'廠 A'}]});
  assert.equal(result.status,200);assert.equal(result.data.row.status,'加工中');
  assert.equal(result.data.row.events[0].detail.to,'廠 A');
  assert.equal(result.data.row.material_sku,null);
  result=await h.call({action:'insert_step',operation_id:op(2),job_id:id,expected_version:1,at:1,step:{type:'攻牙',supplier:'廠 B'}});
  assert.equal(result.status,200);assert.equal(result.data.row.steps[1].type,'攻牙');
  result=await h.call({action:'advance',operation_id:op(4),job_id:id,expected_version:2});
  assert.equal(result.status,200);assert.equal(result.data.row.current_step,1);
  result=await h.call({action:'complete',operation_id:op(5),job_id:id,expected_version:3});
  assert.equal(result.data.row.status,'待決定');
  result=await h.call({action:'close',operation_id:op(6),job_id:id,expected_version:4});
  assert.equal(result.data.row.status,'已結案');
  assert.equal(result.data.row.events.length,5);
  assert.equal(h.inventoryWrites.length,0);
});

test('stale version and duplicated operation cannot rewrite a newer plan',async()=>{
  const h=harness(),id=op(11);
  await h.call({action:'create',operation_id:id,title:'批次',steps:[{type:'噴砂',supplier:'廠 A'}]});
  const change={action:'insert_step',operation_id:op(12),job_id:id,expected_version:1,at:1,step:{type:'電鍍',supplier:''}};
  let result=await h.call(change);assert.equal(result.data.row.version,2);
  result=await h.call(change);assert.equal(result.status,200);assert.equal(result.data.existing,true);assert.equal(result.data.row.steps.length,2);
  result=await h.call({...change,operation_id:op(13)});assert.equal(result.status,409);
  assert.equal(h.jobs.get(id).steps.length,2);
});

test('inbound decision links only a matching accepted receipt',async()=>{
  const h=harness(),id=op(21);
  await h.call({action:'create',operation_id:id,title:'試作',steps:[{type:'電子廠',supplier:'廠 C'}]});
  await h.call({action:'complete',operation_id:op(23),job_id:id,expected_version:1});
  let result=await h.call({action:'prepare_inbound',operation_id:op(24),job_id:id,expected_version:2});
  assert.equal(result.data.row.status,'待入料');
  const number=result.data.row.inbound_number;
  result=await h.call({action:'link_inbound',operation_id:op(25),job_id:id,expected_version:3,inbound_receipt_id:op(26)});
  assert.equal(result.status,400);
  h.receipts.set(op(26),{id:op(26),inbound_number:number});
  result=await h.call({action:'link_inbound',operation_id:op(25),job_id:id,expected_version:3,inbound_receipt_id:op(26)});
  assert.equal(result.status,200);assert.equal(result.data.row.status,'待品檢');
  assert.equal(h.inventoryWrites.length,0);
});

test('editing active work records the correction and preserves completed history',async()=>{
  const h=harness(),id=op(80);
  await h.call({action:'create',operation_id:id,title:'原工作',steps:[{type:'噴砂',supplier:'甲廠'},{type:'攻牙',supplier:'乙廠'}]});
  let result=await h.call({action:'edit',operation_id:op(81),job_id:id,expected_version:1,title:'更正工作',quantity:100,due_date:'2026-10-10',step:{type:'清洗',supplier:'丙廠'}});
  assert.equal(result.status,200);assert.equal(result.data.row.title,'更正工作');
  assert.equal(result.data.row.steps[0].supplier,'丙廠');
  assert.equal(result.data.row.events[1].detail.before.step.supplier,'甲廠');
  await h.call({action:'advance',operation_id:op(82),job_id:id,expected_version:2});
  result=await h.call({action:'edit',operation_id:op(83),job_id:id,expected_version:3,title:'再更正',quantity:100,step:{type:'攻牙',supplier:'丁廠'}});
  assert.equal(result.status,200);assert.equal(result.data.row.steps[0].supplier,'丙廠');
  assert.equal(result.data.row.steps[1].supplier,'丁廠');
});

test('worker role matrix restricts supply writes to operations roles',()=>{
  assert.match(source,/\'\/api\/supply\/write\': \['vic', 'manager', 'purchase', 'warehouse'\]/);
  assert.doesNotMatch(source,/\'\/api\/supply\/write\': \[[^\]]*'ai'/);
});

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');

const source=fs.readFileSync(path.join(__dirname,'../cloudflare-worker-green-wave-c22f-FULL-UPDATED.js'),'utf8');
const block=source.slice(source.indexOf('// Supply-chain work is a tracking ledger.'),source.indexOf('async function erpInboundCreate'));
const org='00000000-0000-4000-8000-000000000001';
const op=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;

function harness({notionTypes=[],notionSuppliers=[],notionFails=false}={}){
  const jobs=new Map(),suppliers=new Map(),templates=new Map(),workTypes=new Map(),materials=new Set(),receipts=new Map(),inventoryWrites=[];
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
      if(options.method==='POST'){
        const row=JSON.parse(options.body);if(!templates.has(row.id))templates.set(row.id,{...row,version:1});return null;
      }
      if(options.method==='PATCH'){
        const id=params.get('id')?.slice(3),version=Number(params.get('version')?.slice(3));
        const row=templates.get(id);if(!row||row.version!==version)return [];
        Object.assign(row,JSON.parse(options.body));return [{...row}];
      }
      const id=params.get('id')?.slice(3),sku=params.get('material_sku')?.slice(3),name=params.get('name')?.slice(3);
      return [...templates.values()].filter(row=>(!id||row.id===id)&&(!sku||row.material_sku===sku)&&(!name||row.name===name));
    }
    if(url.pathname.endsWith('/materials')){
      const sku=params.get('sku')?.slice(3);return materials.has(sku)?[{sku}]:[];
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
    notionQueryAll:async(_token,databaseId)=>{
      if(notionFails)throw Error('Notion unavailable');
      return databaseId==='2d8b97a9-6a34-4eb0-b14c-107a140a0c87'?notionTypes:notionSuppliers;
    },
    supabaseSingle:async(_env,path,allowMissing=false)=>{
      const rows=await supabaseFetch(null,path);if(rows[0])return rows[0];if(allowMissing)return null;throw Error('missing row');
    },
    taipeiISOString:()=> '2026-10-02T12:00:00+08:00',
  });
  vm.runInContext(block,ctx);
  const call=async(body,env={})=>{
    if(body.action==='create'&&!Object.hasOwn(body,'due_date'))body={...body,due_date:'2026-10-10'};
    const response=await ctx.erpSupplyWrite(new Request('https://erp.test/api/supply/write',{method:'POST',headers:{'X-ERP-Role':'purchase','Content-Type':'application/json'},body:JSON.stringify(body)}),env,{});
    return {status:response.status,data:await response.json()};
  };
  const catalog=async()=>{
    const response=await ctx.erpSupplyCatalog(new Request('https://erp.test/api/supply/catalog'),{NOTION_TOKEN:'fixture-only'},{});
    return {status:response.status,data:await response.json()};
  };
  return {call,catalog,jobs,suppliers,templates,workTypes,materials,receipts,inventoryWrites};
}

test('Notion catalog adds active suppliers and linked work types without duplicating ERP names',async()=>{
  const typeId=op(301),supplierId=op(302);
  const page=(id,name,active,extra={})=>({id,archived:false,properties:{'名稱':{title:[{plain_text:name}]},'啟用':{checkbox:active},...extra}});
  const h=harness({
    notionTypes:[page(typeId,'精密清洗',true),page(op(303),'停用工項',false)],
    notionSuppliers:[page(supplierId,'甲供應商',true,{'可承接工項':{relation:[{id:typeId}]}}),page(op(304),'停用供應商',false)],
  });
  let result=await h.catalog();
  assert.equal(result.status,200);
  assert.deepEqual(result.data.work_types.map(row=>row.name),['精密清洗']);
  assert.deepEqual(result.data.suppliers[0].work_type_names,['精密清洗']);
  assert.equal(result.data.suppliers[0].source,'notion');
  assert.match(result.data.notion_links.suppliers,/app\.notion\.com/);
  const created=await h.call({action:'create',operation_id:op(307),title:'測試工項',steps:[{type:'精密清洗',supplier:'甲供應商'}]},{NOTION_TOKEN:'fixture-only'});
  assert.equal(created.status,200);
  const repeated=await h.call({action:'add_supplier',operation_id:op(305),name:'甲供應商'},{NOTION_TOKEN:'fixture-only'});
  assert.equal(repeated.data.existing,true);
  assert.equal(h.suppliers.size,0);
  result=await h.catalog();
  assert.equal(result.data.suppliers.length,1);
  assert.equal(result.data.suppliers[0].source,'notion');
});

test('disabled Notion entries disappear for new work while an existing step remains editable',async()=>{
  const page=(id,name,active,extra={})=>({id,archived:false,properties:{'名稱':{title:[{plain_text:name}]},'啟用':{checkbox:active},...extra}});
  const h=harness({notionTypes:[page(op(320),'沖壓',false)],notionSuppliers:[page(op(321),'甲廠',false)]});
  const id=op(322);
  let result=await h.call({action:'create',operation_id:id,title:'舊工作',steps:[{type:'沖壓',supplier:'甲廠'}]});
  assert.equal(result.status,200);
  result=await h.catalog();
  assert.deepEqual(result.data.disabled_work_types,['沖壓']);
  assert.equal(result.data.suppliers.some(row=>row.name==='甲廠'),false);
  result=await h.call({action:'create',operation_id:op(323),title:'新工作',steps:[{type:'沖壓',supplier:'甲廠'}]},{NOTION_TOKEN:'fixture-only'});
  assert.notEqual(result.status,200);
  result=await h.call({action:'add_work_type',operation_id:op(324),name:'沖壓'},{NOTION_TOKEN:'fixture-only'});
  assert.equal(result.status,400);
  result=await h.call({action:'add_supplier',operation_id:op(325),name:'甲廠'},{NOTION_TOKEN:'fixture-only'});
  assert.equal(result.status,400);
  result=await h.call({action:'edit',operation_id:op(326),job_id:id,expected_version:1,title:'舊工作',quantity:12,due_date:'2026-10-10',step:{type:'沖壓',supplier:'甲廠'}},{NOTION_TOKEN:'fixture-only'});
  assert.equal(result.status,200);
  assert.equal(result.data.row.quantity,12);
});

test('Notion outage leaves ERP catalog available and exposes a read error',async()=>{
  const h=harness({notionFails:true});
  await h.call({action:'add_work_type',operation_id:op(306),name:'精密清洗'});
  const result=await h.catalog();
  assert.equal(result.status,200);
  assert.equal(result.data.work_types[0].name,'精密清洗');
  assert.match(result.data.notion_error,/Notion unavailable/);
});

test('saving a fixed process binds an exact SKU and updates that SKU on later saves',async()=>{
  const h=harness(),id=op(200);h.materials.add('Y-A');
  await h.call({action:'create',operation_id:id,title:'Y-A',material_sku:'Y-A',steps:[{type:'沖壓',supplier:'甲廠',due_at:'2026-10-08T17:00:00+08:00'}]});
  let result=await h.call({action:'save_template',operation_id:op(201),source_job_id:id,name:'Y-A 固定流程',material_sku:'Y-A'});
  assert.equal(result.status,200);assert.equal(result.data.row.material_sku,'Y-A');
  assert.equal(result.data.row.steps[0].due_at,undefined);
  assert.equal(result.data.row.steps[0].started_at,undefined);
  const templateId=result.data.row.id;
  await h.call({action:'insert_step',operation_id:op(202),job_id:id,expected_version:1,at:1,step:{type:'清洗',supplier:'乙廠'}});
  result=await h.call({action:'save_template',operation_id:op(203),source_job_id:id,name:'Y-A 固定流程',material_sku:'Y-A'});
  assert.equal(result.status,200);assert.equal(result.data.row.id,templateId);
  assert.equal(result.data.row.steps.length,2);
  assert.equal(h.templates.size,1);
  result=await h.call({action:'save_template',operation_id:op(203),source_job_id:id,name:'Y-A 固定流程',material_sku:'Y-A'});
  assert.equal(result.data.existing,true);
  result=await h.call({action:'save_template',operation_id:op(204),source_job_id:id,name:'錯誤料號',material_sku:'Y-UNKNOWN'});
  assert.equal(result.status,400);
});

test('whole-process due date is required while stage targets and actual starts stay separate',async()=>{
  const h=harness(),id=op(210);
  let result=await h.call({action:'create',operation_id:id,title:'加工追蹤',due_date:'',steps:[{type:'沖壓',supplier:'甲廠'}]});
  assert.equal(result.status,400);assert.equal(h.jobs.has(id),false);
  result=await h.call({action:'create',operation_id:id,title:'加工追蹤',due_at:'2026-99-99T18:00:00+08:00',steps:[{type:'沖壓',supplier:'甲廠'}]});
  assert.equal(result.status,400);assert.equal(h.jobs.has(id),false);
  result=await h.call({action:'create',operation_id:id,title:'加工追蹤',due_at:'2026-10-12T18:00:00+08:00',steps:[{type:'沖壓',supplier:'甲廠',due_at:'2026-10-05T10:00:00+08:00'},{type:'清洗',supplier:'乙廠',due_at:'2026-10-08T17:00:00+08:00'}]});
  assert.equal(result.status,200);
  assert.equal(result.data.row.due_at,'2026-10-12T10:00:00.000Z');
  assert.equal(result.data.row.due_date,'2026-10-12');
  assert.equal(result.data.row.steps[0].due_at,'2026-10-05T02:00:00.000Z');
  assert.equal(result.data.row.steps[0].started_at,result.data.row.events[0].recorded_at);
  assert.equal(result.data.row.steps[1].started_at,undefined);
  result=await h.call({action:'set_step_due',operation_id:op(211),job_id:id,expected_version:1,at:1,due_at:'2026-10-09T18:00:00+08:00'});
  assert.equal(result.status,200);assert.equal(result.data.row.steps[1].due_at,'2026-10-09T10:00:00.000Z');
  result=await h.call({action:'advance',operation_id:op(212),job_id:id,expected_version:2});
  assert.equal(result.status,200);
  assert.ok(result.data.row.steps[0].completed_at);
  assert.equal(result.data.row.steps[1].started_at,result.data.row.steps[0].completed_at);
  result=await h.call({action:'set_step_due',operation_id:op(213),job_id:id,expected_version:3,at:0,due_at:null});
  assert.equal(result.status,400);
  result=await h.call({action:'complete',operation_id:op(214),job_id:id,expected_version:3});
  assert.ok(result.data.row.steps[1].completed_at);
  result=await h.call({action:'set_step_due',operation_id:op(215),job_id:id,expected_version:4,at:1,due_at:null});
  assert.equal(result.status,400);
});

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
  result=await h.call({action:'edit',operation_id:op(83),job_id:id,expected_version:3,title:'再更正',quantity:100,due_date:'2026-10-10',step:{type:'攻牙',supplier:'丁廠'}});
  assert.equal(result.status,200);assert.equal(result.data.row.steps[0].supplier,'丙廠');
  assert.equal(result.data.row.steps[1].supplier,'丁廠');
});

test('mistaken work can be removed and restored without deleting its history or touching stock',async()=>{
  const h=harness(),id=op(90);
  await h.call({action:'create',operation_id:id,title:'錯建工作',steps:[{type:'噴砂',supplier:'甲廠'}]});
  let result=await h.call({action:'archive',operation_id:op(91),job_id:id,expected_version:1,reason:'建立錯誤'});
  assert.equal(result.status,200);assert.ok(result.data.row.archived_at);
  assert.equal(result.data.row.archived_reason,'建立錯誤');
  assert.equal(result.data.row.events.length,2);
  result=await h.call({action:'edit',operation_id:op(92),job_id:id,expected_version:2,title:'不應修改',step:{type:'清洗',supplier:'甲廠'}});
  assert.equal(result.status,400);
  result=await h.call({action:'restore',operation_id:op(93),job_id:id,expected_version:2});
  assert.equal(result.status,200);assert.equal(result.data.row.archived_at,null);
  assert.equal(result.data.row.events.length,3);
  assert.equal(h.inventoryWrites.length,0);
});

test('linked inbound work cannot be removed from the supply list',async()=>{
  const h=harness(),id=op(94);
  await h.call({action:'create',operation_id:id,title:'已入料',steps:[{type:'電鍍',supplier:'甲廠'}]});
  await h.call({action:'complete',operation_id:op(95),job_id:id,expected_version:1});
  const prepared=await h.call({action:'prepare_inbound',operation_id:op(96),job_id:id,expected_version:2});
  h.receipts.set(op(97),{id:op(97),inbound_number:prepared.data.row.inbound_number});
  await h.call({action:'link_inbound',operation_id:op(98),job_id:id,expected_version:3,inbound_receipt_id:op(97)});
  const result=await h.call({action:'archive',operation_id:op(99),job_id:id,expected_version:4,reason:'誤建'});
  assert.equal(result.status,400);assert.equal(h.jobs.get(id).archived_at,undefined);
});

test('closed work allows a documented metadata correction but locks finished steps',async()=>{
  const h=harness(),id=op(100);
  await h.call({action:'create',operation_id:id,title:'舊名稱',steps:[{type:'電鍍',supplier:'甲廠'}]});
  await h.call({action:'complete',operation_id:op(101),job_id:id,expected_version:1});
  await h.call({action:'close',operation_id:op(102),job_id:id,expected_version:2});
  let result=await h.call({action:'edit',operation_id:op(103),job_id:id,expected_version:3,title:'更正名稱',quantity:12,unit:'件',due_date:'2026-10-10',notes:'名稱筆誤'});
  assert.equal(result.status,200);assert.equal(result.data.row.title,'更正名稱');
  assert.equal(result.data.row.steps[0].type,'電鍍');
  result=await h.call({action:'edit',operation_id:op(104),job_id:id,expected_version:4,title:'不可改工項',step:{type:'噴砂',supplier:'乙廠'}});
  assert.equal(result.status,400);assert.equal(h.jobs.get(id).steps[0].type,'電鍍');
});

test('worker role matrix restricts supply writes to operations roles',()=>{
  assert.match(source,/\'\/api\/supply\/write\': \['vic', 'manager', 'purchase', 'warehouse'\]/);
  assert.doesNotMatch(source,/\'\/api\/supply\/write\': \[[^\]]*'ai'/);
});

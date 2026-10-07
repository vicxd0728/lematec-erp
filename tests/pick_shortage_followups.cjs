const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function pickShortageMaterialMatch(');
const end=html.indexOf('function openPickModal(',start);
assert(start>=0&&end>start);
const source=html.slice(start,end);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

function context(extra={}){
  const host={innerHTML:'',isConnected:true};
  const ctx=vm.createContext({
    inbounds:[],orders:[],mats:[],boms:[],_bomDataReady:true,ROLE:'warehouse',ROLES:{warehouse:{tabs:['orders','inbound']},sales:{tabs:['orders']}},
    window:{_inboundDataSource:'supabase'},
    document:{getElementById:id=>id==='pickShortageFollowups'?host:id==='modalBg'?{classList:{contains:()=>true}}:null},
    canonicalPageId:value=>String(value||'').replace(/-/g,'').toLowerCase(),
    normalizeSku:value=>String(value||'').toUpperCase().replace(/\s/g,''),
    isSupabaseShadowId:value=>String(value||'').startsWith('supabase:'),
    isSfgProductionOrder:o=>o.orderType==='sfg',escapeHtml,
    loadInbounds:async()=>{},isFresh:()=>true,closeModal:()=>{},switchTab:()=>{},
    dashboardCanCreateOrder:()=>false,dashboardCanCreateInbound:()=>false,
    inboundListFilters:()=>({}),getOrderFilters:()=>({}),setOrderSearchDraft:()=>{},
    console,...extra,
  });
  vm.runInContext(source,ctx);
  return {ctx,host};
}

test('shortage follow-up matches exact material ID and excludes unrelated or closed work',()=>{
  const {ctx}=context({
    inbounds:[
      {matId:'aaa',matCode:'Y-1',no:'IN-1',stStatus:'待入庫',qcStatus:'待品檢'},
      {matId:'bbb',matCode:'Y-1',no:'IN-2',stStatus:'待入庫',qcStatus:'待品檢'},
      {matId:'aaa',matCode:'Y-1',no:'IN-3',stStatus:'已入庫',qcStatus:'通過'},
      {matId:'aaa',matCode:'Y-1',no:'IN-4',stStatus:'退回倉管',qcStatus:'品檢不合格'},
    ],
    orders:[
      {id:'assembly-1',orderType:'sfg',productId:'aaa',matCode:'Y-1',status:'生產中'},
      {id:'assembly-2',orderType:'sfg',productId:'aaa',matCode:'Y-1',status:'已完成'},
      {id:'assembly-3',orderType:'sfg',productId:'bbb',matCode:'Y-1',status:'生產中'},
    ],
  });
  const item={id:'aaa',code:'Y-1'};
  assert.deepEqual(Array.from(ctx.pickShortageActiveInbound(item),row=>row.no),['IN-1']);
  assert.deepEqual(Array.from(ctx.pickShortageActiveAssemblies(item,'current'),row=>row.id),['assembly-1']);
});

test('follow-up shows pending evidence without promising stock and labels fallback source',async()=>{
  const {ctx,host}=context({
    inbounds:[{matId:'aaa',matCode:'Y-1',no:'IN-1',stStatus:'待入庫',qcStatus:'待品檢',qty:2}],
    window:{_inboundDataSource:'notion-fallback'},
  });
  await ctx.loadPickShortageFollowups('current',[{id:'aaa',code:'Y-1',stock:0,needed:3}]);
  assert.match(host.innerHTML,/Notion 備援紀錄/);
  assert.match(host.innerHTML,/缺 3/);
  assert.match(host.innerHTML,/IN-1/);
  assert.match(host.innerHTML,/尚未保留給本訂單/);
});

test('failed inbound read never says there is no pending receipt',async()=>{
  const {ctx,host}=context({loadInbounds:async()=>{throw Error('offline');}});
  await ctx.loadPickShortageFollowups('current',[{id:'aaa',code:'Y-1',stock:0,needed:1}]);
  assert.match(host.innerHTML,/無法確認是否已有補料紀錄/);
  assert.doesNotMatch(host.innerHTML,/未找到進行中的入料單/);
});

test('inbound shortcut is hidden from roles without that tab',async()=>{
  const {ctx,host}=context({
    ROLE:'sales',
    inbounds:[{matId:'aaa',matCode:'Y-1',no:'IN-1',stStatus:'待入庫',qcStatus:'待品檢',qty:2}],
  });
  await ctx.loadPickShortageFollowups('current',[{id:'aaa',code:'Y-1',stock:0,needed:3}]);
  assert.match(host.innerHTML,/IN-1/);
  assert.doesNotMatch(host.innerHTML,/查看入料/);
});

test('assembly shortcut opens the existing form with exact shortage and source order',()=>{
  const calls=[];
  const material={id:'half',code:'F-ABC',type:'半成品',stock:60,needed:100};
  const order={id:'source-order',no:'ORD-123',orderType:'overseas'};
  const {ctx}=context({
    orders:[order],mats:[material,{id:'part',code:'Y-ABC',type:'零件'}],boms:[{parentId:'half',childId:'part',qty:1}],
    dashboardCanCreateOrder:()=>true,
    resolveOrderPickPlan:()=>({items:[material]}),
    openModal:(...args)=>calls.push(args),showToast:()=>{},
  });
  ctx.openPickShortageNewAssembly('source-order','half');
  assert.equal(calls.length,1);
  assert.equal(calls[0][0],'newOrder');
  assert.equal(calls[0][1].tab,'sfg');
  assert.equal(calls[0][1].shortageSource.suggestedQty,40);
  assert.equal(calls[0][1].shortageSource.orderId,'source-order');
});

test('assembly shortcut refuses an existing active same-material assembly',()=>{
  const calls=[];
  const material={id:'half',code:'F-ABC',type:'半成品',stock:60,needed:100};
  const {ctx}=context({
    orders:[{id:'source-order',no:'ORD-123'},{id:'other',orderType:'sfg',productId:'half',status:'生產中'}],
    mats:[material,{id:'part',code:'Y-ABC',type:'零件'}],boms:[{parentId:'half',childId:'part',qty:1}],
    dashboardCanCreateOrder:()=>true,resolveOrderPickPlan:()=>({items:[material]}),
    openModal:(...args)=>calls.push(args),showToast:()=>{},
  });
  ctx.openPickShortageNewAssembly('source-order','half');
  assert.equal(calls.length,0);
});

test('inbound shortcut refuses fallback data and never submits a receipt',()=>{
  const calls=[];
  const material={id:'part',code:'Y-ABC',type:'零件',stock:0,needed:5};
  const {ctx}=context({
    orders:[{id:'source-order',no:'ORD-123'}],mats:[material],
    window:{_inboundDataSource:'notion-fallback'},dashboardCanCreateInbound:()=>true,
    resolveOrderPickPlan:()=>({items:[material]}),openModal:(...args)=>calls.push(args),showToast:()=>{},
  });
  ctx.openPickShortageNewInbound('source-order','part');
  assert.equal(calls.length,0);
});

test('inbound shortcut opens a draft with SKU, source, and blank actual quantity',()=>{
  const fields={ib_search:{value:''},'ib_qty_part':{value:'1',focus(){this.focused=true;}},ib_note:{value:''}};
  const calls=[];
  const material={id:'part',code:'Y-ABC',type:'零件',stock:0,needed:5};
  const {ctx}=context({
    orders:[{id:'source-order',no:'ORD-123'}],mats:[material],
    dashboardCanCreateInbound:()=>true,resolveOrderPickPlan:()=>({items:[material]}),
    document:{getElementById:id=>fields[id]||null},
    openModal:(...args)=>calls.push(args),filterInboundList:code=>calls.push(['filter',code]),showToast:()=>{},
  });
  ctx.openPickShortageNewInbound('source-order','part');
  assert.equal(calls[0][0],'newInbound');
  assert.equal(fields.ib_search.value,'Y-ABC');
  assert.equal(fields['ib_qty_part'].value,'');
  assert.equal(fields['ib_qty_part'].focused,true);
  assert.match(fields.ib_note.value,/ORD-123 \[source-order\]/);
  assert.equal(calls.some(call=>call[0]==='submitBatchInbound'),false);
});

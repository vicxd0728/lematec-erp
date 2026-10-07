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
    inbounds:[],orders:[],ROLE:'warehouse',ROLES:{warehouse:{tabs:['orders','inbound']},sales:{tabs:['orders']}},
    window:{_inboundDataSource:'supabase'},
    document:{getElementById:id=>id==='pickShortageFollowups'?host:id==='modalBg'?{classList:{contains:()=>true}}:null},
    canonicalPageId:value=>String(value||'').replace(/-/g,'').toLowerCase(),
    normalizeSku:value=>String(value||'').toUpperCase().replace(/\s/g,''),
    isSupabaseShadowId:value=>String(value||'').startsWith('supabase:'),
    isSfgProductionOrder:o=>o.orderType==='sfg',escapeHtml,
    loadInbounds:async()=>{},closeModal:()=>{},switchTab:()=>{},
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

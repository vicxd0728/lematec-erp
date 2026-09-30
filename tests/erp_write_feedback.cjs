const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function section(start,end){
  const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
  assert(a>=0&&b>a,`missing ${start}`);
  return html.slice(a,b);
}
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

test('three Notion rate-limit responses do not become a successful update',async()=>{
  let calls=0;
  const ctx=vm.createContext({
    notionAPI:async()=>{calls++;return {object:'error',status:429,message:'忙碌'};},
    setTimeout:callback=>callback(),
  });
  vm.runInContext(section('function assertNotionPage(','const _dbNumberPropEnsured='),ctx);
  await assert.rejects(ctx.updatePage('id',{'狀態':{select:{name:'已完成'}}}),/忙碌/);
  assert.equal(calls,3);
});

test('Notion create and archive errors reject instead of reporting success',async()=>{
  const ctx=vm.createContext({
    DB:{materials:'materials',announce:'announce'},
    notionAPI:async()=>({object:'error',status:500,message:'服務失敗'}),
  });
  vm.runInContext(section('async function createPage(','async function updatePage(')+section('const archivePage=','const getBlockChildren='),ctx);
  await assert.rejects(ctx.createPage('announce',{}),/服務失敗/);
  await assert.rejects(vm.runInContext("archivePage('id')",ctx),/服務失敗/);
});

test('failed order status write leaves the local order unchanged',async()=>{
  const row={id:'id',no:'O-1',status:'待排程'};
  let renders=0;
  const ctx=vm.createContext({
    orders:[row],picks:[],CURRENT_TAB:'orders',ROLE:'sales',
    denyViewOnlyAction:()=>false,isSfgProductionOrder:()=>false,isShopeeProductionOrder:()=>false,
    canMoveOrderStatus:()=>({ok:true}),closeModal:()=>{},renderTab:()=>renders++,
    showToast:()=>{},updatePage:async()=>{throw new Error('Notion 離線');},
  });
  vm.runInContext(section('async function doUpdateStatus(','function openShipOrderModal('),ctx);
  await ctx.doUpdateStatus('id','已完成');
  assert.equal(row.status,'待排程');
  assert.equal(renders,0);
});

test('schedule editing preserves its status and blocks reversed dates',async()=>{
  const fields={sc_name:'維修',sc_start:'2026-10-01',sc_end:'2026-10-03',sc_note:'保持原狀態'};
  let saved=null,closed=0;
  const toasts=[];
  const ctx=vm.createContext({
    document:{getElementById:id=>({value:fields[id]})},DB:{schedule:'schedule'},
    showToast:message=>toasts.push(message),closeModal:()=>closed++,
    updatePage:async(_id,props)=>{saved=props;return {object:'page'};},
    createPage:async()=>{},loadSchedule:async()=>{},renderTab:()=>{},
  });
  vm.runInContext(section('async function saveSchedule(','function openModal('),ctx);
  await ctx.saveSchedule('existing');
  assert.equal(saved['狀態'],undefined);
  assert.equal(closed,1);
  fields.sc_end='2026-09-30';saved=null;
  await ctx.saveSchedule('existing');
  assert.equal(saved,null);
  assert(toasts.some(message=>message.includes('不能早於')));
});

test('announcement write failure keeps input open; refresh failure is labeled after acceptance',async()=>{
  const fields={ann_title:{value:'重要公告'},ann_body:{value:'內容'},ann_date:{value:'2026-10-01'},ann_status:{value:'已發佈'},ann_order:{value:'1'},ann_pin:{checked:false}};
  let closed=0,shouldFail=true;
  const toasts=[];
  const ctx=vm.createContext({
    document:{getElementById:id=>fields[id]},DB:{announce:'announce'},
    showToast:message=>toasts.push(message),closeModal:()=>closed++,
    createPage:async()=>{if(shouldFail)throw new Error('寫入失敗');return {object:'page'};},
    updatePage:async()=>{},refreshAffectedData:async()=>{throw new Error('清單暫時離線');},
  });
  vm.runInContext(section('async function saveAnnounce(','async function deleteAnnounce('),ctx);
  await ctx.saveAnnounce('');
  assert.equal(closed,0);
  assert(toasts.some(message=>message.includes('寫入失敗')));
  shouldFail=false;
  await ctx.saveAnnounce('');
  assert.equal(closed,1);
  assert(toasts.some(message=>message.includes('已儲存，但清單更新失敗')));
});

test('announcement content remains text and edit controls do not embed record JSON',()=>{
  const ctx=vm.createContext({
    announces:[{id:'id',title:'<img src=x>',content:'</textarea><script>x</script>',status:'發佈',date:'2026-10-01'}],
    isViewOnly:()=>false,isAdminRole:()=>true,escapeHtml,
  });
  vm.runInContext(section('function renderAnnounce(){','function fmtDateTime('),ctx);
  const markup=ctx.renderAnnounce();
  assert.match(markup,/&lt;script&gt;/);
  assert.doesNotMatch(markup,/<script>/);
  assert.match(markup,/data-id="id"/);
  assert.doesNotMatch(markup,/openModal\('newAnnounce',\{/);
});

test('edit forms restore announcement content and schedule dates',()=>{
  const modal={innerHTML:''};
  const ctx=vm.createContext({
    document:{getElementById:()=>modal},isViewOnly:()=>false,
    openSharedModal:()=>{},escapeHtml,
  });
  vm.runInContext(section('function openModal(type,data){','const NOTION_MAX_RETRIES='),ctx);
  ctx.openModal('newAnnounce',{id:'id',title:'公告',content:'保留內容</textarea>',date:'2026-10-01'});
  assert.match(modal.innerHTML,/保留內容&lt;\/textarea&gt;/);
  assert.match(modal.innerHTML,/value="2026-10-01"/);
  assert.match(modal.innerHTML,/<option selected>已發佈<\/option>/);
  ctx.openModal('newAnnounce',{id:'id',title:'公告',status:'已發佈'});
  assert.match(modal.innerHTML,/<option selected>已發佈<\/option>/);
  ctx.openModal('newAnnounce',{id:'id',title:'公告',status:'發佈'});
  assert.match(modal.innerHTML,/<option selected>已發佈<\/option>/);
  ctx.openModal('editSchedule',{id:'id',name:'維修',startDate:'2026-10-02',endDate:'2026-10-03'});
  assert.match(modal.innerHTML,/id="sc_start" value="2026-10-02"/);
  assert.match(modal.innerHTML,/id="sc_end" value="2026-10-03"/);
});

test('shipment completion rejects orders that are not ready to ship',async()=>{
  let writes=0;
  const ctx=vm.createContext({
    orders:[{id:'id',status:'待排程'}],denyViewOnlyAction:()=>false,
    isSfgProductionOrder:()=>false,isShopeeProductionOrder:()=>false,
    canCompleteShipmentRole:()=>true,showToast:()=>{},
    updatePage:async()=>{writes++;},
  });
  vm.runInContext(section('async function submitShipOrder(','function openEditStock('),ctx);
  await ctx.submitShipOrder('id');
  assert.equal(writes,0);
  ctx.orders[0].status='待出貨';
  ctx.document={getElementById:()=>({value:''})};
  await ctx.submitShipOrder('id');
  assert.equal(writes,0);
});

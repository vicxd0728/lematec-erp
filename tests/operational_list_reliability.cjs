const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const worker=fs.readFileSync(path.join(__dirname,'../cloudflare-worker-green-wave-c22f-FULL-UPDATED.js'),'utf8');
function section(source,start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert(a>=0&&b>a,`missing section ${start}`);
  return source.slice(a,b);
}
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

test('external status labels stay text even for HTML or inherited object keys',()=>{
  const ctx=vm.createContext({PILL:{已完成:['#123','#fff']},escapeHtml});
  vm.runInContext(section(html,'function pill(t){','function renderTab(tab)'),ctx);
  assert.match(ctx.pill('<img src=x>'),/&lt;img src=x&gt;/);
  assert.doesNotMatch(ctx.pill('<img src=x>'),/<img/);
  assert.match(ctx.pill('constructor'),/>constructor<\/span>/);
});

test('picking API returns records beyond the Supabase 1000-row response cap',async()=>{
  const calls=[];
  const ctx=vm.createContext({
    URL,cleanText:value=>String(value||''),
    getSupabaseInventoryContext:async()=>({organization:{id:'org'}}),
    supabaseFetch:async(_env,url)=>{
      calls.push(url);
      if(url.includes('/pick_items?'))return [];
      const offset=Number(new URL(`https://local${url}`).searchParams.get('offset')||0);
      return Array.from({length:offset===0?1000:5},(_,i)=>({id:`p-${offset+i}`,pick_number:`P-${offset+i}`}));
    },
    respOK:(_cors,data)=>data,resp400:()=>({status:400}),resp500:(_cors,error)=>({error}),
    taipeiISOString:()=>'',normalizePickingItems:rows=>rows,
  });
  vm.runInContext(section(worker,'async function supabaseAll(','async function sha256Short(')+section(worker,'async function erpPickingList(','async function erpPickingCreate('),ctx);
  const result=await ctx.erpPickingList({url:'https://local/api/picking/list?limit=5000'}, {}, {});
  assert.equal(result.rows.length,1005);
  assert.equal(result.rows.at(-1).pick_number,'P-1004');
  assert.equal(calls.filter(url=>url.includes('/pick_lists?')).length,2);
});

test('stock-log 30 and 90 day filters use days and render only one page',()=>{
  const rows=Array.from({length:150},(_,i)=>({date:'2026-09-20',matName:'接頭',ref:`R-${i}`,qty:1,before:2,after:3,type:'領料'}));
  rows.push({date:'2026-07-20',matName:'舊單',ref:'JULY',qty:1,before:2,after:3,type:'領料'});
  const state={date:'30d',type:'all',view:'all',q:'',draft:'',page:1};
  const ctx=vm.createContext({
    window:{_STOCKLOG_FILTERS:state},document:{getElementById:()=>null},stockLogs:rows,
    stockLogLoadError:'',stockLogHasMore:false,FIRST_LOAD_DAYS:30,DATA_LOAD_MODE:{stocklog:'all'},DATA_LOAD_DAYS:{stocklog:0},
    pendingStockLogCounts:()=>({total:0,detail:0,notion:0}),getStockLogFilters:()=>state,
    applyDateFilterValue:null,taipeiDateKey:value=>new Date(value).toISOString().slice(0,10),
    stockLogIsInventoryMove:()=>true,stockLogDisplayType:row=>row.type,
    stockLogDisplayName:row=>row.matName,stockLogDisplaySubText:()=>'',stockLogQtyLabel:()=>'+1',
    buildStockLogAuditReport:()=>({}),renderStockLogAuditPanel:()=>'',limitedDataHint:()=>'',escapeHtml,
  });
  vm.runInContext(section(html,'function applyDateFilterValue(','function getOrderFilters(')+section(html,'function renderStockLog(){','async function retryStockLogSync('),ctx);
  let markup=ctx.renderStockLog();
  assert.match(markup,/符合 <b[^>]*>150<\/b> 筆 · 第 1\/2 頁/);
  assert.match(markup,/R-99/);
  assert.doesNotMatch(markup,/R-100/);
  assert.doesNotMatch(markup,/JULY/);
  state.date='90d';state.page=2;
  markup=ctx.renderStockLog();
  assert.match(markup,/151<\/b> 筆 · 第 2\/2 頁/);
  assert.match(markup,/JULY/);
});

test('picking date choice persists and long lists keep their total while paging',()=>{
  const rows=Array.from({length:150},(_,i)=>({id:`p-${i}`,no:`P-${i}`,product:i===0?'<img src=x>':'半成品',date:'2026-09-20',qty:1,orderId:'order',status:'待領料'}));
  rows.push({id:'old',no:'P-OLD',product:'舊單',date:'2026-07-20',qty:1,orderId:'order',status:'待領料'});
  const ctx=vm.createContext({
    window:{_PICK_DATE:'1',_PICK_SUB:'auto',_PICK_STATUS:'all'},document:{getElementById:()=>null},
    picks:rows,orders:[],ORDER_RETURN_REQUEST_STATUS:'待回料確認',
    applyDateFilterValue:null,taipeiDateKey:value=>new Date(value).toISOString().slice(0,10),
    applySort:(_name,data)=>data,canonicalPageId:value=>String(value||''),
    pickingVisualStage:()=> 'other',isPickingReturnRequest:()=>false,isPickingPicked:()=>false,
    isPickingReversed:()=>false,isPickingShortage:()=>false,
    buildPickingReversalRows:()=>[],canConfirmOrderReturnRequest:()=>false,
    renderPickingStatusVisual:()=>'',pickingStatusChip:()=>'',pickingStatusFilterLabel:()=> '全部',isViewOnly:()=>true,
    completedOrderPickingRows:()=>[],TH:()=>'<th>欄</th>',pill:value=>`<span>${escapeHtml(value)}</span>`,escapeHtml,
  });
  vm.runInContext(section(html,'function applyDateFilterValue(','function getOrderFilters(')+section(html,'function renderPicking(){','function isPickingReturnRequest('),ctx);
  let markup=ctx.renderPicking();
  assert.match(markup,/value="1" selected>近1個月/);
  assert.match(markup,/訂單領料主單 <span class="badge">150<\/span>/);
  assert.match(markup,/第 1\/2 頁/);
  assert.match(markup,/&lt;img src=x&gt;/);
  assert.doesNotMatch(markup,/P-100<\/td>/);
  assert.doesNotMatch(markup,/P-OLD<\/td>/);
  ctx.window._PICK_PAGE=2;
  markup=ctx.renderPicking();
  assert.match(markup,/P-100<\/td>/);
});

test('schedule save errors keep the edit open and never announce success',async()=>{
  const values={sch_name:'組立',sch_type:'生產',sch_pri:'一般',sch_start:'2026-10-01',sch_end:'2026-10-02',sch_person:'Vic',sch_order:'O-1',sch_note:'',sch_status:'待開始'};
  const toasts=[];let closed=0;
  const ctx=vm.createContext({
    document:{getElementById:id=>({value:values[id]})},DB:{schedule:'schedule'},
    notionAPI:async()=>({object:'error',message:'寫入失敗'}),
    showToast:(message)=>toasts.push(message),closeModal:()=>closed++,
    loadSchedule:async()=>{},renderTab:()=>{},
  });
  vm.runInContext(section(html,'function assertNotionPage(','async function updatePage(')+section(html,'async function submitSchedule(','function openEditSchedule('),ctx);
  await ctx.submitSchedule('');
  assert.equal(closed,0);
  assert(toasts.some(message=>message.includes('寫入失敗')));
  assert(!toasts.some(message=>message.includes('已建立')));
});

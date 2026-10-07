const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function section(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert(a>=0&&b>a,`${start} missing`);
 return html.slice(a,b);
}
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function resubmit(extra={}){
 const calls=[];
 const receipt={id:'local-1',supabaseId:'receipt-1',no:'IB-1',qty:1,matId:'page-a',note:'',qcStatus:'品檢不合格',stStatus:'退回倉管'};
 const fields={resub_mat:{value:'page-a'},resub_qty:{value:'0.5'},resub_reason:{value:'修正數量'},
  resub_submit:{disabled:false},resub_status:{style:{display:'none'},textContent:''},modalInner:{innerHTML:''}};
 const ctx=vm.createContext({window:{},inbounds:[receipt],mats:[{id:'page-a',code:'Y-A',name:'A',type:'零件'}],
  document:{getElementById:id=>fields[id]||null},escapeHtml,
  showToast:(...args)=>calls.push(['toast',...args]),closeModal:()=>calls.push(['close']),openModal:()=>{},
  pickingWorkerRequest:async(route,{body})=>{calls.push(['write',body.quantity]);return {row:{id:'receipt-1'}};},
  mapSupabaseInbound:row=>({supabaseId:row.id,no:'IB-1'}),
  updateInboundNotionMirror:async()=>({pending:false}),
  logUserAction:()=>{},ROLE:'warehouse',loadInbounds:async()=>{},renderTab:()=>{},console,...extra});
 vm.runInContext(section('const _resubmitInboundPending=new Set();','function renderAnnounce(){'),ctx);
 return {ctx,calls,fields};
}

test('resubmitting inbound preserves a valid fractional quantity',async()=>{
 const h=resubmit();
 await h.ctx.submitResubmitInbound('local-1');
 assert.deepEqual(h.calls.filter(x=>x[0]==='write').map(x=>x[1]),[0.5]);
 assert.equal(h.calls.filter(x=>x[0]==='close').length,1);
 assert.ok(h.calls.some(x=>x[0]==='toast'&&/已重新提交/.test(x[1])));
});

test('invalid inbound quantity is rejected before the Worker call',async()=>{
 for(const qty of ['', '0', '-1', 'bad']){
  const h=resubmit();h.fields.resub_qty.value=qty;
  await h.ctx.submitResubmitInbound('local-1');
  assert.equal(h.calls.filter(x=>x[0]==='write').length,0,`quantity ${qty}`);
  assert.equal(h.calls.filter(x=>x[0]==='close').length,0,`quantity ${qty}`);
 }
});

test('uncertain inbound resubmission keeps the form and blocks a duplicate click',async()=>{
 const h=resubmit({pickingWorkerRequest:async()=>{h.calls.push(['write']);throw Error('timeout');}});
 await h.ctx.submitResubmitInbound('local-1');
 await h.ctx.submitResubmitInbound('local-1');
 assert.equal(h.calls.filter(x=>x[0]==='write').length,1);
 assert.equal(h.calls.filter(x=>x[0]==='close').length,0);
 assert.equal(h.fields.resub_status.style.display,'block');
 assert.equal(h.fields.resub_submit.disabled,true);
});

test('accepted inbound with a failed list refresh reports acceptance separately',async()=>{
 const h=resubmit({loadInbounds:async()=>{throw Error('offline');}});
 await h.ctx.submitResubmitInbound('local-1');
 assert.equal(h.calls.filter(x=>x[0]==='write').length,1);
 assert.ok(h.calls.some(x=>x[0]==='toast'&&/已重新提交，但清單更新失敗/.test(x[1])));
 assert.equal(h.calls.filter(x=>x[0]==='close').length,1);
});

function corderEdit(extra={}){
 const calls=[];
 const order={id:'page-1',no:'SHPTW100',buyer:'buyer',shopeeNo:'SHOP-1',matCode:'S-A',qty:1,status:'出貨中'};
 const fields={eco_order_no:{value:order.no},eco_buyer:{value:order.buyer},eco_shopee_no:{value:order.shopeeNo},
  eco_tracking:{value:''},eco_mat:{value:order.matCode},eco_qty:{value:'1'},eco_status:{value:order.status},
  eco_ship:{value:''},eco_ship_date:{value:''},eco_note:{value:''},modalInner:{innerHTML:''}};
 const ctx=vm.createContext({window:{corders:[order]},document:{getElementById:id=>fields[id]||null},escapeHtml,
  showToast:(...args)=>calls.push(['toast',...args]),closeModal:()=>calls.push(['close']),openModal:()=>{},
  updatePage:async()=>{calls.push(['write']);return {id:'page-1'};},loadCorders:async()=>{},renderTab:()=>{},...extra});
 vm.runInContext(section('function openEditCorder(id){','async function deleteCorder('),ctx);
 return {ctx,calls,fields,order};
}

test('C-end edit rejects zero, blank and fractional quantities without saving',async()=>{
 for(const qty of ['', '0', '1.5', '-2']){
  const h=corderEdit();h.fields.eco_qty.value=qty;
  await h.ctx.saveEditCorder('page-1');
  assert.equal(h.calls.filter(x=>x[0]==='write').length,0,`quantity ${qty}`);
  assert.equal(h.calls.filter(x=>x[0]==='close').length,0,`quantity ${qty}`);
 }
});

test('C-end edit preserves form on uncertain save and separates an accepted refresh failure',async()=>{
 const uncertain=corderEdit({updatePage:async()=>{throw Error('timeout');}});
 await uncertain.ctx.saveEditCorder('page-1');
 assert.equal(uncertain.calls.filter(x=>x[0]==='close').length,0);
 assert.ok(uncertain.calls.some(x=>x[0]==='toast'&&/結果未確認/.test(x[1])));
 const accepted=corderEdit({loadCorders:async()=>{throw Error('offline');}});
 await accepted.ctx.saveEditCorder('page-1');
 assert.equal(accepted.calls.filter(x=>x[0]==='write').length,1);
 assert.equal(accepted.calls.filter(x=>x[0]==='close').length,1);
 assert.ok(accepted.calls.some(x=>x[0]==='toast'&&/已儲存，但清單更新失敗/.test(x[1])));
});

test('C-end edit escapes values from saved customer data',()=>{
 const h=corderEdit();h.order.buyer='A" onfocus="bad() & <x>';
 h.ctx.openEditCorder('page-1');
 assert.match(h.fields.modalInner.innerHTML,/A&amp;quot;|A&quot;/);
 assert.doesNotMatch(h.fields.modalInner.innerHTML,/onfocus="bad\(\)/);
 assert.match(h.fields.modalInner.innerHTML,/&lt;x&gt;/);
});

test('C-end edit presents stock-sensitive fields as read-only',()=>{
 const h=corderEdit();
 h.ctx.openEditCorder('page-1');
 const form=h.fields.modalInner.innerHTML;
 assert.match(form,/id="eco_mat"[^>]*readonly/);
 assert.match(form,/id="eco_qty"[^>]*readonly/);
 assert.match(form,/id="eco_status" disabled/);
 assert.match(form,/料號、數量和狀態已關聯出貨扣庫/);
});

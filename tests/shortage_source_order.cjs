const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('function shortageSourceOrderFromNote(');
const end=html.indexOf('function _renderOrdersList(',start);
assert(start>=0&&end>start);
const source=html.slice(start,end);
const id='12345678-1234-1234-1234-123456789abc';
const note=`缺料來源訂單：ORD-123 [${id}]；料號：F-ABC`;

function setup(role='sales'){
 const calls=[];
 const filters={q:'old',type:'sfg',status:'待排程',date:'month',hide:true,deadline:'late'};
 const ctx=vm.createContext({
  orders:[{id,no:'ORD-123'}],ROLE:role,ROLES:{sales:{tabs:['orders']},qc:{tabs:['qc']}},window:{},
  isNotionPageIdCandidate:value=>/^[0-9a-f-]{36}$/i.test(value),
  canonicalPageId:value=>String(value||'').replace(/-/g,'').toLowerCase(),
  escapeHtml:value=>String(value),getOrderFilters:()=>filters,
  setOrderSearchDraft:value=>calls.push(['search',value]),
  closeModal:()=>calls.push(['close']),switchTab:value=>calls.push(['tab',value]),showToast:()=>{},
 });
 vm.runInContext(source,ctx);
 return {ctx,calls,filters};
}

test('source link follows exact page identity and returns to a visible order row',()=>{
 const {ctx,calls,filters}=setup();
 assert.match(ctx.shortageSourceOrderLink(note),/來源 ORD-123/);
 assert.equal(ctx.shortageSourceOrderFromNote(`缺料來源訂單：ORD-123 [00000000-0000-0000-0000-000000000000]`),null);
 ctx.openShortageSourceOrder(id);
 assert.equal(filters.q,'ORD-123');
 assert.equal(filters.type,'all');
 assert.equal(filters.hide,false);
 assert.deepEqual(calls,[['search','ORD-123'],['close'],['tab','orders']]);
});

test('source navigation does not expose orders to a role without order access',()=>{
 const {ctx,calls}=setup('qc');
 assert.doesNotMatch(ctx.shortageSourceOrderLink(note),/<button/);
 ctx.openShortageSourceOrder(id);
 assert.equal(calls.length,0);
});

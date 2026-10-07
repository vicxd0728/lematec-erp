const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');

const source=fs.readFileSync(path.join(__dirname,'../erp-action-receipts.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function store(){
 const values=new Map();
 return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
}
function load(storage){
 const window={localStorage:storage,crypto:{randomUUID:()=>`op-${Math.random()}`}};
 vm.runInNewContext(source,{window,Date,Math,JSON,String,Array});
 return window.erpActionReceipts;
}

test('action reference survives a page reload without storing write payloads',()=>{
 const storage=store();
 const first=load(storage);
 const id=first.start('inbound_resubmit','IB-100','receipt-1','warehouse');
 first.mark(id,'uncertain');
 const rows=load(storage).list();
 assert.equal(rows.length,1);
 assert.equal(rows[0].reference,'IB-100');
 assert.equal(rows[0].state,'uncertain');
 assert.equal(rows[0].role,'warehouse');
 assert.equal(rows[0].targetId,'receipt-1');
 assert.equal(rows[0].payload,undefined);
});

test('invalid result cannot be presented as accepted and hiding is local only',()=>{
 const receipts=load(store());
 const id=receipts.start('corder_edit','SHPTW100','page-1','sales');
 assert.equal(receipts.mark(id,'success'),false);
 assert.equal(receipts.list()[0].state,'processing');
 receipts.dismiss(id);
 assert.equal(receipts.list().length,0);
});

test('dashboard only shows references for the current role and opens a formal list',()=>{
 const storage=store(),receipts=load(storage);
 receipts.start('inbound_resubmit','IB-1','receipt-1','warehouse');
 const salesId=receipts.start('order_create','ORD-1','mat-1','sales');
 const start=html.indexOf('function renderActionReceiptPanel(){');
 const end=html.indexOf('function switchTab(tab){',start);
 assert(start>=0&&end>start);
 const filter={q:'',type:'old',status:'old',date:'30',hide:true,deadline:'old'};
 const calls=[];
 const ctx=vm.createContext({window:{erpActionReceipts:receipts,_ORD_SUB:''},ROLE:'sales',ROLES:{sales:{tabs:['orders']}},
   CURRENT_TAB:'dashboard',document:{},getOrderFilters:()=>filter,setOrderSearchDraft:()=>{},switchTab:tab=>calls.push(tab),
   showToast:()=>{},escapeHtml:v=>String(v),renderTab:()=>{}});
 vm.runInContext(html.slice(start,end),ctx);
 const rendered=ctx.renderActionReceiptPanel();
 assert.match(rendered,/ORD-1/);
 assert.doesNotMatch(rendered,/IB-1/);
 ctx.openActionReceipt(salesId);
 assert.equal(filter.q,'ORD-1');
 assert.equal(filter.status,'all');
 assert.deepEqual(calls,['orders']);
});

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function section(start,end){
  const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
  assert(a>=0&&b>a,`${start} section missing`);
  return html.slice(a,b);
}

test('customer suggestions show partial matches, but linking requires one exact overseas code',()=>{
  const input={value:'2602',dataset:{}},box={innerHTML:'',textContent:''};
  const customers=[
    {id:'a',type:'overseas',code:'2602US028',name:'Alpha Tools',region:'US'},
    {id:'b',type:'overseas',code:'2602JP015',name:'Beta Works'},
    {id:'c',type:'domestic',code:'2602TW001',name:'Local'}
  ];
  const context=vm.createContext({customers,document:{getElementById:id=>id==='note_customer_code'?input:box},
    escapeHtml:value=>String(value),isFresh:()=>true});
  vm.runInContext(section('function noteFindOverseasCustomerByCode','async function noteChildPages'),context);
  context.renderNoteCustomerChoices();
  assert.match(box.innerHTML,/2602US028/);
  assert.match(box.innerHTML,/2602JP015/);
  assert.doesNotMatch(box.innerHTML,/2602TW001/);
  assert.equal(input.dataset.selectedCustomerId,'');
  assert.equal(context.noteFindOverseasCustomerByCode('2602'),null);
  context.selectNoteCustomer('a');
  assert.equal(input.value,'2602US028');
  assert.equal(input.dataset.selectedCustomerId,'a');
  assert.match(box.innerHTML,/已確認/);
  input.value='2602US029';context.renderNoteCustomerChoices();
  assert.equal(input.dataset.selectedCustomerId,'');
  assert.match(box.textContent,/找不到/);
});

test('customer page title uses note creation date, not planned event date',()=>{
  const context=vm.createContext({safeRt:(value)=>value,noteIsoDate:()=> '2026-09-30',
    taipeiDateKey:()=> '2026-09-30'});
  vm.runInContext(section('function noteEventDateTitle','async function ensureNoteDateChildPage'),context);
  const note={title:'客戶會議',date:'2026-10-12',createdAt:'2026-09-29T16:10:00.000Z'};
  assert.equal(context.noteEventDateTitle(note),'2026-09-30');
  assert.equal(context.noteEventPageTitle(note),'2026-09-30 · 客戶會議');
  assert.equal(context.noteEventPageTitle({...note,id:'79ab-123456'}),'2026-09-30 · 客戶會議 (123456)');
});

test('uploaded attachment is appended to customer event page and count kept on note record',async()=>{
  const writes=[];
  const context=vm.createContext({showToast:()=>{},uploadNotionFileViaProxy:async()=>({file_upload:{id:'uploaded-file'}}),
    noteAttachmentKind:()=> 'pdf',noteNotionAPI2026:async(method,url,body)=>{writes.push([method,url,body]);return {results:[{id:'block'}]};},
    countNoteAttachmentBlocks:async id=>id==='event'?1:0,
    updateNotePage:async(id,props)=>{writes.push(['update',id,props]);return {id};}});
  vm.runInContext(section('async function uploadNoteAttachments','function noteNotionPageUrl'),context);
  const result=await context.uploadNoteAttachments('event',[{name:'meeting.pdf',size:123}],{countPageId:'master'});
  assert.equal(result.uploaded.length,1);
  assert.equal(result.failed.length,0);
  assert.equal(writes[0][1],'blocks/event/children');
  assert.equal(writes[1][1],'master');
  assert.equal(writes[1][2]['附件數'].number,1);
});

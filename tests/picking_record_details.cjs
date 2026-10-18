const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const escapeHtml=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function setup(picks=[]){
  const start=html.indexOf('function pickingRecordDetails('),end=html.indexOf('function pickingSourceOrderLink(',start);
  assert(start>=0&&end>start,'read-only picking record detail renderer must exist');
  let opened=0;const modal={innerHTML:''};
  const ctx=vm.createContext({picks,mats:[{id:'material',code:'Y-CURRENT',name:'現名稱'}],window:{},escapeHtml,
    document:{getElementById:()=>modal},openSharedModal:()=>opened++,showToast:()=>{},canonicalPageId:v=>String(v||'').replaceAll('-','')});
  vm.runInContext(html.slice(start,end),ctx);return {ctx,modal,opened:()=>opened};
}
test('stored picking quantities remain historical and zero is not replaced by required quantity',()=>{
  const f=setup();const out=f.ctx.pickingRecordDetails({items:[{matId:'material',code:'Y-SNAPSHOT',qty:2.5,pickedQty:0,status:'缺料'}]});
  assert.match(out,/Y-SNAPSHOT/);assert.doesNotMatch(out,/Y-CURRENT/);
  assert.match(out,/需求記錄：2.5/);assert.match(out,/實領記錄：0/);assert.match(out,/不是目前庫存/);
  assert.doesNotMatch(out,/實領記錄：2.5|庫存不足：2.5/);
});
test('missing or malformed historical quantities remain unknown, and staff text is escaped',()=>{
  const f=setup();const out=f.ctx.pickingRecordDetails({items:[{code:'<script>',qty:null,pickedQty:'bad',note:'<img src=x>'}]});
  assert.match(out,/需求記錄：未記錄/);assert.match(out,/實領記錄：未記錄/);
  assert.match(out,/&lt;script&gt;/);assert.match(out,/&lt;img src=x&gt;/);assert.doesNotMatch(out,/<script>|<img/);
});
test('detail prioritizes stored shortage flags without recalculating from current BOM or stock',()=>{
  const f=setup();const out=f.ctx.pickingRecordDetails({items:[{code:'FIRST',qty:5,pickedQty:0,status:'足夠'},{code:'SHORT',qty:1,pickedQty:0,status:'缺料'}]});
  assert(out.indexOf('SHORT')<out.indexOf('FIRST'));assert.match(out,/原單標記缺料 1 項/);
  assert.doesNotMatch(out,/扣庫存|確認領料|onclick=/);
});
test('empty details are explicit and stale deleted records do not open a different record',()=>{
  const f=setup([{id:'pick-1',no:'PK-1',items:[]}]);
  assert.match(f.ctx.pickingRecordDetails({items:[]}),/未載入可查閱的子件明細/);
  f.ctx.openPickingRecordDetails('missing');assert.equal(f.opened(),0);
  f.ctx.openPickingRecordDetails('pick-1');assert.equal(f.opened(),1);assert.match(f.modal.innerHTML,/PK-1/);
});

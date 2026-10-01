const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const code = html.slice(html.indexOf('async function doEditStock('), html.indexOf('function openInventoryBatchAdjust('));

function setup({apply, refresh, logSaved=true}={}) {
  const notices=[];
  let closed=0;
  const values={newStock:'8',editStockReason:'實物盤點修正'};
  const mat={id:'material-1',name:'Y-TEST',stock:5};
  const ctx=vm.createContext({
    mats:[mat],ROLE:'warehouse',
    denyViewOnlyAction:()=>false,
    document:{getElementById:id=>({value:values[id],focus(){}})},
    showToast:(message,kind)=>notices.push({message,kind}),
    closeModal:()=>{closed++;},
    applyInventorySetAndMirror:apply||(async()=>({before:5,after:8,delta:3,mirrorPending:false})),
    _writeStockEditLog:async()=>logSaved,
    refreshAffectedData:refresh||(async()=>{}),
  });
  vm.runInContext(code,ctx);
  return {ctx,notices,mat,get closed(){return closed;},values};
}

test('confirmed stock write remains successful when refresh fails',async()=>{
  const s=setup({refresh:async()=>{throw new Error('offline');}});
  await s.ctx.doEditStock('material-1');
  assert.equal(s.closed,1);
  assert.equal(s.mat.stock,8);
  assert.match(s.notices.at(-1).message,/正式庫存已更新 5 → 8/);
  assert.match(s.notices.at(-1).message,/畫面重新讀取失敗/);
  assert.equal(s.notices.at(-1).kind,'warn');
});

test('mirror pending and edit-log failure are separate from accepted stock write',async()=>{
  const s=setup({apply:async()=>({before:5,after:8,delta:3,mirrorPending:true}),logSaved:false});
  await s.ctx.doEditStock('material-1');
  assert.match(s.notices.at(-1).message,/Notion 庫存鏡像待補同步/);
  assert.match(s.notices.at(-1).message,/修改記錄待核對/);
  assert.equal(s.notices.at(-1).kind,'warn');
});

test('failed formal write keeps entered reason and modal for correction',async()=>{
  const s=setup({apply:async()=>{throw new Error('rejected');}});
  await s.ctx.doEditStock('material-1');
  assert.equal(s.closed,0);
  assert.equal(s.values.editStockReason,'實物盤點修正');
  assert.equal(s.mat.stock,5);
  assert.match(s.notices.at(-1).message,/正式庫存未確認成功/);
});

test('fractional stock is rejected before any write',async()=>{
  let calls=0;
  const s=setup({apply:async()=>{calls++;}});
  s.values.newStock='8.5';
  await s.ctx.doEditStock('material-1');
  assert.equal(calls,0);
  assert.match(s.notices.at(-1).message,/0 以上整數/);
});

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const start = html.indexOf('function inboundListFilters()');
const end = html.indexOf('function openResubmitInbound(', start);
assert(start >= 0 && end > start);

function context(rows) {
  const ctx = vm.createContext({
    window: {}, inbounds: rows, mats: [],
    document: { getElementById: () => null },
    dashboardCanCreateInbound: () => false,
    applyDateFilterValue: (value, items) => value === '0' ? items : items.filter(item => item.date >= '2026-07-01'),
    applySort: (name, items) => items,
    shortageSourceOrderLink: () => '',
    escapeHtml: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    TH: () => '<th>欄</th>', pill: value => `<span>${value}</span>`,
  });
  require('./helpers/operational_read_context.cjs')(ctx,html);
  vm.runInContext(html.slice(start, end), ctx);
  return ctx;
}

test('inbound search matches number, SKU and supplier across loaded rows', () => {
  const rows = [
    { no: 'IN-001', matCode: 'Y-GAH-08', matName: '接頭', supplier: '甲廠', date: '2026-09-25', stStatus: '已入庫' },
    { no: 'IN-002', matCode: 'Y-FLT-07', supplier: '乙廠', date: '2026-09-26', stStatus: '退回' },
  ];
  const ctx = context(rows);
  for (const q of ['IN-001', 'y-gah-08', '甲廠']) {
    assert.equal(ctx.filterInboundRows(rows, { q, date: '0', status: 'all' }).length, 1);
  }
  assert.equal(ctx.filterInboundRows(rows, { q: '', date: '0', status: 'stocked' }).length, 1);
  assert.equal(ctx.filterInboundRows(rows, { q: '', date: '0', status: 'returned' }).length, 1);
});

test('inbound table paginates and escapes staff-entered text', () => {
  const rows = Array.from({ length: 1085 }, (_, index) => ({
    no: `IN-${index}`, matName: index === 0 ? '<img src=x>' : '接頭',
    supplier: '甲廠', date: '2026-09-25', qty: 1, qcStatus: '品檢通過', stStatus: '已入庫',
  }));
  const ctx = context(rows);
  const markup = ctx.renderInbound();
  assert.match(markup, /已載入 1085 筆 · 符合 1085 筆 · 第 1\/11 頁/);
  assert.match(markup, /&lt;img src=x&gt;/);
  assert.doesNotMatch(markup, /<img src=x>/);
  assert.match(markup, /IN-99/);
  assert.doesNotMatch(markup, /IN-100</);
});

test('inbound search finds the same master SKU and name that the row displays',()=>{
  const rows=[{no:'IN-LEGACY',matId:'mat',date:'2026-09-25'}];
  const ctx=context(rows);ctx.mats=[{id:'mat',code:'Y-GAH-08',name:'接頭主檔'}];
  assert.match(ctx.renderInbound(),/Y-GAH-08/);
  for(const q of ['y-gah-08','接頭主檔'])assert.equal(ctx.filterInboundRows(rows,{q,date:'0',status:'all'}).length,1);
});

test('cancelled inbound never appears in pending even with a residual pending status',()=>{
  const rows=[{qcStatus:'已取消',stStatus:'待入庫'},{qcStatus:'待品檢',stStatus:'已取消'},{qcStatus:'待品檢',stStatus:'待入庫'}];
  const ctx=context(rows);assert.equal(ctx.filterInboundRows(rows,{q:'',date:'0',status:'pending'}).length,1);
});
test('inbound multi-term search joins SKU and supplier and normalizes full-width input',()=>{
 const rows=[{no:'IN-1',matCode:'Y-GAH-08',supplier:'甲廠',date:'2026-09-25'},{no:'IN-2',matCode:'Y-GAH-08',supplier:'乙廠',date:'2026-09-25'}],ctx=context(rows);
 assert.equal(ctx.filterInboundRows(rows,{q:'Ｙ－ＧＡＨ－０８ 甲廠',date:'0',status:'all'})[0].no,'IN-1');
 assert.equal(ctx.filterInboundRows(rows,{q:'Y-GAH-08 未知廠',date:'0',status:'all'}).length,0);
});

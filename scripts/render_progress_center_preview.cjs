const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
const code = source.slice(source.indexOf('const SUPPLY_WORK_TYPES='), source.indexOf('let schedules = [];', source.indexOf('const SUPPLY_WORK_TYPES=')));
const sampleOrders = [
  { id: 'a', no: 'ORD-2609-101', orderType: '國外', customer: '客戶 A', product: 'Z-TEST-01', qty: 100, status: '生產中', deadline: '2026-10-01' },
  { id: 'b', no: 'ORD-2609-102', orderType: '國內', customer: '客戶 B', product: 'Y-TEST-02', qty: 40, status: '待檢驗', deadline: '2026-10-05' },
  { id: 'c', no: 'ORD-2609-103', orderType: '國外', customer: '客戶 C', product: 'F-TEST-03', qty: 60, status: '待出貨', deadline: '2026-10-08' },
  { id: 'd', no: 'ORD-2609-104', orderType: '國內', customer: '客戶 D', product: 'Z-TEST-04', qty: 20, status: '品檢異常', deadline: '' },
];
const context = vm.createContext({
  orders: sampleOrders,
  window: { _coreLoaded: true },
  Date,
  CURRENT_TAB: 'schedule',
  document: { getElementById: () => null },
  renderTab: () => {},
  renderSchedule: () => '<div>原生產排程預覽</div>',
  loadSchedule: async () => {},
  escapeHtml: value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
  pill: status => `<span class="pill">${status}</span>`,
  orderProductName: order => order.product,
  isShopeeProductionOrder: order => order.orderType === '蝦皮',
  isSfgProductionOrder: order => order.orderType === '半成品',
  isFresh: () => true,
  isViewOnly: () => false,
  isAdminRole: () => false,
  ROLE: 'purchase',
  todayStr: () => '2026-10-02',
  taipeiDateKey: () => '2026-10-09',
});
vm.runInContext(code, context);
const ordersHtml = context.renderProgressCenter();
vm.runInContext("progressCenterView='supply';supplyLoaded=true;supplyJobs=[{id:'job-a',title:'接頭外包加工',work_number:'SC-TEST-1',material_sku:'Y-TEST-02',quantity:40,unit:'件',related_order:'b',status:'加工中',due_at:'2026-10-04T09:00:00Z',updated_at:'2026-10-02T03:00:00Z',current_step:0,steps:[{type:'電鍍',supplier:'測試廠',started_at:'2026-10-01T01:00:00Z',due_at:'2026-10-03T09:00:00Z'}]}]", context);
const supplyHtml = context.renderProgressCenter();
const output = path.join(root, 'output', 'progress-center-preview.html');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}\n*,*::before,*::after{animation:none!important;transition:none!important}body{padding:20px;background:#08101a;color:#f3f6f8}main{max-width:1200px;margin:auto}.preview-section{margin-bottom:44px}.preview-title{font-size:22px;margin-bottom:14px}@media(max-width:600px){body{padding:12px}.preview-title{font-size:18px}}</style><main><section class="preview-section"><h1 class="preview-title">訂單進度 · 合成資料預覽</h1>${ordersHtml}</section><section class="preview-section"><h2 class="preview-title">供應鏈追蹤 · 合成資料預覽</h2>${supplyHtml}</section></main></html>`, 'utf8');
console.log(output);

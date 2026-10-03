const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
const start = html.indexOf('const SUPPLY_WORK_TYPES=');
const end = html.indexOf('let schedules = [];', start);
const ctx = vm.createContext({
  window: { _coreLoaded: true },
  orders: [
    { id: 'order-a', no: 'ORD-2610-001', orderType: '國外', customer: '海外客戶 A', productId: 'part', status: '生產中', deadline: '2026-10-12' },
    { id: 'order-b', no: 'ORD-2610-002', orderType: '國內', customer: '國內客戶 B', productId: 'part', status: '待排程', deadline: '2026-10-09' },
    { id: 'order-c', no: 'SFG-2610-003', orderType: '半成品', customer: '組立單', productId: 'assembly', status: '待排程', deadline: '2026-10-15' },
  ],
  mats: [{ id: 'part', code: 'Y-TEST-02' }, { id: 'assembly', code: 'F-TEST-03' }],
  boms: [{ parentId: 'assembly', childId: 'part', qty: 1 }],
  _bomDataReady: true,
  isShopeeProductionOrder: order => order.orderType === '蝦皮',
  isSfgProductionOrder: order => order.orderType === '半成品',
  isFresh: () => true,
  escapeHtml: value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]),
});
vm.runInContext(html.slice(start, end), ctx);
const chooser = ctx.supplyOrderChooser('Y-TEST-02', 'order-b');
const preview = '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
  styles + 'body{margin:0;padding:24px;background:#08101a;color:#f3f6f8}.card{max-width:640px;margin:24px auto;padding:24px;background:#111b27;border:1px solid #29415a;border-radius:14px}.card h2{margin:0 0 20px}.field-label{display:block;margin-bottom:6px}@media(max-width:600px){body{padding:10px}.card{margin:10px auto;padding:16px}}</style>' +
  '<div class="card"><h2>新增外包工作</h2><label class="field-label">工作名稱或既有料號</label><input class="inp" value="Y-TEST-02"><div style="margin-top:20px">' +
  chooser + '</div><div style="margin-top:20px"><button class="btn btn-blue">建立並送出第一站</button></div></div></html>';
const output = path.join(root, 'output', 'supply-order-preview.html');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, preview, 'utf8');
console.log(output);

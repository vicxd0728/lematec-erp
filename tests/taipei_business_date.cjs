const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const start = html.indexOf('function taipeiDateKey(');
const end = html.indexOf('function orderProductName(', start);
assert(start >= 0 && end > start, 'Taiwan business-date helpers exist');

const instant = '2026-09-25T16:30:00.000Z';
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...args) { super(...(args.length ? args : [instant])); }
  static now() { return RealDate.parse(instant); }
}
const ctx = vm.createContext({ Date: FixedDate, Intl });
vm.runInContext(html.slice(start, end), ctx);

test('date-only business fields use the Taiwan calendar day after UTC midnight', () => {
  assert.equal(ctx.todayStr(), '2026-09-26');
  assert.equal(ctx.taipeiDateKey(new RealDate(instant)), '2026-09-26');
});

test('month-based IDs use Taiwan month at the UTC month boundary', () => {
  const monthBoundary = new RealDate('2026-09-30T16:30:00.000Z');
  assert.equal(ctx.taipeiDateKey(monthBoundary).slice(0, 7), '2026-10');
});

test('invalid dates fail closed rather than producing a malformed business date', () => {
  assert.equal(ctx.taipeiDateKey('not-a-date'), '');
});

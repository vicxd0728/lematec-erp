const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const start = html.indexOf('async function loadWorkerStockLog(');
const end = html.indexOf('async function loadStockLog(', start);
assert(start >= 0 && end > start);

test('recent stock log reads every available page before reporting coverage', async () => {
  const offsets = [];
  const ctx = vm.createContext({
    FIRST_LOAD_DAYS: 30, PROXY: 'https://example.test', URLSearchParams,
    stockLogHasMore: false,
    mapSupabaseStockRows: rows => rows,
    fetch: async url => {
      const offset = Number(new URL(url).searchParams.get('offset'));
      offsets.push(offset);
      return { ok: true, text: async () => JSON.stringify({
        rows: [{ id: offset }], has_more: offset < 1000,
        next_offset: offset < 1000 ? offset + 500 : null,
      }) };
    },
  });
  vm.runInContext(html.slice(start, end), ctx);
  const rows = await ctx.loadWorkerStockLog('recent', 30);
  assert.equal(rows.length, 3);
  assert.deepEqual(offsets, [0, 500, 1000]);
  assert.equal(ctx.stockLogHasMore, false);
});

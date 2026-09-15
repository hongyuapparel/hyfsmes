const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// Read-only comparisons against the dedicated local performance fixtures.
test('生产列表同步统计、筛选、分页和导出', { skip: process.env.PRODUCTION_LIST_INTEGRATION !== '1' }, async (t) => {
  const env = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '../.env')));
  assert.equal(env.MYSQL_HOST, 'localhost');
  assert.match(env.MYSQL_DATABASE, /^erp_purchase_test_/);
  const base = 'http://127.0.0.1:3000';
  const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin_test', password: 'PurchaseTest7532!' }) });
  assert.equal(login.status, 201);
  const { access_token } = await login.json();
  async function get(route, query = {}) {
    const response = await fetch(base + route + '?' + new URLSearchParams(query), { headers: { Authorization: `Bearer ${access_token}` } });
    assert.equal(response.status, 200, route);
    return route.endsWith('/export') ? response.text() : response.json();
  }
  for (const module of ['purchase', 'pattern', 'cutting', 'sewing', 'finishing']) {
    await t.test(module, async () => {
      const route = `/production/${module}`;
      const query = { orderNo: 'PERF7532-' };
      const counts = await get(route + '/tab-counts', query);
      assert.ok(counts.all > 800, '需要接近线上规模的隔离性能数据');
      for (const tab of Object.keys(counts)) {
        const data = await get(route + '/items', { ...query, tab, page: 1, pageSize: 20 });
        assert.deepEqual(data.tabCounts, counts);
        assert.equal(data.total, counts[tab]);
        assert.equal(data.list.length, Math.min(20, data.total));
      }
      const first = await get(route + '/items', { ...query, page: 1, pageSize: 20, sortField: 'orderDate', sortOrder: 'desc' });
      const second = await get(route + '/items', { ...query, page: 2, pageSize: 20, sortField: 'orderDate', sortOrder: 'desc' });
      assert.deepEqual(second.tabCounts, first.tabCounts);
      const key = row => `${row.orderId}:${row.materialIndex ?? ''}`;
      assert.equal(second.list.some(row => first.list.some(previous => key(row) === key(previous))), false);
      for (const filter of [{ orderNo: 'PERF7532-000' }, { orderNo: 'PERF7532-MISSING' }, { ...query, completedStart: '2099-01-01' }]) {
        const filtered = await get(route + '/items', { ...filter, tab: 'all' });
        assert.deepEqual(filtered.tabCounts, await get(route + '/tab-counts', filter));
        assert.equal(filtered.total, filtered.tabCounts.all);
        const csv = await get(route + '/items/export', { ...filter, tab: 'all' });
        assert.equal(csv.trim().split(/\r?\n/).length, filtered.total + 1);
      }
      const cleared = await get(route + '/items', query);
      assert.deepEqual(cleared.tabCounts, counts);
    });
  }
});

const assert = require('node:assert/strict');
const test = require('node:test');
const { getAccessoryOutboundRecords } = require('../dist/inventory-accessories/inventory-accessories-outbound-query');
const { InventoryAccessoriesController } = require('../dist/inventory-accessories/inventory-accessories.controller');
function fixture(rows = []) {
  const calls = [];
  const qb = {};
  for (const method of ['leftJoin', 'select', 'andWhere', 'orderBy', 'addOrderBy', 'offset', 'limit']) qb[method] = (...args) => { calls.push([method, ...args]); return qb; };
  qb.getCount = async () => { calls.push(['count']); return 2; }; qb.getRawMany = async () => rows;
  return { calls, repo: { createQueryBuilder: () => qb } };
}
test('日期、订单、类型同时参与计数和分页，结束日含全天', async () => {
  const f = fixture(); const result = await getAccessoryOutboundRecords(f.repo, { startDate: '2026-09-01', endDate: '2026-09-07', orderNo: 'QA', outboundType: 'manual', page: 2, pageSize: 1 });
  const beforeCount = f.calls.slice(0, f.calls.findIndex(c => c[0] === 'count'));
  assert.ok(beforeCount.some(c => c[1] === 'r.created_at >= :outboundStart' && c[2].outboundStart === '2026-09-01 00:00:00'));
  assert.ok(beforeCount.some(c => c[1] === 'r.created_at < DATE_ADD(:outboundEnd, INTERVAL 1 DAY)' && c[2].outboundEnd === '2026-09-07 00:00:00'));
  assert.ok(beforeCount.some(c => c[2]?.orderNo === '%QA%'));
  assert.ok(beforeCount.some(c => c[2]?.outboundType === 'manual'));
  assert.ok(f.calls.some(c => c[0] === 'offset' && c[1] === 1)); assert.equal(result.total, 2);
});
test('未传日期不增加条件，旧调用兼容', async () => {
  const f = fixture(); await getAccessoryOutboundRecords(f.repo, {});
  assert.equal(f.calls.filter(c => c[0] === 'andWhere').length, 0);
});
test('拒绝无效或倒序日期', async () => {
  for (const params of [{ startDate: '2026-02-30' }, { endDate: 'bad' }, { startDate: '2026-09-08', endDate: '2026-09-07' }]) {
    await assert.rejects(getAccessoryOutboundRecords(fixture().repo, params), /日期/);
  }
});
test('controller 转发日期参数', () => {
  let params; const c = new InventoryAccessoriesController({ getOutboundRecords: p => { params = p; } });
  c.getOutbounds(undefined, 'QA', 'manual', '2026-09-01', '2026-09-07', '2', '5');
  assert.equal(params.startDate, '2026-09-01'); assert.equal(params.endDate, '2026-09-07'); assert.equal(params.page, 2);
});

test('手动及自动出库名称读取当前关联辅料，改名后查询更新，不改变数量', async () => {
  const rows = ['manual', 'order_auto'].map((outboundType, i) => ({ id: i + 1, accessoryId: 7, accessoryName: '原名称', outboundType, quantity: 2, beforeQuantity: 5, afterQuantity: 3 }));
  const f = fixture(rows);
  const before = await getAccessoryOutboundRecords(f.repo, {});
  assert.ok(f.calls.some(c => c[0] === 'select' && c[1].includes('a.name AS accessoryName')));
  assert.ok(f.calls.some(c => c[0] === 'leftJoin' && c[2] === 'a' && c[3] === 'a.id = r.accessory_id'));
  assert.deepEqual(before.list.map(r => r.accessoryName), ['原名称', '原名称']);
  rows.forEach(r => { r.accessoryName = '新名称'; });
  const after = await getAccessoryOutboundRecords(f.repo, {});
  assert.deepEqual(after.list, before.list.map(r => ({ ...r, accessoryName: '新名称' })));
});

test('关联辅料缺失时保留出库记录且不猜测名称', async () => {
  const result = await getAccessoryOutboundRecords(fixture([{ id: 1, accessoryId: 7, accessoryName: null, quantity: 2 }]).repo, {});
  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].accessoryName, null);
  assert.equal(result.list[0].quantity, 2);
});

const assert = require('node:assert/strict');
const test = require('node:test');
const { InventoryAccessoriesService } = require('../dist/inventory-accessories/inventory-accessories.service');
const { InventoryAccessoriesController } = require('../dist/inventory-accessories/inventory-accessories.controller');
const { InventoryAccessory } = require('../dist/entities/inventory-accessory.entity');
const { InventoryAccessoryOutbound } = require('../dist/entities/inventory-accessory-outbound.entity');

function fixture(sized = true, overrides = {}) {
  const stock = { id: 1, quantity: 8, isSized: sized, sizeHeaders: ['S', 'M'], sizeQuantities: [3, 5], ...overrides };
  const writes = [], locks = [];
  const qb = { setLock(v) { locks.push(v); return this; }, where() { return this; }, async getOne() { return structuredClone(stock); } };
  const manager = { getRepository(entity) { return entity === InventoryAccessory
    ? { createQueryBuilder: () => qb, save: async row => { writes.push('stock'); Object.assign(stock, row); return row; } }
    : { create: row => row, save: async row => { writes.push(entity === InventoryAccessoryOutbound ? 'outbound' : 'log'); return row; } }; } };
  const service = new InventoryAccessoriesService({ manager: { transaction: fn => fn(manager) } });
  return { stock, writes, locks, run: (quantity, detail, extra = {}) => service.outbound({ accessoryId: 1, quantity,
    sizeOutbound: detail, outboundType: 'manual', enforceAvailableStock: true, operatorUsername: 'QA', ...extra }) };
}
test('普通手动正常出库及全部出完，库存与日志同时保存', async () => {
  const f = fixture(false);
  await f.run(2); assert.equal(f.stock.quantity, 6);
  await f.run(6); assert.equal(f.stock.quantity, 0);
  assert.deepEqual(f.writes, ['stock', 'outbound', 'log', 'stock', 'outbound', 'log']);
  assert.deepEqual(f.locks, ['pessimistic_write', 'pessimistic_write']);
});
test('总量够但单码不足仍拒绝，不写库存和任何记录', async () => {
  const f = fixture(); await assert.rejects(f.run(4, { headers: ['S'], quantities: [4] }), /尺码 S 库存不足/);
  assert.equal(f.stock.quantity, 8); assert.deepEqual(f.writes, []);
});
test('普通超量及零库存拒绝', async () => {
  for (const quantity of [0, 8]) { const f = fixture(false, { quantity }); await assert.rejects(f.run(9), /当前库存/); assert.deepEqual(f.writes, []); }
});
test('分码按实际明细正常出库，全部出完允许归零', async () => {
  const f = fixture(); await f.run(8, { headers: ['S', 'M'], quantities: [3, 5] });
  assert.equal(f.stock.quantity, 0); assert.deepEqual(f.stock.sizeQuantities, [0, 0]);
});
test('其他尺码已有负数时，不扩大缺货且有总量可用的正常出库仍允许', async () => {
  const f = fixture(true, { quantity: 4, sizeQuantities: [-1, 5] });
  await f.run(2, { headers: ['S', 'M'], quantities: [0, 2] });
  assert.deepEqual(f.stock.sizeQuantities, [-1, 3]);
});
test('没有明细、重复同义尺码、未知尺码、负值、小数和合计不匹配不可绕过', async () => {
  for (const detail of [undefined, { headers: ['S', 's'], quantities: [1, 1] },
    { headers: ['XL'], quantities: [2] }, { headers: ['S', 'M'], quantities: [-1, 3] },
    { headers: ['S', 'M'], quantities: [0.5, 1.5] }, { headers: ['S'], quantities: [1] }]) {
    const f = fixture(); await assert.rejects(f.run(2, detail)); assert.deepEqual(f.writes, []);
  }
});
test('库存变动后再次提交按锁内最新库存校验，不按旧弹窗余量放行', async () => {
  const f = fixture(false); await f.run(6); await assert.rejects(f.run(6), /当前库存/); assert.equal(f.stock.quantity, 2);
});
test('订单自动扣料仍允许负数，缺少分码的旧采购调用原规则保留', async () => {
  for (const outboundType of ['order_auto', 'manual']) {
    const f = fixture(); const result = await f.run(10, undefined, { enforceAvailableStock: undefined, outboundType });
    assert.equal(f.stock.quantity, -2); assert.equal(result.record.quantity, 10); assert.ok(result.negatives.length);
  }
});
test('库存手动接口在服务端强制开启限制，领取人与备注链不改变', async () => {
  let saved;
  const controller = new InventoryAccessoriesController({ resolveOperatorLabel: async () => '管理员', outbound: async p => { saved = p; } });
  await controller.manualOutbound(1, 2, '领取人：Andy', undefined, { userId: 1, username: 'admin' });
  assert.equal(saved.enforceAvailableStock, true); assert.equal(saved.remark, '领取人：Andy'); assert.equal(saved.operatorUsername, '管理员');
});

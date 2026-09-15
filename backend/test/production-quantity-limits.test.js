require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { ProductionSewingService } = require('../dist/production-sewing/production-sewing.service');

function fixture() {
  const saved = [];
  const queries = [];
  const manager = {
    transaction: async fn => fn(manager),
    getRepository: entity => ({ create: row => row, save: async row => { saved.push({ entity: entity.name, row: structuredClone(row) }); return row; } }),
    query: async (sql, values) => { queries.push({ sql, values }); return []; },
  };
  const service = new ProductionSewingService(
    { findOne: async () => ({ id: 1, orderNo: 'TEST', status: 'pending_finishing' }) },
    { findOne: async () => ({ orderId: 1, status: 'completed', sewingQuantity: 100 }), manager },
    { findOne: async () => ({ actualCutRows: [{ colorName: 'red', quantities: [60, 40] }] }) },
    { findOne: async () => ({ colorSizeHeaders: ['S', 'M'], colorSizeRows: [{ colorName: 'red' }] }) },
    {}, {}, {}, {},
  );
  return { service, saved, queries };
}

test('车缝纠错允许超过裁床，保存实际明细、合计及操作记录', async () => {
  const f = fixture();
  const rows = [{ colorName: 'red', quantities: [65, 45] }];
  await f.service.editCompletedSewing(1, 110, 0, '', [65, 45], rows, { username: 'tester' });
  const saved = f.saved.find(entry => entry.entity === 'OrderSewing').row;
  assert.equal(saved.sewingQuantity, 110);
  assert.deepEqual(saved.sewingQuantityRow, [65, 45]);
  assert.deepEqual(saved.sewingQuantitiesByColor, rows);
  assert.deepEqual(JSON.parse(f.queries[0].values[0]), rows);
  assert.match(f.saved.find(entry => entry.entity === 'OrderOperationLog').row.detail, /100 → 110/);
});

test('车缝纠错仍拒绝零数量和错误颜色尺码结构', async () => {
  const f = fixture();
  await assert.rejects(f.service.editCompletedSewing(1, 0, 0, '', [0, 0], [{ colorName: 'red', quantities: [0, 0] }]), /必须大于 0/);
  await assert.rejects(f.service.editCompletedSewing(1, 110, 0, '', [110], [{ colorName: 'red', quantities: [110] }]));
  assert.equal(f.saved.length, 0);
});
const { ProductionFinishingMutationService } = require('../dist/production-finishing/production-finishing-mutation.service');

test('尾部纠错仍要求车缝登记存在，不因放开数量上限而放开工序前置检查', async () => {
  const service = new ProductionFinishingMutationService({}, {}, { findOne: async () => null },
    { findOne: async () => ({ colorSizeHeaders: [] }) }, { find: async () => [] }, {}, {}, {});
  await assert.rejects(service.amendPackagingComplete({ id: 1 }, { tailInboundQty: 0, defectQuantity: 0 },
    110, 110, 0), /未找到车缝登记/);
});

test('尾部纠错仍拒绝对账不符、负数及已完成仓库处理的订单', async () => {
  const service = new ProductionFinishingMutationService({}, {}, {}, {},
    { find: async () => [{ status: 'completed', quantity: 100 }] }, {}, {}, {});
  await assert.rejects(service.amendPackagingComplete({ id: 1 }, {}, 110, 100, 0), /须等于尾部收货数/);
  await assert.rejects(service.amendPackagingComplete({ id: 1 }, {}, 110, 111, -1), /不可为负数/);
  await assert.rejects(service.amendPackagingComplete({ id: 1 }, {}, 110, 110, 0), /已.*完成入库或发货/);
});

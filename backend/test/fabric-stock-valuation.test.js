const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calculateFabricAmount,
  calculateFabricInboundUnitPrice,
  calculateFabricWeightedUnitPrice,
  normalizeFabricUnitPrice,
} = require('../dist/fabric-stock/fabric-stock-valuation');

test('面料本批实际成本单价分摊其他费用', () => {
  assert.equal(calculateFabricInboundUnitPrice(10, 8, 20), '10.0000');
});

test('未填采购单价时拒绝单独填写其他费用', () => {
  assert.throws(() => calculateFabricInboundUnitPrice(10, null, 20), /不能填写其他费用/);
});

test('零成本与未计价保持不同语义', () => {
  assert.equal(normalizeFabricUnitPrice(0), '0.0000');
  assert.equal(normalizeFabricUnitPrice(null), null);
  assert.equal(calculateFabricAmount(12, 0), '0.00');
  assert.equal(calculateFabricAmount(12, null), null);
});

test('已计价批次按移动加权平均合并', () => {
  assert.equal(calculateFabricWeightedUnitPrice(10, 8, 30, 12), '11.0000');
});

test('任一批次未计价时合并库存整行保持未计价', () => {
  assert.equal(calculateFabricWeightedUnitPrice(10, 8, 30, null), null);
  assert.equal(calculateFabricWeightedUnitPrice(10, null, 30, 12), null);
});

test('库存为零后重新入库，不让旧的未计价状态污染新批次', () => {
  assert.equal(calculateFabricWeightedUnitPrice(0, null, 10, 12), '12.0000');
  assert.equal(calculateFabricWeightedUnitPrice(0, 8, 10, null), null);
});

const { FabricStockService } = require('../dist/fabric-stock/fabric-stock.service');
test('同名不同单位禁止合并，数量价格和日志均不改变', async () => {
  const existing = { id: 1, name: 'QA', unit: '米', quantity: '10', unitPrice: '8.0000' };
  let writes = 0;
  const service = new FabricStockService({ save: async () => { writes++; } });
  service.findByName = async () => existing;
  await assert.rejects(service.create({ name: 'QA', unit: '片', quantity: 2, unitPrice: 12 }), /单位不一致/);
  assert.equal(existing.quantity, '10');
  assert.equal(existing.unitPrice, '8.0000');
  assert.equal(writes, 0);
});
test('同单位入库仍按原规则合并并计算加权成本', async () => {
  const existing = { id: 1, name: 'QA', unit: '米', quantity: '10', unitPrice: '8.0000' };
  const logs = [];
  const service = new FabricStockService(
    { save: async row => row }, { create: row => row, save: async row => logs.push(row) },
    null, null, null, { decorate: async rows => rows },
  );
  service.findByName = async () => existing;
  const result = await service.create({ name: 'QA', unit: '米', quantity: 10, unitPrice: 12 });
  assert.equal(result.quantity, '20');
  assert.equal(result.unitPrice, '10.0000');
  assert.equal(logs[0].beforeSnapshot.quantity, '10');
  assert.equal(logs[0].afterSnapshot.quantity, '20');
});

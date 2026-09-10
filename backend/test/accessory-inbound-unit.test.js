const assert = require('node:assert/strict');
const test = require('node:test');
const { InventoryAccessoriesService } = require('../dist/inventory-accessories/inventory-accessories.service');
const { InventoryAccessory } = require('../dist/entities/inventory-accessory.entity');

function fixture(overrides = {}, newItem = false) {
  const stock = { id: 1, name: 'QA单位', unit: '个', quantity: 10, isSized: false, ...overrides };
  const writes = [], logs = [];
  const repo = { create: row => row, save: async row => { writes.push(structuredClone(row)); return row; } };
  const logRepo = {
    create: row => row, save: async row => { logs.push(row); return row; },
  };
  const qb = { setLock() { return this; }, where() { return this; }, orderBy() { return this; },
    getOne: async () => newItem ? null : stock };
  repo.createQueryBuilder = () => qb;
  repo.manager = { transaction: (_isolation, run) => run({ getRepository: entity => entity === InventoryAccessory ? repo : logRepo }) };
  const service = new InventoryAccessoriesService(repo, {}, logRepo, {});
  return { stock, writes, logs, run: dto => newItem
    ? service.create({ name: 'QA单位', quantity: 1, salesperson: 'Andy', ...dto })
    : service.restock(1, { quantity: 1, ...dto }) };
}

test('同名不同单位入库拒绝，库存和日志均不改变', async () => {
  for (const quantity of [0, 10, -2]) {
    const f = fixture({ quantity });
    const before = structuredClone(f.stock);
    await assert.rejects(f.run({ unit: '卷' }), error => error.getStatus() === 400
      && /库存：个，本次：卷/.test(error.message) && /核对单位/.test(error.message));
    assert.deepEqual(f.stock, before);
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.logs, []);
  }
});

test('分码辅料也在数量合并前拒绝不同单位', async () => {
  const f = fixture({ isSized: true, sizeHeaders: ['S', 'M'], sizeQuantities: [4, 6] });
  const before = structuredClone(f.stock);
  await assert.rejects(f.run({ unit: '卷', isSized: true, sizeHeaders: ['S', 'M'], sizeQuantities: [1, 2] }), /单位不一致/);
  assert.deepEqual(f.stock, before);
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.logs, []);
});

test('同单位及两端空白保持正常补货，日志有真实数量', async () => {
  const f = fixture({ unit: ' 个 ' });
  const row = await f.run({ unit: '个 ' });
  assert.equal(row.quantity, 11);
  assert.equal(f.writes.length, 1);
  assert.equal(f.logs.length, 1);
  assert.equal(f.logs[0].beforeSnapshot.quantity, 10);
  assert.equal(f.logs[0].afterSnapshot.quantity, 11);
});

test('同单位分码补货仍逐码累加', async () => {
  const f = fixture({ isSized: true, sizeHeaders: ['S', 'M'], sizeQuantities: [4, 6] });
  const row = await f.run({ unit: '个', isSized: true, sizeHeaders: ['S', 'M'], sizeQuantities: [1, 2] });
  assert.equal(row.quantity, 13);
  assert.deepEqual(row.sizeQuantities, [5, 8]);
  assert.equal(f.logs.length, 1);
});

test('旧调用未传单位沿用目标库存单位，不默认换成个', async () => {
  const f = fixture({ unit: '卷' });
  const row = await f.run({});
  assert.equal(row.unit, '卷');
  assert.equal(row.quantity, 11);
});

test('显式空单位与已知单位不能合并，未知旧单位不能被本次入库猜填', async () => {
  for (const [stored, incoming] of [['个', ''], ['个', '  '], ['', '卷']]) {
    const f = fixture({ unit: stored });
    await assert.rejects(f.run({ unit: incoming }), /单位不一致/);
    assert.equal(f.stock.quantity, 10);
    assert.equal(f.stock.unit, stored);
    assert.equal(f.writes.length, 0);
    assert.equal(f.logs.length, 0);
  }
});

test('不存在同名辅料时正常新建并保存填写单位', async () => {
  const f = fixture({}, true);
  const row = await f.run({ unit: '卷' });
  assert.equal(row.quantity, 1);
  assert.equal(row.unit, '卷');
  assert.equal(f.writes.length, 1);
  assert.equal(f.logs[0].action, 'create');
});

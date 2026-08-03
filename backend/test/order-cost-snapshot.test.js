require('reflect-metadata');

const assert = require('node:assert/strict');
const test = require('node:test');

const { OrderCostSnapshotService } = require('../dist/orders/order-cost-snapshot.service');
const { Order } = require('../dist/entities/order.entity');
const { OrderCostSnapshot } = require('../dist/entities/order-cost-snapshot.entity');
const { resolveOrderQuoteStatus } = require('../dist/orders/order-quote-status');

function createService(options = {}) {
  const order = Object.hasOwn(options, 'order')
    ? options.order
    : { id: 7, orderNo: 'HY-007', exFactoryPrice: '12.00' };
  const existingSnapshot = options.existingSnapshot ?? null;
  const savedOrders = [];
  const savedSnapshots = [];
  const orderRepo = {
    findOne: async () => order,
    save: async (row) => {
      savedOrders.push({ ...row });
      return row;
    },
  };
  const snapshotRepo = {
    findOne: async () => existingSnapshot,
    create: (row) => ({ ...row }),
    save: async (row) => {
      savedSnapshots.push({ ...row, snapshot: { ...row.snapshot } });
      return row;
    },
  };
  const manager = {
    getRepository(entity) {
      if (entity === Order) return orderRepo;
      if (entity === OrderCostSnapshot) return snapshotRepo;
      throw new Error(`unexpected repository: ${entity?.name}`);
    },
  };
  const dataSource = {
    transaction: async (callback) => callback(manager),
  };
  const addLog = options.addLog ?? (async () => undefined);
  const statusService = { addLog };
  const userRepo = { findOne: async () => ({ displayName: '报价员', username: 'quoter' }) };
  const service = new OrderCostSnapshotService(
    {},
    {},
    {},
    userRepo,
    statusService,
    dataSource,
  );
  return { service, manager, order, savedOrders, savedSnapshots, statusService };
}

test('保存未变化的已确认报价草稿时保留确认信息且无需重新确认', async () => {
  const previous = {
    snapshot: {
      materialRows: [{ unitPrice: 10, usagePerPiece: 1 }],
      quoteConfirmedAt: '2026-08-01T00:00:00.000Z',
      quoteConfirmedBy: '旧报价员',
      quoteConfirmedExFactoryPrice: '11.11',
      quoteNeedsReconfirm: false,
    },
  };
  const context = createService({ existingSnapshot: previous });

  const saved = await context.service.saveCostSnapshot(
    7,
    { snapshot: { materialRows: [{ usagePerPiece: 1, unitPrice: 10 }] } },
    { userId: 1, username: 'quoter' },
  );

  assert.equal(saved.snapshot.quoteConfirmedAt, previous.snapshot.quoteConfirmedAt);
  assert.equal(saved.snapshot.quoteConfirmedBy, '旧报价员');
  assert.equal(saved.snapshot.quoteNeedsReconfirm, false);
});

test('保存已修改的报价草稿时保留历史确认信息并标记需要重新确认', async () => {
  const previous = {
    snapshot: {
      materialRows: [{ unitPrice: 10, usagePerPiece: 1 }],
      quoteConfirmedAt: '2026-08-01T00:00:00.000Z',
      quoteConfirmedBy: '旧报价员',
      quoteConfirmedExFactoryPrice: '11.11',
      quoteNeedsReconfirm: false,
    },
  };
  const context = createService({ existingSnapshot: previous });

  const saved = await context.service.saveCostSnapshot(
    7,
    { snapshot: { materialRows: [{ unitPrice: 12, usagePerPiece: 1 }] } },
    { userId: 1, username: 'quoter' },
  );

  assert.equal(saved.snapshot.quoteConfirmedAt, previous.snapshot.quoteConfirmedAt);
  assert.equal(saved.snapshot.quoteNeedsReconfirm, true);
});

test('确认报价在同一事务内写入快照、订单卡片价格和操作日志', async () => {
  let logManager;
  const context = createService({
    addLog: async (_order, _actor, _action, _detail, manager) => {
      logManager = manager;
    },
  });
  const snapshot = {
    materialRows: [{ usagePerPiece: 1, unitPrice: 10 }],
    processItemRows: [{ quantity: 2, unitPrice: 5 }],
    productionRows: [{ quantity: 1, unitPrice: 3 }],
    productionCostMultiplier: 2,
    profitMargin: 0.1,
  };

  const saved = await context.service.confirmCostQuote(
    7,
    { snapshot },
    { userId: 1, username: 'quoter' },
  );

  assert.equal(saved.snapshot.quoteNeedsReconfirm, false);
  assert.equal(saved.snapshot.quoteConfirmedExFactoryPrice, '28.89');
  assert.equal(context.savedOrders[0].exFactoryPrice, '28.89');
  assert.equal(logManager, context.manager);
});

test('订单不存在时不创建孤立的成本快照', async () => {
  const context = createService({ order: null });

  await assert.rejects(
    () => context.service.confirmCostQuote(999, { snapshot: {} }, { userId: 1, username: 'quoter' }),
    /订单不存在/,
  );
  assert.equal(context.savedSnapshots.length, 0);
  assert.equal(context.savedOrders.length, 0);
});

test('旧订单确认后又保存草稿时在待报价列表标记为待重新确认', () => {
  assert.equal(resolveOrderQuoteStatus({}, { lastConfirmLogId: 10, lastDraftLogId: 11 }), 'needs_reconfirm');
  assert.equal(resolveOrderQuoteStatus({}, { lastConfirmLogId: 10, lastDraftLogId: 9 }), 'confirmed');
  assert.equal(resolveOrderQuoteStatus({}, { lastConfirmLogId: 0, lastDraftLogId: 11 }), 'unconfirmed');
});

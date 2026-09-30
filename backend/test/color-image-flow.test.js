const test = require('node:test');
const assert = require('node:assert/strict');
const { withColorImages, colorImageMap } = require('../dist/common/color-image.util');
const { parseStoredColorSizeSnapshot, subtractColorSizeSnapshots } = require('../dist/finished-goods-stock/finished-goods-stock-query.utils');
const { InventoryPendingService } = require('../dist/inventory-pending/inventory-pending.service');
const { FinishedGoodsStockInboundQueryService } = require('../dist/finished-goods-stock/finished-goods-stock-inbound-query.service');
const { FinishedGoodsStockInboundService } = require('../dist/finished-goods-stock/finished-goods-stock-inbound.service');
const { FinishedGoodsStockReportService } = require('../dist/finished-goods-stock/finished-goods-stock-report.service');
const { applyPendingOutboundSizeDeduction } = require('../dist/inventory-pending/inventory-pending-outbound.helpers');
const { buildFinishedStockExportLines } = require('../dist/finished-goods-stock/finished-goods-stock-export.service');
const actual = { headers: ['S', 'M'], rows: [
  { colorName: '蓝色', quantities: [2, 3] }, { colorName: '红色', quantities: [4, 1] },
] };
const pictures = [{ colorName: '红色', imageUrl: '/red.png', quantities: [100, 100] },
  { colorName: '蓝色', imageUrl: '/blue.png', quantities: [100, 100] }];

test('图片按颜色匹配，顺序不同也不串色，不使用订单计划数量', () => {
  const result = withColorImages(actual, pictures);
  assert.deepEqual(result.rows.map(r => r.imageUrl), ['/blue.png', '/red.png']);
  assert.deepEqual(result.rows.map(r => r.quantities), [[2, 3], [4, 1]]);
  assert.equal(actual.rows[0].imageUrl, undefined);
});
test('同名颜色图片冲突、缺图、相似颜色名都不猜图', () => {
  assert.equal(colorImageMap([...pictures, { colorName: '蓝色', imageUrl: '/other.png' }]).get('蓝色'), '');
  assert.equal(withColorImages(actual, [{ colorName: '浅蓝色', imageUrl: '/wrong.png' }]).rows[0].imageUrl, undefined);
  assert.equal(withColorImages(actual, 'bad-json').rows[0].imageUrl, undefined);
});
test('批次图片含空图均保持快照，不因后续订单改图被覆盖', () => {
  const saved = withColorImages(actual, [{ colorName: '蓝色', imageUrl: '' }, pictures[0]]);
  assert.equal(withColorImages(saved, pictures).rows[0].imageUrl, '');
  assert.equal(withColorImages(saved, [{ colorName: '红色', imageUrl: '/new.png' }]).rows[1].imageUrl, '/red.png');
});
test('JSON读取和分批扣减后，剩余颜色图保持且数量正确', () => {
  const saved = parseStoredColorSizeSnapshot(JSON.stringify(withColorImages(actual, pictures)));
  const remaining = subtractColorSizeSnapshots(saved, { headers: ['M', 'S'], rows: [{ colorName: '蓝色', quantities: [1, 1] }] });
  assert.deepEqual(remaining.rows[0], { colorName: '蓝色', quantities: [1, 2], imageUrl: '/blue.png' });
  assert.equal(remaining.rows[1].imageUrl, '/red.png');
});
test('待仓分批直发只使用服务端图片，不接受客户端伪造图', () => {
  const result = applyPendingOutboundSizeDeduction({ label: 'QA', pendingQty: 10, shipQty: 2,
    currentSnapshot: withColorImages(actual, pictures),
    outgoingSizeBreakdown: { headers: ['S', 'M'], rows: [{ colorName: '蓝色', quantities: [1, 1], imageUrl: '/wrong.png' }] },
  });
  assert.equal(result.outgoingSnapshot.rows[0].imageUrl, '/blue.png');
  assert.equal(result.remainingSnapshot.rows[0].imageUrl, '/blue.png');
});
test('待仓入库实际服务链保留两色图片，同SKU不同订单不会相互取图', async () => {
  const pendings = [1, 2].map(id => ({ id, orderId: id, skuCode: 'SAME', quantity: 10, colorSizeSnapshot: actual }));
  const qb = new Proxy({}, { get: (_, key) => key === 'getMany' ? async () => pendings : () => qb });
  const saved = [];
  const manager = { query: async sql => sql.includes('color_size_rows')
    ? [{ orderId: 1, colorRows: pictures }, { orderId: 2, colorRows: [{ colorName: '蓝色', imageUrl: '/order2.png' }] }]
    : [1, 2].map(orderId => ({ orderId, headers: ['S', 'M'] })) };
  const service = new InventoryPendingService({ manager, createQueryBuilder: () => qb, save: async p => p },
    { find: async () => [1, 2].map(id => ({ id, orderNo: 'QA' + id })) }, {},
    { createManual: async (dto, actor, preserve) => { saved.push(dto); assert.equal(preserve, true); } });
  await service.doInbound([1, 2], null, null, '', '');
  const parser = new FinishedGoodsStockInboundQueryService();
  assert.deepEqual(parser.parseColorSizeInput(saved[0].colorSize).imageRows, [
    { colorName: '蓝色', imageUrl: '/blue.png' }, { colorName: '红色', imageUrl: '/red.png' },
  ]);
  assert.deepEqual(parser.parseColorSizeInput(saved[1].colorSize).imageRows, [{ colorName: '蓝色', imageUrl: '/order2.png' }]);
  assert.equal(saved[0].quantity, 10);
});
test('自动入库补图不覆盖仓库人工颜色图，手动图片更新仍允许', async () => {
  const existing = { imageUrl: '/manual.png' };
  let removed = false;
  const service = new FinishedGoodsStockInboundService({}, { findOne: async () => existing, save: async r => r, remove: async () => { removed = true; } });
  await service.persistColorImagesForStock(1, pictures.slice(0, 1), true);
  assert.equal(existing.imageUrl, '/manual.png');
  await service.persistColorImagesForStock(1, [{ colorName: '红色', imageUrl: '' }], true);
  assert.equal(removed, false);
  await service.persistColorImagesForStock(1, pictures.slice(0, 1));
  assert.equal(existing.imageUrl, '/red.png');
  await service.persistColorImagesForStock(1, [{ colorName: '红色', imageUrl: '' }]);
  assert.equal(removed, true);
});

test('历史待仓直发从本订单取图，分批剩余和出库记录都保存正确图片', async () => {
  const pending = { id: 1, orderId: 2, skuCode: 'QA', quantity: 10, colorSizeSnapshot: actual };
  const qb = new Proxy({}, { get: (_, key) => key === 'getMany' ? async () => [pending]
    : key === 'getOne' ? async () => pending : () => qb });
  const writes = [];
  const manager = { getRepository: () => ({ createQueryBuilder: () => qb }), query: async (sql, params) => {
    if (sql.includes('color_size_headers')) return [{ orderId: 2, headers: actual.headers }];
    if (sql.includes('color_size_rows')) return [{ orderId: 2, colorRows: pictures }];
    writes.push({ sql, params });
    return { insertId: 20 };
  } };
  const service = new InventoryPendingService({ manager, createQueryBuilder: () => qb },
    { find: async () => [{ id: 2, orderNo: 'QA' }] }, { find: async () => [] });
  await service.doOutbound([{ id: 1, quantity: 2, sizeBreakdown: {
    headers: ['S', 'M'], rows: [{ colorName: '蓝色', quantities: [1, 1], imageUrl: '/forged.png' }],
  } }], 'QA', null, manager);
  const shipped = JSON.parse(writes.find(w => w.sql.startsWith('INSERT INTO finished_goods_outbound')).params[11]);
  const remaining = JSON.parse(writes.find(w => w.sql.startsWith('UPDATE inbound_pending SET quantity')).params[1]);
  assert.equal(shipped.rows[0].imageUrl, '/blue.png');
  assert.deepEqual(remaining.rows[0], { colorName: '蓝色', quantities: [1, 2], imageUrl: '/blue.png' });
  assert.equal(remaining.rows[1].imageUrl, '/red.png');
});
test('多色出库记录拆行后仍显示各自历史图，不被当前库存改图覆盖', () => {
  const service = new FinishedGoodsStockReportService();
  const snapshot = service.parseStoredColorSizeSnapshot(JSON.stringify(withColorImages(actual, pictures)));
  const rows = service.splitOutboundRowByColor({ quantity: 10, imageUrl: '/main.png', sizeBreakdown: snapshot }, new Map([['蓝色', '/changed.png']]));
  assert.deepEqual(rows.map(r => r.imageUrl), ['/blue.png', '/red.png']);
  assert.deepEqual(rows.map(r => r.quantity), [5, 5]);
  assert.equal(service.pickColorImageForSnapshot({ rows: [{ colorName: '紫色' }] }, new Map([['蓝色', '/blue.png']])), '');
});
test('成品导出颜色图优先于主图，颜色行与实际数量一致', () => {
  const lines = buildFinishedStockExportLines([{ id: 1, skuCode: 'QA', quantity: 10, unitPrice: '1',
    imageUrl: '/main.png', colorImages: pictures, sizeBreakdown: { headers: actual.headers, rows: actual.rows.map(r => ({ colorName: r.colorName, values: r.quantities })) },
  }], [], new Map(), new Map());
  for (const line of lines) assert.equal(line.imageUrl, line.colorName === '蓝色' ? '/blue.png' : '/red.png');
  assert.equal(lines.reduce((n, l) => n + l.quantity, 0), 10);
});

test('多色明细只出一种颜色时，忽略零数量颜色并使用实际出库颜色图片', () => {
  const service = new FinishedGoodsStockReportService();
  const rows = service.splitOutboundRowByColor({ quantity: 1, imageUrl: '/main.png', sizeBreakdown: {
    headers: ['S', 'M'], rows: [{ colorName: '蓝色', quantities: [0, 0], imageUrl: '/blue.png' },
      { colorName: '红色', quantities: [1, 0], imageUrl: '/red.png' }],
  } }, new Map());
  assert.equal(rows.length, 1);
  assert.equal(rows[0].imageUrl, '/red.png');
  assert.equal(rows[0].quantity, 1);
  assert.deepEqual(rows[0].sizeBreakdown.rows.map(r => r.colorName), ['红色']);
});

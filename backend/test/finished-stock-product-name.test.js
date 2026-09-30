const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeStockProductName } = require('../dist/finished-goods-stock/finished-goods-stock-query.utils');
const { FinishedGoodsStockInboundQueryService: Query } = require('../dist/finished-goods-stock/finished-goods-stock-inbound-query.service');
const { FinishedGoodsStockRepartitionService: Repartition } = require('../dist/finished-goods-stock/finished-goods-stock-repartition.service');
const { FinishedGoodsStockOutboundService: Outbound } = require('../dist/finished-goods-stock/finished-goods-stock-outbound.service');
const { FinishedGoodsStockListQueryService: List } = require('../dist/finished-goods-stock/finished-goods-stock-list-query.service');
const { buildFinishedStockAdjustLogSummary } = require('../dist/finished-goods-stock/finished-goods-stock-log-summary');
const { finishedOutboundLine } = require('../dist/common/outbound-export-rows');

test('品名允许留空、去首尾空格，拒绝非文本及超长文本', () => {
  assert.equal(normalizeStockProductName(undefined), '');
  assert.equal(normalizeStockProductName(' 雨伞 '), '雨伞');
  assert.equal(normalizeStockProductName('包'.repeat(255)).length, 255);
  for (const input of [42, {}, [], '包'.repeat(256)]) assert.throws(() => normalizeStockProductName(input));
});

test('自动合并同时匹配品名，旧无品名记录只匹配空品名', async () => {
  const calls = [];
  const qb = new Proxy({}, { get: (_, key) => (...args) => {
    if (key === 'getOne') return null;
    if (key === 'getMany') return [];
    calls.push(args); return qb;
  } });
  const service = new Query({ createQueryBuilder: () => qb });
  await service.findMergeableFinishedStock({ skuCode: 'A', productName: '雨伞', department: '', customerName: '' });
  assert.ok(calls.some(([sql, args]) => sql.includes('productName =') && args.productName === '雨伞'));
  calls.length = 0;
  await service.findDuplicateStocksForMergeKey({ skuCode: 'A', department: '' });
  assert.ok(calls.some(([sql, args]) => sql.includes('productName =') && args.productName === ''));
});

test('重分配的分桶与回滚快照保留品名', () => {
  const query = { cloneColorSizeSnapshot: x => x, parseStoredColorSizeSnapshot: x => x };
  const service = new Repartition(null, null, null, query);
  const row = { id: 1, skuCode: 'A', quantity: 2, productName: '雨伞' };
  assert.notEqual(service.bucketKey(row), service.bucketKey({ ...row, productName: '包包' }));
  assert.equal(service.captureGroupUndo([row], [])[0].productName, '雨伞');
});

test('搜索品名与SKU使用同一括号条件，后续客户筛选仍为AND', () => {
  const calls = [];
  const qb = { andWhere: (...args) => { calls.push(args); return qb; } };
  new List().applyStoredListFilters(qb, { skuCode: '雨伞', customerName: '客户A' });
  assert.match(calls[0][0], /^\(s.sku_code LIKE :skuCode OR s.product_name LIKE :skuCode\)$/);
  assert.equal(calls[0][1].skuCode, '%雨伞%');
  assert.match(calls[1][0], /customer_name/);
});

test('出库SQL在有图和旧无图路径都保存名称快照，参数个数一致', async () => {
  for (const legacyImage of [false, true]) {
    const calls = [];
    const manager = { query: async (sql, args) => {
      calls.push([sql, args]);
      if (legacyImage && calls.length === 1) throw new Error("Unknown column 'image_url'");
    } };
    await new Outbound().insertFinishedGoodsOutboundRecord(manager, { skuCode: 'A', productName: '雨伞' });
    for (const [sql, args] of calls) {
      assert.equal((sql.match(/\?/g) || []).length, args.length);
      assert.match(sql, /sku_code, product_name/);
      assert.equal(args[4], '雨伞');
    }
  }
});

test('编辑记录展示名称前后变化，导出采用出库快照而非现有名称', () => {
  const log = buildFinishedStockAdjustLogSummary({
    before: { _groupUndo: [{ productName: '雨伞' }], logAction: 'edit-save' },
    after: { _groupState: [{ productName: '折叠雨伞' }], logAction: 'edit-save' },
    remark: '修改成品库存（可回滚）',
  });
  assert.match(log, /品名「雨伞」→「折叠雨伞」/);
  assert.equal(finishedOutboundLine({ id: 1, productName: '雨伞' }, new Map()).values.productName, '雨伞');
  assert.equal(finishedOutboundLine({ id: 2 }, new Map()).values.productName, '');
});

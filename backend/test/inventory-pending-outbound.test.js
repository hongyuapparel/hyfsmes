const assert = require('node:assert/strict');
const test = require('node:test');

const {
  applyPendingOutboundSizeDeduction,
  getPendingDetailStatus,
} = require('../dist/inventory-pending/inventory-pending-outbound.helpers');
const {
  parseStoredColorSizeSnapshot,
} = require('../dist/finished-goods-stock/finished-goods-stock-query.utils');
const { assertColorRowsShape } = require('../dist/common/color-size-row.util');

function snapshot(quantities) {
  return {
    headers: ['S', 'M', 'L'],
    rows: [{ colorName: '杏色', quantities }],
  };
}

test('按数据库批次快照扣减并保留准确的剩余明细', () => {
  const result = applyPendingOutboundSizeDeduction({
    label: 'HY249',
    pendingQty: 50,
    shipQty: 22,
    currentSnapshot: snapshot([7, 15, 28]),
    outgoingSizeBreakdown: snapshot([2, 10, 10]),
  });
  assert.deepEqual(result.remainingSnapshot, snapshot([5, 5, 18]));
  assert.deepEqual(result.outgoingSnapshot, snapshot([2, 10, 10]));
});

test('批次快照合计与待处理总数不一致时拒绝出库', () => {
  assert.throws(
    () => applyPendingOutboundSizeDeduction({
      label: 'HY249',
      pendingQty: 50,
      shipQty: 10,
      currentSnapshot: snapshot([7, 15, 15]),
      outgoingSizeBreakdown: snapshot([0, 5, 5]),
    }),
    /当前待仓尺码明细与待处理数量不一致/,
  );
});

test('缺少批次快照时拒绝分批发货', () => {
  assert.throws(
    () => applyPendingOutboundSizeDeduction({
      label: 'HY249',
      pendingQty: 50,
      shipQty: 10,
      currentSnapshot: null,
      outgoingSizeBreakdown: null,
    }),
    /未留存本批颜色×尺码明细，无法分批发货/,
  );
});

test('无尺码维度的记录仍可整批按总数发货', () => {
  const result = applyPendingOutboundSizeDeduction({
    label: '无尺码记录',
    pendingQty: 8,
    shipQty: 8,
    currentSnapshot: null,
    outgoingSizeBreakdown: null,
  });
  assert.equal(result.remainingSnapshot, null);
  assert.equal(result.outgoingSnapshot, null);
});

test('列表把缺失或合计不一致的批次标记为 missing，不伪装成 recorded', () => {
  assert.equal(getPendingDetailStatus(null, 50, true), 'missing');
  assert.equal(getPendingDetailStatus(snapshot([7, 15, 15]), 50, true), 'missing');
  assert.equal(getPendingDetailStatus(snapshot([7, 15, 28]), 50, true), 'recorded');
  assert.equal(getPendingDetailStatus(null, 8, false), 'not_applicable');
  assert.equal(getPendingDetailStatus(snapshot([1, 1, 1]), 8, false), 'missing');
});

test('缺失颜色的真实明细保持为空，不自动归到唯一已知颜色', () => {
  const parsed = parseStoredColorSizeSnapshot({
    headers: ['S', 'M'],
    rows: [
      { colorName: '杏色', quantities: [7, 15] },
      { colorName: '', quantities: [1, 2] },
    ],
  });
  assert.deepEqual(parsed, {
    headers: ['S', 'M'],
    rows: [
      { colorName: '杏色', quantities: [7, 15] },
      { colorName: '', quantities: [1, 2] },
    ],
  });
});

test('生产环节拒绝缺码或负数明细，不静默补零', () => {
  assert.throws(
    () => assertColorRowsShape([{ colorName: '杏色', quantities: [7] }], ['杏色'], 2),
    /尺码数 1 与订单 2 不一致/,
  );
  assert.throws(
    () => assertColorRowsShape([{ colorName: '杏色', quantities: [7, -1] }], ['杏色'], 2),
    /必须为非负整数/,
  );
});

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildFinishedInboundLogDetails,
  buildFinishedEditLogRemark,
  buildFinishedOutboundLogRemark,
  buildFinishedStockAdjustLogSummary,
} = require('../dist/finished-goods-stock/finished-goods-stock-log-summary');

test('快速增加库存可保留订单关联，但日志不伪装成订单入库', () => {
  const details = buildFinishedInboundLogDetails({
    orderNo: '20261487',
    inboundSource: 'manual',
    remark: '盘点后恢复库存',
  });

  assert.deepEqual(details, {
    sourceOrderNo: '',
    remark: '手工新增库存；备注：盘点后恢复库存',
  });
  assert.equal(buildFinishedStockAdjustLogSummary({
    before: { quantity: 8, logAction: 'inbound' },
    after: { quantity: 9, logAction: 'inbound' },
    remark: details.remark,
    sourceOrderNo: details.sourceOrderNo,
  }), '手工新增库存 +1件；备注：盘点后恢复库存');
});

test('成品编辑日志始终明确标识为修改，不把旧的出库备注伪装成新出库', () => {
  assert.equal(
    buildFinishedEditLogRemark('成品出库；领取人：齐雅芳'),
    '修改成品库存（可回滚）；备注：成品出库；领取人：齐雅芳',
  );
  assert.equal(buildFinishedEditLogRemark(), '修改成品库存（可回滚）');
});

test('成品整组编辑日志记录实际变化而不是只显示动作名', () => {
  const beforeRow = {
    skuCode: 'HY001', quantity: 10, department: '业务部', inventoryTypeId: 1,
    warehouseId: 2, location: 'A区', unitPrice: '12.00', imageUrl: '/old.png',
    colorSizeSnapshot: { headers: ['S', 'M'], rows: [{ colorName: '杏色', quantities: [4, 6] }] },
    colorImages: [{ colorName: '杏色', imageUrl: '/beige.png' }],
  };
  const afterRow = {
    ...beforeRow,
    location: 'B区',
    colorSizeSnapshot: { headers: ['S', 'M'], rows: [{ colorName: '杏色', quantities: [5, 5] }] },
  };
  assert.equal(buildFinishedStockAdjustLogSummary({
    before: { _groupUndo: [beforeRow], logAction: 'edit-save' },
    after: { _groupState: [afterRow], logAction: 'edit-save' },
    remark: '修改成品库存（可回滚）；备注：盘点修正',
  }), '修改成品库存（可回滚）：存放地址「A区」→「B区」；颜色/尺码明细已调整；备注：盘点修正');
});

test('成品整组保存没有变化时如实显示未修改', () => {
  const row = {
    skuCode: 'HY001', quantity: 10, department: '业务部', inventoryTypeId: 1,
    warehouseId: 2, location: 'A区', unitPrice: '12.00', imageUrl: '',
    colorSizeSnapshot: { headers: ['S'], rows: [{ colorName: '杏色', quantities: [10] }] },
    colorImages: [],
  };
  assert.equal(buildFinishedStockAdjustLogSummary({
    before: { _groupUndo: [row], logAction: 'edit-save' },
    after: { _groupState: [row], logAction: 'edit-save' },
    remark: '修改成品库存（可回滚）',
  }), '修改成品库存（可回滚）：未修改任何字段');
});

test('真实订单入库仍保留订单来源', () => {
  assert.deepEqual(buildFinishedInboundLogDetails({
    orderNo: '20261487',
    inboundSource: 'order',
  }), {
    sourceOrderNo: '20261487',
    remark: '从订单 20261487 新增库存',
  });
});

test('成品出库日志同时留存领取人和备注', () => {
  assert.equal(
    buildFinishedOutboundLogRemark('齐雅芳', '样衣使用'),
    '成品出库；领取人：齐雅芳；备注：样衣使用',
  );
});

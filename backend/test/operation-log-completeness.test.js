const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildCostDraftLogDetail,
  buildOrderCreateLogDetail,
  buildOrderUpdateLogDetail,
} = require('../dist/orders/order-operation-log-summary');
const {
  buildPackingListShipSummary,
  buildPackingListUpdateSummary,
} = require('../dist/packing-lists/packing-list-log-summary');
const { formatColorSizeOperationDetail } = require('../dist/common/operation-log-format.util');

test('订单编辑记录简单字段和结构化明细的实际变化', () => {
  const detail = buildOrderUpdateLogDetail({
    skuCode: 'HY001',
    quantity: 10,
    imageUrl: '/old.png',
    colorSizeHeaders: ['S', 'M'],
    colorSizeRows: [{ colorName: '杏色', quantities: [4, 6] }],
    materials: [{ materialName: '主布' }],
    orderDate: new Date('2026-08-01T00:00:00.000Z'),
  }, {
    skuCode: 'HY002',
    quantity: 12,
    imageUrl: '/new.png',
    colorSizeHeaders: ['S', 'M'],
    colorSizeRows: [{ colorName: '杏色', quantities: [5, 7] }],
    materials: [{ materialName: '主布' }, { materialName: '里布' }],
    orderDate: '2026-08-01',
  });

  assert.equal(detail, '修改订单：SKU「HY001」→「HY002」；数量 10→12；产品图已更新；颜色/尺码明细已修改（1色、10件→1色、12件）；物料明细已修改（1项→2项）');
});

test('订单无变化保存也如实记录未修改字段', () => {
  assert.equal(
    buildOrderUpdateLogDetail({ skuCode: 'HY001', quantity: 10 }, { skuCode: 'HY001', quantity: 10 }),
    '修改订单：未修改任何字段',
  );
  assert.equal(
    buildOrderCreateLogDetail({ skuCode: 'HY001', customerName: '客户A', quantity: 10 }),
    '创建订单草稿：SKU HY001；客户 客户A；数量 10件',
  );
});

test('订单物料的接口展示字段不应被误判为业务修改', () => {
  assert.equal(
    buildOrderUpdateLogDetail({
      materials: [{ materialTypeId: 1, materialType: '面料', materialSourceId: 2, materialSource: '客供', materialName: '主布' }],
    }, {
      materials: [{ materialTypeId: 1, materialSourceId: 2, materialName: '主布' }],
    }),
    '修改订单：未修改任何字段',
  );
});

test('订单部分更新不应把未传入的结构化字段记为已修改', () => {
  assert.equal(
    buildOrderUpdateLogDetail({ materials: [{ materialName: '主布' }] }, { skuCode: 'HY001' }),
    '修改订单：SKU「-」→「HY001」',
  );
});

test('成本草稿记录变化板块和预计出厂价', () => {
  assert.equal(
    buildCostDraftLogDetail(
      { materialRows: [{ unitPrice: 10 }], profitMargin: 0.1 },
      { materialRows: [{ unitPrice: 12 }], profitMargin: 0.2 },
      11.11,
      15,
    ),
    '保存成本草稿：预计出厂价 11.11→15.00；变更：物料成本、利润率（未同步订单卡片出厂价）',
  );
});

function packingBefore() {
  return {
    code: 'PL-20260806-01',
    customerId: 1,
    customerName: '客户A',
    serviceManager: 'Lily',
    poNo: 'PO-1',
    country: 'USA',
    postalCode: '10001',
    xiaomanOrderNo: 'XM-1',
    xiaomanOrderId: '100',
    packDate: '2026-08-06',
    remark: '',
    showCompany: true,
    sizeHeaders: ['S', 'M'],
    boxes: [{
      boxSeq: 1,
      weightKg: 10,
      cartonSize: '50*40*30',
      remark: '',
      items: [{
        styleNo: 'HY001',
        styleName: 'T恤',
        colorName: '杏色',
        imageUrl: '',
        sizeQuantities: { S: 4, M: 6 },
        totalQty: 10,
        sourceType: 'manual',
        sourceId: null,
      }],
    }],
  };
}

test('装箱单总数不变但尺码明细变化时仍记录受影响箱和款色', () => {
  const before = packingBefore();
  const payload = {
    ...before,
    boxes: [{
      ...before.boxes[0],
      items: [{ ...before.boxes[0].items[0], sizeQuantities: { S: 5, M: 5 } }],
    }],
  };
  assert.equal(
    buildPackingListUpdateSummary(before, payload),
    '修改装箱单 PL-20260806-01：箱规/箱内明细已修改：第1箱（HY001/杏色）',
  );
});

test('装箱单无修改保存时如实记录未修改', () => {
  const before = packingBefore();
  assert.equal(
    buildPackingListUpdateSummary(before, { ...before, boxes: before.boxes.map((box) => ({
      ...box,
      items: box.items.map((item) => ({ ...item })),
    })) }),
    '修改装箱单 PL-20260806-01：未修改任何字段',
  );
});

test('装箱单发货记录箱数、总件数和款色内容', () => {
  assert.equal(
    buildPackingListShipSummary(packingBefore()),
    '发货 PL-20260806-01：1箱，共10件；HY001/杏色 10件',
  );
});

test('颜色尺码操作记录按实际矩阵展示', () => {
  assert.equal(
    formatColorSizeOperationDetail(['S', 'M'], [{ colorName: '杏色', quantities: [7, 15] }], 22),
    '杏色（S 7、M 15，合计22件）',
  );
});

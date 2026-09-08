const assert = require('node:assert/strict');
const test = require('node:test');

const {
  findUnexpectedPackingSizeQuantity,
  formatUnexpectedPackingSizeQuantity,
  normalizePackingSizeQuantitiesForHeaders,
  sumPackingSizeQuantities,
} = require('../dist/packing-lists/packing-list-quantities');

function boxes(sizeQuantities) {
  return [{ items: [{ styleNo: 'IS2604493', colorName: '加拿大U620656', sizeQuantities }] }];
}

test('后端能识别表头外的隐藏正数尺码', () => {
  const unexpected = findUnexpectedPackingSizeQuantity(['OSFA'], boxes({ OSFA: 5, S: 5 }));
  assert.deepEqual(unexpected, {
    boxIndex: 0,
    itemIndex: 0,
    styleNo: 'IS2604493',
    colorName: '加拿大U620656',
    sizeName: 'S',
    quantity: 5,
  });
  assert.equal(
    formatUnexpectedPackingSizeQuantity(unexpected),
    '第1箱「IS2604493」存在未显示尺码「S」5件，请刷新页面确认后再保存',
  );
});

test('后端保存归一化只保留当前表头并以相同口径求和', () => {
  const normalized = normalizePackingSizeQuantitiesForHeaders({ OSFA: 5, S: 5 }, ['OSFA']);
  assert.deepEqual(normalized, { OSFA: 5 });
  assert.equal(sumPackingSizeQuantities(normalized), 5);
});

test('零数量旧键不阻断，正数旧键必须阻断', () => {
  assert.equal(findUnexpectedPackingSizeQuantity(['OSFA'], boxes({ OSFA: 5, S: 0 })), null);
  assert.equal(findUnexpectedPackingSizeQuantity(['OSFA'], boxes({ OSFA: 5 })), null);
});

test('无名正数不能静默丢弃，必须作为未命名尺码核对', () => {
  const unexpected = findUnexpectedPackingSizeQuantity(['OSFA'], boxes({ '': 5, OSFA: 5 }));
  assert.equal(unexpected.sizeName, '未命名尺码');
  assert.equal(unexpected.quantity, 5);
});

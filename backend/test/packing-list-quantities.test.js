const assert = require('node:assert/strict');
const test = require('node:test');

const {
  findUnexpectedPackingSizeQuantity,
  formatUnexpectedPackingSizeQuantity,
  normalizePackingSizeQuantitiesForHeaders,
  sumPackingSizeQuantities,
  packingQuantityTotal,
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

test('无名和已删除尺码不计数，也不能回退到旧合计', () => {
  assert.deepEqual(normalizePackingSizeQuantitiesForHeaders({ '': 5, S: 4 }, ['OSFA']), {});
  assert.equal(packingQuantityTotal({ '': 5, S: 4 }, 9, ['OSFA']), 0);
  assert.equal(packingQuantityTotal({}, 9, ['OSFA']), 9);
});

test('表头明确保留的 S 和 0 是正常尺码，不得误删', () => {
  assert.deepEqual(normalizePackingSizeQuantitiesForHeaders({ S: 4, '0': 5 }, ['S', '0']), { S: 4, '0': 5 });
  assert.equal(packingQuantityTotal({ S: 4, '0': 5 }, 999, ['S', '0']), 9);
});

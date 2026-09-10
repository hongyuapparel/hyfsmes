import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { normalizeStoredSnapshot } from './useFinishedDetailHelpers'
import { normalizeStoredBreakdownSnapshot } from '@/utils/finishedStockTableUtils'
import { useFinishedDetailDisplayData } from './useFinishedDetailDisplayData'

describe.each([normalizeStoredSnapshot, normalizeStoredBreakdownSnapshot])('库存明细只展示已存事实', (normalize) => {
  it('空颜色不能因数量相同而并入已知颜色', () => {
    expect(normalize({ headers: ['S'], rows: [
      { colorName: '杏色', values: [5] }, { colorName: '', values: [5] },
    ] })?.rows).toEqual([{ colorName: '杏色', values: [5] }, { colorName: '', values: [5] }])
  })
  it('内部未分配颜色保留为未知，不推测为唯一已知颜色', () => {
    expect(normalize({ headers: ['M'], rows: [
      { colorName: '蓝色', values: [3] }, { colorName: '__UNASSIGNED__', values: [2] },
    ] })?.rows).toEqual([{ colorName: '蓝色', values: [3] }, { colorName: '', values: [2] }])
  })
  it('过滤内部尺码和空表头不会导致数量串列', () => {
    expect(normalize({ headers: ['', 'M', '__UNASSIGNED__', 'S'], rows: [
      { colorName: '红色', values: [90, 3, 80, 2] },
    ] })).toEqual({ headers: ['S', 'M'], rows: [{ colorName: '红色', values: [2, 3] }] })
  })
})

it('没有实际尺码数量时，不按库存总数分配明细', () => {
  const display = useFinishedDetailDisplayData({
    data: ref({ stock: { quantity: 10 }, colorSize: { headers: ['S'], rows: [{ colorName: '蓝色', quantities: [0] }] } }),
    groupSizeHeaders: ref([]), groupSnapshot: ref(null), selectedColorName: ref(null),
    selectedQuantity: ref(null), metaEditing: ref(false), editUnitPrice: () => '',
  })
  expect(display.displayColorSizeRows.value).toEqual([])
})

import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import type { FinishedStockRow } from '@/api/inventory'
import { useFinishedStockTable } from './useFinishedStockTable'
import { isStockTableParentRow } from '@/utils/finishedStockTableUtils'

describe('成品库存品名分组展示', () => {
  it('同SKU品名不一致时父行不冒用首条名称，子行保留原名', () => {
    const { stockTableData } = useFinishedStockTable(ref([
      { ...makeStock(1, ''), productName: '雨伞' },
      { ...makeStock(2, ''), productName: '折叠雨伞' },
    ]))
    const parent = stockTableData.value[0]
    expect(parent.productName).toBe('多个')
    if (isStockTableParentRow(parent)) expect(parent._children.map(row => row.productName)).toEqual(['雨伞', '折叠雨伞'])
  })
})

function makeStock(id: number, customerName: string): FinishedStockRow {
  return {
    id,
    orderId: null,
    orderNo: '',
    customerName,
    skuCode: 'XQ008',
    quantity: 10,
    unitPrice: '20',
    warehouseId: 1,
    inventoryTypeId: 1,
    department: 'B2B外贸',
    location: 'A区',
    productImageUrl: '',
    imageUrl: '',
    createdAt: '2026-08-02 10:00:00',
    type: 'stored',
    sizeBreakdown: null,
  }
}

describe('useFinishedStockTable parent customer display', () => {
  it('同一 SKU 跨多个客户时父行显示“多个”', () => {
    const { stockTableData } = useFinishedStockTable(ref([
      makeStock(1, 'TEMU店铺'),
      makeStock(2, '亚马逊'),
    ]))

    const parent = stockTableData.value[0]
    expect(isStockTableParentRow(parent)).toBe(true)
    expect(parent.customerName).toBe('多个')
  })

  it('同一 SKU 客户一致时父行保留客户名称', () => {
    const { stockTableData } = useFinishedStockTable(ref([
      makeStock(1, 'DIVINE 9 FLAIR'),
      makeStock(2, 'DIVINE 9 FLAIR'),
    ]))

    expect(stockTableData.value[0].customerName).toBe('DIVINE 9 FLAIR')
  })
})

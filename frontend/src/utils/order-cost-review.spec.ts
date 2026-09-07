import { describe, expect, it } from 'vitest'
import type { OrderDetail } from '@/api/orders'
import { orderCostImages, orderCostStructureDifferences, reviewCostRows } from './order-cost-review'
import { mergeMaterialRowsFromOrder, mergeProcessItemRowsFromOrder, normalizeProfitMargin } from './order-cost'

describe('order cost review', () => {
  it('keeps 15% margin and handles invalid margins', () => {
    expect(normalizeProfitMargin(0.15)).toBe(0.15)
    expect(normalizeProfitMargin(1)).toBe(0.1)
    expect(normalizeProfitMargin(-1)).toBe(0.1)
  })
  it('deduplicates images and falls back to attachments and colors', () => {
    const order = { imageUrl: 'main.jpg', attachments: ['main.jpg', 'detail.jpg'], colorSizeRows: [{ imageUrl: 'color.jpg' }] } as OrderDetail
    expect(orderCostImages(order)).toEqual(['main.jpg', 'detail.jpg', 'color.jpg'])
    expect(orderCostImages({ ...order, imageUrl: '' })).toEqual(['main.jpg', 'detail.jpg', 'color.jpg'])
    expect(orderCostImages(null)).toEqual([])
  })
  it('ignores placeholders and excluded materials, but warns for named zero-cost rows', () => {
    expect(reviewCostRows([{ unitPrice: 0 }, { materialName: '客供布', unitPrice: 0, includeInCost: false }], [{ unitPrice: 0, quantity: 1 }], [], 2)).toEqual([])
    const warnings = reviewCostRows([{ materialName: '面料', unitPrice: 0, usagePerPiece: 1 }], [{ processName: '印花', unitPrice: 10, quantity: 0 }], [{ processName: '车缝', unitPrice: 0, quantity: 1 }], 0)
    expect(warnings).toHaveLength(4)
  })
  it('compares structure independently of price, order and numeric representation', () => {
    const order = { materials: [{ materialName: '布', usagePerPiece: 1 }], processItems: [] } as unknown as OrderDetail
    expect(orderCostStructureDifferences(order, [{ materialName: '布', usagePerPiece: 1, unitPrice: 50 }], [{ unitPrice: 0, quantity: 1 }])).toEqual([])
    expect(orderCostStructureDifferences(order, [{ materialName: '布', usagePerPiece: 2, unitPrice: 50 }], [])).toEqual(['物料'])
    expect(orderCostStructureDifferences({ ...order, materials: [] }, [{ materialName: '布', unitPrice: 50 }], [])).toEqual(['物料'])
  })
  it('retains exact prices and flags unmatched or ambiguous variants with zero prices', () => {
    const priced = [{ materialName: '布', color: '红', unitPrice: 30 }, { materialName: '布', color: '蓝', unitPrice: 40 }]
    expect(mergeMaterialRowsFromOrder([{ materialName: '布', color: '蓝' }], priced)[0].unitPrice).toBe(40)
    expect(mergeMaterialRowsFromOrder([{ materialName: '布', color: '黄' }], priced)[0].unitPrice).toBe(0)
    expect(mergeMaterialRowsFromOrder([], priced)).toEqual([])
    expect(mergeProcessItemRowsFromOrder([{ processName: '印花', part: '前' }], [{ processName: '印花', part: '前', unitPrice: 5, quantity: 2 }])[0]).toMatchObject({ unitPrice: 5, quantity: 2 })
  })
})

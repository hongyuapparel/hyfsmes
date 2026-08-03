import { describe, expect, it } from 'vitest'
import { buildOutboundDialogItem } from '@/composables/inventoryPendingDialogHelpers'
import type { PendingListItem } from '@/api/inventory'

function baseRow(overrides: Partial<PendingListItem> = {}): PendingListItem {
  return {
    id: 1,
    orderId: 10,
    orderNo: '20262579',
    customerName: 'TEMU',
    skuCode: 'XH3297',
    quantity: 199,
    sourceType: 'normal',
    createdAt: '',
    detailStatus: 'recorded',
    colorSizeSnapshot: {
      headers: ['S', 'M', 'L', 'XL', '2XL'],
      rows: [{ colorName: '墨绿色', quantities: [50, 49, 50, 25, 25] }],
    },
    ...overrides,
  }
}

describe('buildOutboundDialogItem', () => {
  it('uses finishing snapshot as-is when totals match', () => {
    const { item, warning } = buildOutboundDialogItem(baseRow())
    expect(warning).toBeUndefined()
    expect(item.rows[0].quantities).toEqual([50, 49, 50, 25, 25])
  })

  it('does not swap M/L when order plan would (regression)', () => {
    const { item } = buildOutboundDialogItem(baseRow())
    expect(item.rows[0].quantities[1]).toBe(49)
    expect(item.rows[0].quantities[2]).toBe(50)
  })

  it('leaves empty grid when snapshot missing (no plan redistribute)', () => {
    const { item, warning } = buildOutboundDialogItem(baseRow({ colorSizeSnapshot: null, detailStatus: 'missing' }))
    expect(item.rows).toEqual([])
    expect(warning).toMatch(/未留存本批颜色尺码/)
  })

  it('rejects a snapshot whose total differs from the pending quantity', () => {
    const { item, warning } = buildOutboundDialogItem(baseRow({ quantity: 149 }))
    expect(warning).toMatch(/不一致/)
    expect(item.rows).toEqual([])
  })
})

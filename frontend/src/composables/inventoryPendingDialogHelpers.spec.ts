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
    colorSizeSnapshot: {
      headers: ['S', 'M', 'L', 'XL', '2XL'],
      rows: [{ colorName: '墨绿色', quantities: [50, 49, 50, 25, 25] }],
    },
    ...overrides,
  }
}

describe('buildOutboundDialogItem', () => {
  it('uses finishing snapshot as-is when totals match', () => {
    const { item, warning } = buildOutboundDialogItem(baseRow(), {})
    expect(warning).toBeUndefined()
    expect(item.rows[0].quantities).toEqual([50, 49, 50, 25, 25])
  })

  it('does not swap M/L when order plan would (regression)', () => {
    const cache = {
      10: {
        loading: false,
        error: false,
        headers: ['S', 'M', 'L', 'XL', '2XL', '合计'],
        rows: [{ colorName: '墨绿色', values: [50, 50, 50, 25, 25, 200] }],
      },
    }
    const { item } = buildOutboundDialogItem(baseRow(), cache)
    expect(item.rows[0].quantities[1]).toBe(49)
    expect(item.rows[0].quantities[2]).toBe(50)
  })

  it('leaves empty grid when snapshot missing (no plan redistribute)', () => {
    const cache = {
      10: {
        loading: false,
        error: false,
        headers: ['S', 'M', 'L', 'XL', '2XL', '合计'],
        rows: [{ colorName: '墨绿色', values: [50, 50, 50, 25, 25, 200] }],
      },
    }
    const { item, warning } = buildOutboundDialogItem(baseRow({ colorSizeSnapshot: null }), cache)
    expect(item.rows[0].quantities).toEqual([0, 0, 0, 0, 0])
    expect(warning).toMatch(/未留存本批尺码/)
  })

  it('scales from snapshot when legacy pending qty smaller than snap total', () => {
    const { item, warning } = buildOutboundDialogItem(baseRow({ quantity: 149 }), {})
    expect(warning).toMatch(/不一致/)
    expect(item.rows[0].quantities.reduce((a, b) => a + b, 0)).toBe(149)
  })
})

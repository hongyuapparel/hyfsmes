import { describe, expect, it } from 'vitest'
import { buildOutboundDialogItem, buildInboundPreviewItem, getOutboundValidationMessage } from '@/composables/inventoryPendingDialogHelpers'
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
  it('keeps quantities aligned when a total column is not the last column', () => {
    const row = baseRow({ quantity: 5, colorSizeSnapshot: { headers: ['合计', 'S', 'M'], rows: [{ colorName: '杏色', quantities: [5, 2, 3] }] } })
    expect(buildOutboundDialogItem(row).item.rows[0].quantities).toEqual([2, 3])
    expect(buildInboundPreviewItem(row).rows[0].values).toEqual([2, 3])
  })

  it.each([-1, 1.5, Number.NaN])('rejects invalid stored quantity %s without clamping facts', (value) => {
    const row = baseRow({ quantity: 2, colorSizeSnapshot: { headers: ['S'], rows: [{ colorName: '杏色', quantities: [value] }] } })
    expect(buildOutboundDialogItem(row).warning).toMatch(/明细无效/)
  })

  it('rejects color-size over-allocation even when the grand total is unchanged', () => {
    const { item } = buildOutboundDialogItem(baseRow())
    item.rows[0].quantities[0] = 51
    item.rows[0].quantities[1] = 48
    expect(getOutboundValidationMessage(item)).toMatch(/S 最多可发 50 件/)
    expect(item.row.colorSizeSnapshot?.rows[0].quantities[0]).toBe(50)
  })

  it('accepts a factual partial shipment and rejects zero shipment', () => {
    const { item } = buildOutboundDialogItem(baseRow())
    item.rows[0].quantities = [1, 0, 0, 0, 0]
    expect(getOutboundValidationMessage(item)).toBe('')
    item.rows[0].quantities = [0, 0, 0, 0, 0]
    expect(getOutboundValidationMessage(item)).toMatch(/请填写发货数量/)
  })
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

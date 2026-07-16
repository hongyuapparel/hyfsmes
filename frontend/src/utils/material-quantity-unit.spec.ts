import { describe, expect, it } from 'vitest'
import { formatMaterialQuantity } from '@/utils/material-quantity-unit'

describe('material-quantity-unit', () => {
  it('formatMaterialQuantity uses smart usage decimals for fabric meters', () => {
    expect(formatMaterialQuantity(0.018, { materialType: '配布' })).toBe('0.018 米')
    expect(formatMaterialQuantity(0.58, { materialType: '主布' })).toBe('0.58 米')
    expect(formatMaterialQuantity(0.02, { materialType: '里布' })).toBe('0.02 米')
  })

  it('formatMaterialQuantity keeps integer accessory counts', () => {
    expect(formatMaterialQuantity(5, { materialType: '辅料' })).toBe('5 个')
  })
})

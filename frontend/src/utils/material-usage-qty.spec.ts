import { describe, expect, it } from 'vitest'
import {
  formatMaterialUsageQtyDisplay,
  formatMaterialUsageQtyOrDash,
  parseMaterialUsageQtyInput,
  roundMaterialUsageQty,
} from '@/utils/material-usage-qty'

describe('material-usage-qty', () => {
  it('roundMaterialUsageQty keeps up to 3 decimals', () => {
    expect(roundMaterialUsageQty(0.018)).toBe(0.018)
    expect(roundMaterialUsageQty(0.5801)).toBe(0.58)
    expect(roundMaterialUsageQty(10)).toBe(10)
  })

  it('formatMaterialUsageQtyDisplay trims trailing zeros only', () => {
    expect(formatMaterialUsageQtyDisplay(0.58)).toBe('0.58')
    expect(formatMaterialUsageQtyDisplay(0.018)).toBe('0.018')
    expect(formatMaterialUsageQtyDisplay(0.02)).toBe('0.02')
    expect(formatMaterialUsageQtyDisplay(1)).toBe('1')
    expect(formatMaterialUsageQtyDisplay(10)).toBe('10')
  })

  it('parseMaterialUsageQtyInput keeps partial decimals while typing', () => {
    expect(parseMaterialUsageQtyInput('0.')).toBe('0.')
    expect(parseMaterialUsageQtyInput('0.0')).toBe('0.0')
    expect(parseMaterialUsageQtyInput('0.01')).toBe('0.01')
  })

  it('parseMaterialUsageQtyInput limits precision', () => {
    expect(parseMaterialUsageQtyInput('0.018')).toBe('0.018')
    expect(parseMaterialUsageQtyInput('0.580')).toBe('0.58')
    expect(parseMaterialUsageQtyInput('abc0.02m')).toBe('0.02')
    expect(parseMaterialUsageQtyInput('.018')).toBe('0.018')
    expect(parseMaterialUsageQtyInput('0.01899')).toBe('0.019')
  })

  it('parseMaterialUsageQtyInput rejects invalid or negative values', () => {
    expect(parseMaterialUsageQtyInput('1..2')).toBe('')
    expect(parseMaterialUsageQtyInput('--1')).toBe('')
    expect(parseMaterialUsageQtyInput('-0.5')).toBe('')
  })

  it('formatMaterialUsageQtyOrDash returns dash for empty values', () => {
    expect(formatMaterialUsageQtyOrDash(null)).toBe('—')
    expect(formatMaterialUsageQtyOrDash(0.018)).toBe('0.018')
  })
})

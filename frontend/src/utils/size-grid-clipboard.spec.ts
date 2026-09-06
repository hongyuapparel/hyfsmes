import { describe, expect, it } from 'vitest'
import { parseSizeClipboard, serializeSizeClipboard } from './size-grid-clipboard'

describe('size grid Excel clipboard', () => {
  it('preserves blank rows, empty leading cells and trailing cells', () => {
    expect(parseSizeClipboard('\t10\t\r\n\t\t\r\n胸围\t20\t\r\n')).toEqual([
      ['', '10', ''], ['', '', ''], ['胸围', '20', ''],
    ])
  })
  it('round-trips quoted multiline cells and literal quotes', () => {
    const rows = [['胸围', '52% Cotton\n48% Polyester', 'a"b', 'a\tb'], ['', '', '10', '']]
    expect(parseSizeClipboard(serializeSizeClipboard(rows))).toEqual(rows)
  })
  it('keeps a single cell a single cell', () => {
    expect(parseSizeClipboard('21.5')).toEqual([['21.5']])
  })
})

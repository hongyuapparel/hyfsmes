/** 单件用量（米/件）最多保留的小数位 */
export const MATERIAL_USAGE_QTY_MAX_DECIMALS = 3

/** 归一化存储/计算：最多 3 位小数，不补尾随 0 */
export function roundMaterialUsageQty(n: number): number {
  if (!Number.isFinite(n)) return 0
  const factor = 10 ** MATERIAL_USAGE_QTY_MAX_DECIMALS
  return Math.round(n * factor) / factor
}

/**
 * 用量展示：最多 3 位小数，去掉无意义的尾随 0（0.58 而非 0.580，0.018 保留三位）。
 * 用于 el-input-number formatter、订单详情只读单元格等。
 */
export function formatMaterialUsageQtyDisplay(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(n)) return String(value)
  return parseFloat(roundMaterialUsageQty(n).toFixed(MATERIAL_USAGE_QTY_MAX_DECIMALS)).toString()
}

/** 只读展示：无值时返回占位符（默认 —） */
export function formatMaterialUsageQtyOrDash(value: unknown, emptyDisplay = '—'): string {
  if (value === null || value === undefined || value === '') return emptyDisplay
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(n)) return emptyDisplay
  return formatMaterialUsageQtyDisplay(n)
}

/** el-input-number parser：解析用户输入并限制为最多 3 位小数（用量字段 min=0） */
export function parseMaterialUsageQtyInput(displayValue: string): string {
  const cleaned = displayValue.replace(/[^\d.-]/g, '').trim()
  if (cleaned === '' || cleaned === '.') return cleaned
  if (cleaned.includes('-')) return ''
  if (!/^(\d+\.?\d*|\.\d+)$/.test(cleaned)) return ''

  const dot = cleaned.indexOf('.')
  if (dot >= 0) {
    const frac = cleaned.slice(dot + 1)
    if (frac.length < MATERIAL_USAGE_QTY_MAX_DECIMALS) return cleaned
    const n = Number(cleaned)
    if (!Number.isFinite(n)) return ''
    return String(roundMaterialUsageQty(n))
  }

  const n = Number(cleaned)
  if (!Number.isFinite(n)) return ''
  return String(roundMaterialUsageQty(n))
}

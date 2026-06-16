/**
 * 业务数值只读展示：整数不显示小数位，有小数时保留两位并消除常见浮点误差。
 * 不用于接口、store、表单提交或计算回写；非数字字符串原样返回。
 */
export type FormatDisplayNumberOptions = {
  /** null/undefined 时的返回值，默认 '' */
  emptyDisplay?: string
}

export function formatDisplayNumber(
  value: unknown,
  options?: FormatDisplayNumberOptions,
): string {
  const empty = options?.emptyDisplay ?? ''

  if (value === null || value === undefined) return empty

  if (typeof value === 'string') {
    const t = value.trim()
    if (t === '') return empty
    if (!/^-?\d+(?:\.\d+)?$/.test(t)) return value
  }

  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim())
        : Number(value)

  if (!Number.isFinite(n)) {
    if (typeof value === 'string') return value
    return empty
  }

  const rounded = Math.round(n * 100) / 100
  const nearestInt = Math.round(rounded)
  if (Math.abs(rounded - nearestInt) < 1e-9) {
    return String(nearestInt)
  }
  return rounded.toFixed(2)
}

export type FormatCurrencyOptions = FormatDisplayNumberOptions & {
  /** 货币符号，默认 '￥'（全角，与财务/库存模块现有用法一致） */
  symbol?: string
}

/**
 * 金额展示：基于 formatDisplayNumber，前面拼货币符号。
 * - null / undefined / 空字符串 → emptyDisplay（默认 '-'，不带符号）
 * - 非数字字符串 → 原样返回（不带符号）
 * - 合法数字 → `￥{格式化}`，负数照样为 `￥-27.57`
 */
export function formatCurrency(value: unknown, options?: FormatCurrencyOptions): string {
  const empty = options?.emptyDisplay ?? '-'
  if (value === null || value === undefined) return empty
  if (typeof value === 'string' && value.trim() === '') return empty

  const formatted = formatDisplayNumber(value, { emptyDisplay: empty })
  if (formatted === empty) return empty
  if (typeof value === 'string' && !/^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    return formatted
  }
  const symbol = options?.symbol ?? '￥'
  return `${symbol}${formatted}`
}

/**
 * 金额对齐展示：货币符号 + 固定两位小数。用于表格金额列，右对齐时小数点自然对齐。
 * - null / undefined / 空字符串 → emptyDisplay（默认 '-'，不带符号）
 * - 非数字字符串 → 原样返回
 * - 合法数字 → `￥{定两位}`，如 10800 → `￥10800.00`，负数 → `￥-27.57`
 */
export function formatMoneyAligned(value: unknown, options?: FormatCurrencyOptions): string {
  const empty = options?.emptyDisplay ?? '-'
  if (value === null || value === undefined) return empty
  if (typeof value === 'string') {
    const t = value.trim()
    if (t === '') return empty
    if (!/^-?\d+(?:\.\d+)?$/.test(t)) return value
  }
  const n = Number(value)
  if (!Number.isFinite(n)) return empty
  const symbol = options?.symbol ?? '￥'
  return `${symbol}${(Math.round(n * 100) / 100).toFixed(2)}`
}

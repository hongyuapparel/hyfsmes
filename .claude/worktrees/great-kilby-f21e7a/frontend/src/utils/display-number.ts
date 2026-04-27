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

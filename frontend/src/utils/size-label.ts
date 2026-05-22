/**
 * 推断「下一个尺码」的列名，用于新增尺码列时按已有尺码规律自动接续。
 * 支持字母码梯（S/M/L/XL/2XL...）与等步长数字码（4,6,8...）；
 * 无法可靠识别时回退为「尺码N」，列名仍可手动修改。
 */

// 基础字母档的下一档（统一输出 2XL/3XL 写法）。
const BASE_LADDER_NEXT: Record<string, string> = {
  XS: 'S',
  S: 'M',
  M: 'L',
  L: 'XL',
  XL: '2XL',
}

// 将 XXL/XXXL... 别名归一为 2XL/3XL... 写法（XL 不算别名，仍走基础档）。
function resolveXAlias(label: string): string {
  const matched = /^(X+)L$/.exec(label)
  if (matched && matched[1].length >= 2) {
    return `${matched[1].length}XL`
  }
  return label
}

function isNumeric(value: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(value)
}

export function nextSizeLabel(headers: string[]): string {
  const fallback = `尺码${headers.length + 1}`
  if (!headers.length) return fallback

  const lastRaw = String(headers[headers.length - 1] ?? '').trim()
  const last = resolveXAlias(lastRaw.toUpperCase())

  // 1. 基础字母档：XS→S→M→L→XL→2XL
  if (BASE_LADDER_NEXT[last]) return BASE_LADDER_NEXT[last]

  // 2. NXL 模式：2XL→3XL、4XL→5XL
  const nxl = /^(\d+)XL$/.exec(last)
  if (nxl) return `${Number(nxl[1]) + 1}XL`

  // 3. 等步长数字码：需最后两个均为数字才能确定步长
  if (isNumeric(lastRaw) && headers.length >= 2) {
    const prevRaw = String(headers[headers.length - 2] ?? '').trim()
    if (isNumeric(prevRaw)) {
      const step = Number(lastRaw) - Number(prevRaw)
      if (step !== 0) return String(Number(lastRaw) + step)
    }
  }

  // 4. 无法识别：回退「尺码N」
  return fallback
}

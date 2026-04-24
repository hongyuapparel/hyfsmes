export const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
/** 与订单列表日期筛选项一致，避免 placeholder（如「入库时间」）被截断 */
const DATE_RANGE_WIDTH_EMPTY = '170px'
const DATE_RANGE_WIDTH_FILLED = '220px'
const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const ACTIVE_SELECT_STYLE = { '--el-text-color-regular': ACTIVE_FILTER_COLOR }

export function getFilterInputStyle(v: unknown) {
  return v ? { color: ACTIVE_FILTER_COLOR } : undefined
}

/**
 * 统一清洗文本筛选值：
 * - 去除首尾空格
 * - 支持用户误输入 "SKU:" / "SKU：" / "订单号:" / "订单号：" 前缀
 * - 空字符串转为 undefined，避免把无效条件发给后端
 */
export function normalizeTextFilter(v: unknown): string | undefined {
  if (v == null) return undefined
  let text = String(v).trim()
  if (!text) return undefined
  text = text.replace(/^(SKU|订单号)\s*[:：]\s*/i, '').trim()
  return text || undefined
}

export function getTextFilterStyle(prefix: string, val: unknown, showLabel: boolean) {
  if (!val || !showLabel) return undefined
  const text = `${prefix}${String(val)}`
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px` }
}

export function getOrderNoFilterStyle(orderNo: unknown, showLabel: boolean) {
  return getTextFilterStyle('订单号：', orderNo, showLabel)
}

export function getSkuCodeFilterStyle(skuCode: unknown, showLabel: boolean) {
  return getTextFilterStyle('SKU：', skuCode, showLabel)
}

export function getFilterRangeStyle(v: [string, string] | [] | null | undefined) {
  const hasValue = Array.isArray(v) && v.length === 2
  const width = hasValue ? DATE_RANGE_WIDTH_FILLED : DATE_RANGE_WIDTH_EMPTY
  // minWidth 覆盖 design-system 里 .filter-bar .filter-bar-item 的 min-width:120px
  const base = { width, minWidth: width, flex: `0 0 ${width}` }
  return hasValue ? { ...base, ...ACTIVE_SELECT_STYLE } : base
}

export function getFilterSelectStyle(v: unknown) {
  return v ? ACTIVE_SELECT_STYLE : undefined
}

/**
 * 筛选项下拉宽度随内容调节。
 * @param extraPadding 右侧预留（箭头/清空图标等），默认 60；客户项用 42 以减少尾部空白
 */
export function getFilterSelectAutoWidthStyle(v: unknown, extraPadding = 60) {
  if (!v) return undefined
  const text = String(v)
  const estimated = text.length * FILTER_CHAR_PX + extraPadding
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return {
    ...ACTIVE_SELECT_STYLE,
    width: `${width}px`,
    flex: `0 0 ${width}px`,
  }
}

export const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
export const FILTER_CHAR_PX = 14
export const ACTIVE_SELECT_STYLE = { '--el-text-color-regular': ACTIVE_FILTER_COLOR }

const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320

/** CJK/全角字符按 14px，ASCII/拉丁字符按 9px，更贴近实际渲染宽度 */
function estimateTextWidth(text: string): number {
  let w = 0
  for (const c of text) {
    w += c.charCodeAt(0) > 0x2e7f ? 14 : 9
  }
  return w
}

/**
 * 根据文本内容自适应计算筛选项宽度。
 * extraPadding：图标/箭头等 UI 装饰占位，默认 60px。
 */
export function getAdaptiveWidthStyle(text: unknown, extraPadding = 60) {
  const raw = String(text ?? '').trim() || ' '
  const width = estimateTextWidth(raw) + extraPadding
  return { width: `${width}px`, minWidth: 'unset', flex: `0 0 ${width}px` }
}

/**
 * 下拉/树选择筛选项自适应宽度。
 * - 未选中：按 placeholder 文字宽度显示
 * - 已选中：按已选文字宽度显示 + 激活色
 * value 传入已含前缀的完整显示文字，如 "客户：TEMU店铺"。
 */
export function getAdaptiveSelectStyle(value: unknown, placeholder: string, extraPadding = 60) {
  const text = value ? String(value) : placeholder
  const base = getAdaptiveWidthStyle(text, extraPadding)
  return value ? { ...base, ...ACTIVE_SELECT_STYLE } : base
}

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
  if (val && showLabel) {
    return getAdaptiveWidthStyle(`${prefix}${String(val)}`, 56)
  }
  return getAdaptiveWidthStyle(prefix.replace(/：$/, ''), 56)
}

export function getOrderNoFilterStyle(orderNo: unknown, showLabel: boolean) {
  return getTextFilterStyle('订单号：', orderNo, showLabel)
}

export function getSkuCodeFilterStyle(skuCode: unknown, showLabel: boolean) {
  return getTextFilterStyle('SKU：', skuCode, showLabel)
}

/**
 * 日期区间筛选项自适应宽度。
 * - 未选中：按 placeholder 文字自适应（与其他筛选项视觉一致）
 * - 已选中：固定 320px 显示完整日期区间
 * placeholder 默认 4 字（如"完成时间"），与不传保持相同宽度。
 */
export function getFilterRangeStyle(
  v: [string, string] | [] | null | undefined,
  placeholder = '日期时间',
) {
  const hasValue = Array.isArray(v) && v.length === 2
  if (hasValue) {
    return { width: '320px', minWidth: 'unset', flex: '0 0 320px', ...ACTIVE_SELECT_STYLE }
  }
  return getAdaptiveWidthStyle(placeholder, 60)
}



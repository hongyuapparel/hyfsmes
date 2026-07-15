/** 移入回收站时的原因选项 */
export const ORDER_DELETE_REASON_OPTIONS = [
  { value: 'customer_cancel', label: '客户取消订单' },
  { value: 'duplicate', label: '订单重复' },
  { value: 'wrong_order', label: '下错订单' },
  { value: 'other', label: '其他' },
] as const

export type OrderDeleteReasonValue = (typeof ORDER_DELETE_REASON_OPTIONS)[number]['value']

/** 历史数据或未选原因时的占位文案，回收站 UI 不展示 */
export const GENERIC_ORDER_DELETE_REASON = '移入回收站'

export function getOrderDeleteReasonLabel(value: string): string {
  return ORDER_DELETE_REASON_OPTIONS.find((item) => item.value === value)?.label ?? value
}

export function formatOrderDeleteReason(presetLabel: string, remark?: string): string {
  const note = remark?.trim()
  if (note) return `${presetLabel}：${note}`
  return presetLabel
}

export function isMeaningfulOrderDeleteReason(reason: string | null | undefined): boolean {
  const text = (reason ?? '').trim()
  return text.length > 0 && text !== GENERIC_ORDER_DELETE_REASON
}

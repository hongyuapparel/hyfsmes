export type OrderStatusTagType = 'success' | 'warning' | 'info' | 'danger' | 'primary' | undefined

export function getOrderStatusTagType(status: string): OrderStatusTagType {
  const s = (status ?? '').toLowerCase()
  if (s === 'completed') return 'success'
  if (s === 'draft' || s === 'pending_review') return 'info'
  if (!s) return 'info'
  return 'warning'
}

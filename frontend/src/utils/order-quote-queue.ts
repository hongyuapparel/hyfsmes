import type { OrderListQuery } from '@/api/orders'

export type OrderQuoteQueueQuery = Omit<OrderListQuery, 'unquoted' | 'deletedOnly' | 'page' | 'pageSize'>

const STRING_KEYS = [
  'orderNo',
  'skuCode',
  'customer',
  'processItem',
  'salesperson',
  'merchandiser',
  'orderDateStart',
  'orderDateEnd',
  'completedStart',
  'completedEnd',
  'customerDueStart',
  'customerDueEnd',
  'factory',
  'status',
] as const

const NUMBER_KEYS = ['orderTypeId', 'collaborationTypeId', 'productGroupId'] as const

function sanitizeOrderQuoteQueueQuery(value: unknown): OrderQuoteQueueQuery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const result: OrderQuoteQueueQuery = {}
  STRING_KEYS.forEach((key) => {
    const item = source[key]
    if (typeof item === 'string' && item.trim()) result[key] = item.trim()
  })
  NUMBER_KEYS.forEach((key) => {
    const item = Number(source[key])
    if (Number.isInteger(item) && item > 0) result[key] = item
  })
  return result
}

export function serializeOrderQuoteQueueQuery(query: OrderListQuery): string {
  return JSON.stringify(sanitizeOrderQuoteQueueQuery(query))
}

export function parseOrderQuoteQueueQuery(raw: unknown): OrderQuoteQueueQuery {
  if (typeof raw !== 'string' || !raw.trim()) return {}
  try {
    return sanitizeOrderQuoteQueueQuery(JSON.parse(raw))
  } catch {
    return {}
  }
}

export function normalizeOrderQuoteReturnTo(raw: unknown): string {
  if (typeof raw !== 'string') return '/orders/list?unquoted=1'
  const value = raw.trim()
  if (value === '/orders/list' || value.startsWith('/orders/list?')) return value
  return '/orders/list?unquoted=1'
}

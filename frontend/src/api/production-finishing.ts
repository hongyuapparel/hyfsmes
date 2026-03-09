import request from './request'

export interface FinishingListItem {
  orderId: number
  orderNo: string
  skuCode: string
  arrivedAt: string | null
  completedAt: string | null
  finishingStatus: string
  cutTotal: number | null
  sewingQuantity: number | null
  tailReceivedQty: number | null
  tailShippedQty: number | null
  defectQuantity: number | null
}

export interface FinishingListRes {
  list: FinishingListItem[]
  total: number
  page: number
  pageSize: number
}

export interface FinishingListQuery {
  tab?: string
  orderNo?: string
  skuCode?: string
  page?: number
  pageSize?: number
}

export function getFinishingItems(params?: FinishingListQuery) {
  return request.get<FinishingListRes>('/production/finishing/items', { params })
}

export function registerFinishingPackaging(payload: {
  orderId: number
  tailReceivedQty: number
  defectQuantity: number
}) {
  return request.post<void>('/production/finishing/items/register', payload)
}

export function shipFinishingOrder(orderId: number) {
  return request.post<void>('/production/finishing/items/ship', { orderId })
}

export function inboundFinishingOrder(orderId: number) {
  return request.post<void>('/production/finishing/items/inbound', { orderId })
}

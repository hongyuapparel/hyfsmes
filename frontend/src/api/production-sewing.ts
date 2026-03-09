import request from './request'

export interface SewingListItem {
  orderId: number
  orderNo: string
  skuCode: string
  imageUrl: string
  factoryName: string
  quantity: number
  arrivedAt: string | null
  completedAt: string | null
  sewingStatus: string
  cutTotal: number | null
  sewingQuantity: number | null
  timeRating: string
}

export interface SewingListRes {
  list: SewingListItem[]
  total: number
  page: number
  pageSize: number
}

export interface SewingListQuery {
  tab?: string
  orderNo?: string
  skuCode?: string
  page?: number
  pageSize?: number
}

export function getSewingItems(params?: SewingListQuery) {
  return request.get<SewingListRes>('/production/sewing/items', { params })
}

export function completeSewing(payload: {
  orderId: number
  sewingQuantity: number
  defectQuantity: number
  defectReason: string
}) {
  return request.post<void>('/production/sewing/items/complete', payload)
}

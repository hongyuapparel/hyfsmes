import request from './request'

export interface CraftListItem {
  orderId: number
  orderNo: string
  orderDate: string | null
  skuCode: string
  imageUrl: string
  supplierName: string
  processItem: string
  orderType: string
  collaborationType: string
  purchaseStatus: string
  craftStatus: string
  completedAt: string | null
}

export interface CraftListRes {
  list: CraftListItem[]
  total: number
  page: number
  pageSize: number
}

export interface CraftListQuery {
  tab?: string
  supplier?: string
  processItem?: string
  orderType?: string
  collaborationType?: string
  orderDateStart?: string
  orderDateEnd?: string
  page?: number
  pageSize?: number
}

export function getCraftItems(params?: CraftListQuery) {
  return request.get<CraftListRes>('/production/process/items', { params })
}

export function completeCraft(orderId: number) {
  return request.post<void>('/production/process/items/complete', { orderId })
}

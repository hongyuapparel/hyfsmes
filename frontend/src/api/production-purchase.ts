import request from './request'

export interface PurchaseItemRow {
  orderId: number
  materialIndex: number
  orderNo: string
  orderDate: string | null
  imageUrl: string
  skuCode: string
  orderType: string
  supplierName: string
  materialName: string
  planQuantity: number | null
  actualPurchaseQuantity: number | null
  purchaseAmount: string | null
  purchaseStatus: string
  purchaseCompletedAt: string | null
}

export interface PurchaseListRes {
  list: PurchaseItemRow[]
  total: number
  page: number
  pageSize: number
}

export interface PurchaseListQuery {
  tab?: string
  orderNo?: string
  skuCode?: string
  supplier?: string
  orderType?: string
  orderDateStart?: string
  orderDateEnd?: string
  page?: number
  pageSize?: number
}

export function getPurchaseItems(params?: PurchaseListQuery) {
  return request.get<PurchaseListRes>('/production/purchase/items', { params })
}

export function registerPurchase(payload: {
  orderId: number
  materialIndex: number
  actualPurchaseQuantity: number
  purchaseAmount: string
}) {
  return request.post<void>('/production/purchase/items/register', payload)
}

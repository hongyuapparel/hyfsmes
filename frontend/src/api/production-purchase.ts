import request from './request'

export interface PurchaseItemRow {
  orderId: number
  materialIndex: number
  orderNo: string
  orderDate: string | null
  /** 到待采购状态的时间 */
  pendingPurchaseAt: string | null
  imageUrl: string
  skuCode: string
  /** 订单类型 ID（system_options.id, option_type='order_types'） */
  orderTypeId: number | null
  supplierName: string
  materialTypeId?: number | null
  materialType?: string | null
  materialName: string
  color?: string | null
  planQuantity: number | null
  actualPurchaseQuantity: number | null
  purchaseAmount: string | null
  materialSourceId: number | null
  materialSource: string
  processRoute: 'purchase' | 'picking'
  purchaseStatus: string
  pickStatus: string
  purchaseCompletedAt: string | null
  pickCompletedAt: string | null
  purchaseUnitPrice: string | null
  purchaseOtherCost: string | null
  purchaseRemark: string | null
  purchaseImageUrl: string | null
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
  /** 订单类型 ID */
  orderTypeId?: number
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
  unitPrice: string
  otherCost: string
  remark: string
  imageUrl: string
}) {
  return request.post<void>('/production/purchase/items/register', payload)
}

export function registerPick(payload: {
  orderId: number
  materialIndex: number
  inventorySourceType?: 'fabric' | 'accessory' | 'finished' | null
  inventoryId?: number | null
  quantity?: number | null
  stockBatch?: string | null
  stockColorCode?: string | null
  stockSpec?: string | null
  remark?: string | null
}) {
  return request.post<void>('/production/purchase/items/pick', payload)
}

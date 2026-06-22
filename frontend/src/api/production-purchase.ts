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
  /** 成分（如 100%棉），跟单在订单编辑录入 */
  composition?: string
  /** 克重 / 规格（如 180g/m²），跟单在订单编辑录入 */
  weight?: string
  /** 物料参考图（色卡 / 辅料图），跟单在订单编辑上传 */
  referenceImageUrl?: string | null
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
  /** 统一完成时间（按路线取 采购/领料 完成时间），用于排序与显示 */
  completedAt: string | null
  purchaseUnitPrice: string | null
  purchaseOtherCost: string | null
  purchaseRemark: string | null
  purchaseImageUrl: string | null
  /** 时效判定 */
  timeRating: string
  customerName: string
  merchandiser: string
  customerDueDate: string | null
  orderQuantity: number
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
  completedStart?: string
  completedEnd?: string
  page?: number
  pageSize?: number
  sortField?: string
  sortOrder?: 'asc' | 'desc'
}

export function getPurchaseTabCounts(params?: Omit<PurchaseListQuery, 'tab' | 'page' | 'pageSize'>) {
  // tab-counts 是非关键增强接口，后端缺这条路由（如旧版本未升级）时不应弹全局 toast
  return request.get<Record<string, number>>('/production/purchase/tab-counts', {
    params,
    skipGlobalErrorHandler: true,
  })
}

export function getPurchaseItems(params?: PurchaseListQuery) {
  return request.get<PurchaseListRes>('/production/purchase/items', { params })
}

export function exportPurchaseItems(params?: Omit<PurchaseListQuery, 'page' | 'pageSize'>) {
  return request.get<Blob>('/production/purchase/items/export', {
    params,
    responseType: 'blob',
    skipGlobalErrorHandler: true,
  })
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

export interface RegisterPurchaseBatchItem {
  orderId: number
  materialIndex: number
  supplierName: string
  actualPurchaseQuantity: number
  unitPrice: string
  otherCost: string
  remark?: string
  imageUrl?: string
}

export function registerPurchaseBatch(payload: {
  items: RegisterPurchaseBatchItem[]
}) {
  return request.post<void>('/production/purchase/items/register/batch', payload)
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

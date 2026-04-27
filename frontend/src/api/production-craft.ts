import request from './request'

export interface CraftProcessItemRow {
  processName?: string
  supplierName?: string
  part?: string
  remark?: string
}

export interface CraftListItem {
  orderId: number
  orderNo: string
  /** 到工艺时间：订单进入待工艺状态的时间 */
  arrivedAtCraft: string | null
  /** 工艺完成时间 */
  completedAt: string | null
  orderDate: string | null
  skuCode: string
  imageUrl: string
  supplierName: string
  processItem: string
  /** 订单类型 ID（system_options.id, option_type='order_types'） */
  orderTypeId: number | null
  /** 合作方式 ID（system_options.id, option_type='collaboration'） */
  collaborationTypeId: number | null
  purchaseStatus: string
  craftStatus: string
  /** 时效判定 */
  timeRating: string
  customerName: string
  merchandiser: string
  customerDueDate: string | null
  quantity: number
  processItems: CraftProcessItemRow[]
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
  /** 订单类型 ID */
  orderTypeId?: number
  /** 合作方式 ID */
  collaborationTypeId?: number
  orderDateStart?: string
  orderDateEnd?: string
  completedStart?: string
  completedEnd?: string
  page?: number
  pageSize?: number
}

export function getCraftItems(params?: CraftListQuery) {
  return request.get<CraftListRes>('/production/process/items', { params })
}

export function exportCraftItems(params?: Omit<CraftListQuery, 'page' | 'pageSize'>) {
  return request.get<Blob>('/production/process/items/export', {
    params,
    responseType: 'blob',
    skipGlobalErrorHandler: true,
  })
}

export function completeCraft(orderId: number) {
  return request.post<void>('/production/process/items/complete', { orderId })
}

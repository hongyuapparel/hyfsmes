import request from './request'

export interface FinishingListItem {
  orderId: number
  orderNo: string
  skuCode: string
  imageUrl?: string
  customerName: string
  salesperson: string
  merchandiser: string
  quantity: number
  customerDueDate: string | null
  arrivedAt: string | null
  completedAt: string | null
  finishingStatus: string
  cutTotal: number | null
  sewingQuantity: number | null
  tailReceivedQty: number | null
  tailShippedQty: number | null
  /** 尾部入库数 */
  tailInboundQty: number | null
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

/** 登记包装完成弹窗用：订单/裁床/车缝按尺码（只读） */
export interface FinishingRegisterFormDataRes {
  headers: string[]
  orderRow: (number | null)[]
  cutRow: (number | null)[]
  sewingRow: (number | null)[]
}

export function getFinishingRegisterFormData(orderId: number) {
  return request.get<FinishingRegisterFormDataRes>(
    `/production/finishing/items/${orderId}/register-form-data`,
  )
}

export function exportFinishingItems(params?: Omit<FinishingListQuery, 'page' | 'pageSize'>) {
  return request.get<Blob>('/production/finishing/items/export', {
    params,
    responseType: 'blob',
    skipGlobalErrorHandler: true,
  } as any)
}

export function registerFinishingPackaging(payload: {
  orderId: number
  tailReceivedQty: number
  defectQuantity: number
}) {
  return request.post<void>('/production/finishing/items/register', payload)
}

export function shipFinishingOrder(orderId: number, quantity: number) {
  return request.post<void>('/production/finishing/items/ship', { orderId, quantity })
}

export function inboundFinishingOrder(orderId: number, quantity: number) {
  return request.post<void>('/production/finishing/items/inbound', { orderId, quantity })
}

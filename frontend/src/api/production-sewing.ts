import request from './request'

export interface SewingListItem {
  orderId: number
  orderNo: string
  customerName: string
  salesperson: string
  merchandiser: string
  customerDueDate: string | null
  skuCode: string
  imageUrl: string
  factoryName: string
  quantity: number
  arrivedAt: string | null
  distributedAt: string | null
  factoryDueDate: string | null
  sewingFee: string
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

export function exportSewingItems(params?: Omit<SewingListQuery, 'page' | 'pageSize'>) {
  return request.get<Blob>('/production/sewing/items/export', {
    params,
    responseType: 'blob',
    skipGlobalErrorHandler: true,
  } as any)
}

export function assignSewing(payload: {
  orderId: number
  distributedAt: string
  factoryDueDate: string
  factoryName: string
  sewingFee: string
}) {
  return request.post<void>('/production/sewing/items/assign', payload)
}

/** 登记车缝完成弹窗用：订单数量/裁床数量按尺码（只读） */
export interface CompleteFormDataRes {
  headers: string[]
  orderRow: (number | null)[]
  cutRow: (number | null)[]
}

export function getCompleteFormData(orderId: number) {
  return request.get<CompleteFormDataRes>(`/production/sewing/items/${orderId}/complete-form-data`)
}

export function completeSewing(payload: {
  orderId: number
  sewingQuantity: number
  defectQuantity: number
  defectReason: string
  /** 按尺码车缝数量，与 headers 顺序一致；传则优先于 sewingQuantity */
  sewingQuantities?: number[]
}) {
  return request.post<void>('/production/sewing/items/complete', payload)
}

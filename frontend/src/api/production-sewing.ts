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
  totalQuantity: number
  page: number
  pageSize: number
}

export interface SewingListQuery {
  tab?: string
  orderNo?: string
  skuCode?: string
  completedStart?: string
  completedEnd?: string
  page?: number
  pageSize?: number
}

export function getSewingTabCounts(params?: Omit<SewingListQuery, 'tab' | 'page' | 'pageSize'>) {
  // tab-counts 是非关键增强接口，后端缺这条路由（如旧版本未升级）时不应弹全局 toast
  return request.get<Record<string, number>>('/production/sewing/tab-counts', {
    params,
    skipGlobalErrorHandler: true,
  })
}

export function getSewingItems(params?: SewingListQuery) {
  return request.get<SewingListRes>('/production/sewing/items', { params })
}

export function exportSewingItems(params?: Omit<SewingListQuery, 'page' | 'pageSize'>) {
  return request.get<Blob>('/production/sewing/items/export', {
    params,
    responseType: 'blob',
    skipGlobalErrorHandler: true,
  })
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

/** 登记车缝完成弹窗用：订单/裁床按颜色×尺码（只读） + 聚合行（兼容） */
export interface CompleteFormDataRes {
  headers: string[]
  orderRow: (number | null)[]
  cutRow: (number | null)[]
  // 老后端（commit 521389ba 前）不返回下列三字段，前端在 useSewingDialogs 兜底拉取 color-size-breakdown
  sizeHeaders?: string[]
  orderColorRows?: Array<{ colorName: string; quantities: number[] }>
  cutColorRows?: Array<{ colorName: string; quantities: number[] }>
}

export function getCompleteFormData(orderId: number) {
  return request.get<CompleteFormDataRes>(`/production/sewing/items/${orderId}/complete-form-data`)
}

export function completeSewing(payload: {
  orderId: number
  sewingQuantity: number
  defectQuantity: number
  defectReason: string
  /** 按尺码车缝数量（仅单色或老客户端兜底） */
  sewingQuantities?: number[]
  /** 按颜色×尺码车缝数量真值（多色订单必填） */
  sewingQuantitiesByColor?: Array<{ colorName: string; quantities: number[] }>
}) {
  return request.post<void>('/production/sewing/items/complete', payload)
}

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
  factoryName: string | null
  tailReceivedQty: number | null
  tailShippedQty: number | null
  /** 尾部入库数 */
  tailInboundQty: number | null
  defectQuantity: number | null
  remark: string | null
  /** 时效判定 */
  timeRating: string
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
  tailReceivedRow: (number | null)[]
  /** 已登记入库按尺码（与 headers 对齐，无明细时为 null） */
  tailInboundRow: (number | null)[] | null
  /** 已登记次品按尺码（与 headers 对齐，无明细时为 null） */
  defectRow: (number | null)[] | null
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

/** 待尾部：登记收货（仅收货数量） */
export function registerFinishingReceive(payload: {
  orderId: number
  tailReceivedQty: number
  tailReceivedQuantities?: number[]
}) {
  return request.post<void>('/production/finishing/items/register-receive', payload)
}

/** 尾部：登记包装完成（发货数、入库数、次品数、备注，三者之和=尾部收货数） */
export function registerFinishingPackagingComplete(payload: {
  orderId: number
  tailShippedQty: number
  tailInboundQty: number
  defectQuantity: number
  remark?: string
  /** 与登记弹窗尺码列一致（不含合计列），有 DB 列时后端会持久化 */
  tailInboundQuantities?: number[]
  defectQuantities?: number[]
}) {
  return request.post<void>('/production/finishing/items/register-packaging-complete', payload)
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

/** 财务审批通过：等待发货且已分配完毕时，订单完成 */
export function financeApproveFinishingOrder(orderId: number) {
  return request.post<void>(`/production/finishing/items/${orderId}/finance-approve`)
}

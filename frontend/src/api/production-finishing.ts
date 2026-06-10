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
  totalQuantity: number
  page: number
  pageSize: number
}

export interface FinishingListQuery {
  tab?: string
  orderNo?: string
  skuCode?: string
  completedStart?: string
  completedEnd?: string
  page?: number
  pageSize?: number
}

export function getFinishingTabCounts(params?: Omit<FinishingListQuery, 'tab' | 'page' | 'pageSize'>) {
  // tab-counts 是非关键增强接口，后端缺这条路由（如旧版本未升级）时不应弹全局 toast
  return request.get<Record<string, number>>('/production/finishing/tab-counts', {
    params,
    skipGlobalErrorHandler: true,
  })
}

export function getFinishingItems(params?: FinishingListQuery) {
  return request.get<FinishingListRes>('/production/finishing/items', { params })
}

/** 登记包装完成弹窗用：订单/裁床/车缝按尺码（只读）+ 按颜色×尺码二维 */
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
  /** 不含合计列的尺码 headers，用于二维矩阵 */
  sizeHeaders: string[]
  planColorRows: Array<{ colorName: string; quantities: number[]; imageUrl?: string }>
  cutColorRows: Array<{ colorName: string; quantities: number[] }>
  sewingColorRows: Array<{ colorName: string; quantities: number[] }>
  tailReceivedColorRows: Array<{ colorName: string; quantities: number[] }>
  tailInboundColorRows: Array<{ colorName: string; quantities: number[] }>
  defectColorRows: Array<{ colorName: string; quantities: number[] }>
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
  })
}

/** 待尾部：登记收货（仅收货数量；按颜色×尺码为真值） */
export function registerFinishingReceive(payload: {
  orderId: number
  tailReceivedQty: number
  tailReceivedQuantities?: number[]
  tailReceivedQuantitiesByColor?: Array<{ colorName: string; quantities: number[] }>
}) {
  return request.post<void>('/production/finishing/items/register-receive', payload)
}

/** 尾部：登记包装完成（入库数、次品数、备注；mode 区分分批/完结） */
export interface RegisterFinishingPackagingCompletePayload {
  orderId: number
  /** partial=分批入库；full=本次入库后完结 */
  mode: 'partial' | 'full'
  tailInboundQty: number
  defectQuantity: number
  remark?: string
  /** 一维尺码兜底（旧客户端） */
  tailInboundQuantities?: number[]
  defectQuantities?: number[]
  /** 按颜色×尺码真值（多色订单必填） */
  tailInboundQuantitiesByColor?: Array<{ colorName: string; quantities: number[] }>
  defectQuantitiesByColor?: Array<{ colorName: string; quantities: number[] }>
}

export function registerFinishingPackagingComplete(payload: RegisterFinishingPackagingCompletePayload) {
  return request.post<void>('/production/finishing/items/register-packaging-complete', payload)
}

export function registerFinishingPackaging(payload: {
  orderId: number
  tailReceivedQty: number
  defectQuantity: number
}) {
  return request.post<void>('/production/finishing/items/register', payload)
}

export function inboundFinishingOrder(orderId: number, quantity: number) {
  return request.post<void>('/production/finishing/items/inbound', { orderId, quantity })
}

/** 尾部分批事件类型：收货 / 入库 / 出库 */
export type FinishingBatchEventType = 'receive' | 'inbound' | 'outbound'

/** 尾部分批事件时间线条目 */
export interface FinishingBatchEvent {
  type: FinishingBatchEventType
  batchNo: number | null
  quantity: number
  sourceType: 'normal' | 'defect' | null
  operatorUsername: string
  pickupUserName: string
  remark: string
  occurredAt: string
}

/** 获取某订单的尾部分批事件时间线（倒序） */
export function getFinishingBatches(orderId: number) {
  return request.get<FinishingBatchEvent[]>(`/production/finishing/items/${orderId}/batches`)
}

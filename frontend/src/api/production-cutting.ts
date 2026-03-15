import request from './request'

export interface CuttingListItem {
  orderId: number
  orderNo: string
  customerName: string
  salesperson: string
  merchandiser: string
  customerDueDate: string | null
  skuCode: string
  quantity: number
  imageUrl?: string
  arrivedAt: string | null
  completedAt: string | null
  cuttingStatus: string
  actualCutTotal: number | null
  cuttingCost: string | null
  timeRating: string
}

export interface CuttingListRes {
  list: CuttingListItem[]
  total: number
  page: number
  pageSize: number
}

export interface CuttingListQuery {
  tab?: string
  orderNo?: string
  skuCode?: string
  page?: number
  pageSize?: number
}

export function getCuttingItems(params?: CuttingListQuery) {
  return request.get<CuttingListRes>('/production/cutting/items', { params })
}

export function exportCuttingItems(params?: Omit<CuttingListQuery, 'page' | 'pageSize'>) {
  return request.get<Blob>('/production/cutting/items/export', {
    params,
    responseType: 'blob',
    skipGlobalErrorHandler: true,
  } as any)
}

export interface ColorSizeRow {
  colorName: string
  quantities: number[]
  remark?: string
}

export function getOrderColorSize(orderId: number) {
  return request.get<{ colorSizeHeaders: string[]; colorSizeRows: ColorSizeRow[] }>(
    `/production/cutting/items/${orderId}/color-size`,
  )
}

/** 裁床列表用：订单数量/实裁数量按尺码明细（与订单列表数量追踪同结构） */
export interface CuttingQuantityBreakdownRes {
  headers: string[]
  rows: Array<{ label: string; values: (number | null)[] }>
}

export function getCuttingQuantityBreakdown(orderId: number) {
  return request.get<CuttingQuantityBreakdownRes>(
    `/production/cutting/items/${orderId}/quantity-breakdown`,
  )
}

export function completeCutting(payload: {
  orderId: number
  cuttingCost: string
  actualCutRows: { colorName?: string; quantities?: number[]; remark?: string }[]
}) {
  return request.post<void>('/production/cutting/items/complete', payload)
}

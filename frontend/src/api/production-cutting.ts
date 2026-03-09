import request from './request'

export interface CuttingListItem {
  orderId: number
  orderNo: string
  skuCode: string
  quantity: number
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

export function completeCutting(payload: {
  orderId: number
  cuttingCost: string
  actualCutRows: { colorName?: string; quantities?: number[]; remark?: string }[]
}) {
  return request.post<void>('/production/cutting/items/complete', payload)
}

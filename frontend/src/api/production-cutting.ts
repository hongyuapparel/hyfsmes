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
  /** 裁剪总成本（元） */
  cuttingCost: string | null
  /** 裁剪单价（元/件），新数据可能有值 */
  cuttingUnitPrice?: string | null
  /** 本次实际净耗合计（米） */
  actualFabricMeters?: string | null
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

export interface CuttingRegisterOrderBrief {
  orderNo: string
  skuCode: string
  quantity: number
  customerName: string
  orderDate: string | null
}

export interface CuttingMaterialUsagePayloadRow {
  rowKey: string
  materialTypeId?: number | null
  categoryLabel: string
  materialName: string
  colorSpec: string
  expectedUsagePerPiece: number | null
  issuedMeters: number
  returnedMeters: number
  abnormalLossMeters: number
  abnormalReason: string | null
  remark: string
}

export interface CuttingRegisterFormRes {
  orderBrief: CuttingRegisterOrderBrief
  colorSizeHeaders: string[]
  colorSizeRows: ColorSizeRow[]
  materialUsageRows: CuttingMaterialUsagePayloadRow[]
}

export function getCuttingRegisterForm(orderId: number) {
  return request.get<CuttingRegisterFormRes>(`/production/cutting/items/${orderId}/register-form`)
}

export function getOrderColorSize(orderId: number) {
  return request.get<{ colorSizeHeaders: string[]; colorSizeRows: ColorSizeRow[] }>(
    `/production/cutting/items/${orderId}/color-size`,
  )
}

export interface CuttingQuantityBreakdownRes {
  headers: string[]
  rows: Array<{ label: string; values: (number | null)[] }>
}

export function getCuttingQuantityBreakdown(orderId: number) {
  return request.get<CuttingQuantityBreakdownRes>(
    `/production/cutting/items/${orderId}/quantity-breakdown`,
  )
}

/** 裁床已完成：抽屉详情（与后端 CuttingCompletedDetailResponse 一致） */
export interface CuttingCompletedDetailRes {
  orderBrief: CuttingRegisterOrderBrief
  colorSizeHeaders: string[]
  actualCutRows: ColorSizeRow[]
  materialUsageRows: CuttingMaterialUsagePayloadRow[]
  cuttingDepartment: string | null
  cutterName: string | null
  cuttingUnitPrice: string | null
  cuttingTotalCost: string | null
  cuttingCost: string | null
  actualFabricMeters: string | null
  arrivedAt: string | null
  completedAt: string | null
}

export function getCuttingCompletedDetail(orderId: number) {
  return request.get<CuttingCompletedDetailRes>(`/production/cutting/items/${orderId}/completed-detail`)
}

export function completeCutting(payload: {
  orderId: number
  actualCutRows: { colorName?: string; quantities?: number[]; remark?: string }[]
  cuttingDepartment?: string | null
  cutterName?: string | null
  cuttingUnitPrice?: string | null
  cuttingTotalCost?: string | null
  /** 兼容旧前端 */
  cuttingCost?: string | null
  materialUsage?: CuttingMaterialUsagePayloadRow[]
}) {
  return request.post<void>('/production/cutting/items/complete', payload)
}

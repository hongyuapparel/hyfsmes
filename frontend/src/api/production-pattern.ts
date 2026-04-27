import request from './request'
import type { AxiosRequestConfig } from 'axios'

export interface PatternListItem {
  orderId: number
  orderNo: string
  customerName: string
  salesperson: string
  merchandiser: string
  quantity: number
  /** 到纸样时间：订单进入待纸样状态的时间 */
  arrivedAtPattern: string | null
  /** 纸样完成时间 */
  completedAt: string | null
  orderDate: string | null
  customerDueDate: string | null
  skuCode: string
  imageUrl: string
  /** 订单类型 ID（system_options.id, option_type='order_types'） */
  orderTypeId: number | null
  /** 合作方式 ID（system_options.id, option_type='collaboration'） */
  collaborationTypeId: number | null
  purchaseStatus: string
  patternStatus: string
  patternMaster: string
  sampleMaker: string
  sampleImageUrl: string
  /** 时效判定 */
  timeRating: string
}

export interface PatternListRes {
  list: PatternListItem[]
  total: number
  page: number
  pageSize: number
}

export interface PatternListQuery {
  tab?: string
  orderNo?: string
  skuCode?: string
  /** 订单类型 ID */
  orderTypeId?: number
  /** 合作方式 ID */
  collaborationTypeId?: number
  purchaseStatus?: string
  orderDateStart?: string
  orderDateEnd?: string
  completedStart?: string
  completedEnd?: string
  page?: number
  pageSize?: number
}

export function getPatternItems(params?: PatternListQuery, config?: AxiosRequestConfig) {
  return request.get<PatternListRes>('/production/pattern/items', { params, ...(config ?? {}) })
}

export function exportPatternItems(params?: Omit<PatternListQuery, 'page' | 'pageSize'>) {
  return request.get<Blob>('/production/pattern/items/export', {
    params,
    responseType: 'blob',
    // 导出失败时由调用方自行提示
    skipGlobalErrorHandler: true,
  })
}

export function assignPattern(payload: {
  orderId: number
  patternMaster: string
  sampleMaker: string
}) {
  return request.post<void>('/production/pattern/items/assign', payload)
}

export function completePattern(payload: { orderId: number; sampleImageUrl: string }) {
  return request.post<void>('/production/pattern/items/complete', payload)
}

export interface PatternMaterialRow {
  materialTypeId?: number | null
  materialName?: string
  fabricWidth?: string
  usagePerPiece?: number | null
  cuttingQuantity?: number | null
  remark?: string
}

export interface PatternMaterialsRes {
  materials: PatternMaterialRow[]
  remark: string | null
}

export function getPatternMaterials(orderId: number) {
  return request.get<PatternMaterialsRes>(`/production/pattern/items/${orderId}/materials`)
}

export function savePatternMaterials(orderId: number, payload: { materials: PatternMaterialRow[]; remark?: string | null }) {
  return request.post<void>(`/production/pattern/items/${orderId}/materials`, payload)
}

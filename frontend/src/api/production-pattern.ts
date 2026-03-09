import request from './request'

export interface PatternListItem {
  orderId: number
  orderNo: string
  orderDate: string | null
  skuCode: string
  imageUrl: string
  orderType: string
  collaborationType: string
  purchaseStatus: string
  patternStatus: string
  patternMaster: string
  sampleMaker: string
  completedAt: string | null
  sampleImageUrl: string
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
  orderType?: string
  collaborationType?: string
  purchaseStatus?: string
  orderDateStart?: string
  orderDateEnd?: string
  page?: number
  pageSize?: number
}

export function getPatternItems(params?: PatternListQuery) {
  return request.get<PatternListRes>('/production/pattern/items', { params })
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

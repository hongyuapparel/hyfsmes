import request from './request'

export interface PatternListItem {
  orderId: number
  orderNo: string
  customerName: string
  salesperson: string
  merchandiser: string
  quantity: number
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
  /** 订单类型 ID */
  orderTypeId?: number
  /** 合作方式 ID */
  collaborationTypeId?: number
  purchaseStatus?: string
  orderDateStart?: string
  orderDateEnd?: string
  page?: number
  pageSize?: number
}

export function getPatternItems(params?: PatternListQuery) {
  return request.get<PatternListRes>('/production/pattern/items', { params })
}

export function exportPatternItems(params?: Omit<PatternListQuery, 'page' | 'pageSize'>) {
  return request.get<Blob>('/production/pattern/items/export', {
    params,
    responseType: 'blob',
    // 导出失败时由调用方自行提示
    skipGlobalErrorHandler: true,
  } as any)
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

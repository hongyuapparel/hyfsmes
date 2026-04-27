import request from './request'

export interface PendingInboundItem {
  orderId: number
  orderNo: string
  skuCode: string
  quantity: number
}

export interface PendingInboundRes {
  list: PendingInboundItem[]
  total: number
  page: number
  pageSize: number
}

export interface PendingInboundQuery {
  orderNo?: string
  skuCode?: string
  page?: number
  pageSize?: number
}

export function getPendingInboundList(params?: PendingInboundQuery) {
  return request.get<PendingInboundRes>('/inventory/pending/items', { params })
}

export function submitPendingInbound(payload: {
  orderId: number
  warehouse: string
  department: string
  location: string
}) {
  return request.post<void>('/inventory/pending/inbound', payload)
}

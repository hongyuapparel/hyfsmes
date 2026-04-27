import request from './request'

export interface FinishedGoodsItem {
  id: number
  orderId: number
  orderNo: string
  skuCode: string
  quantity: number
  warehouse: string
  department: string
  location: string
  inboundAt: string | null
  tabType: 'pending' | 'inbound'
}

export interface FinishedGoodsRes {
  list: FinishedGoodsItem[]
  total: number
  page: number
  pageSize: number
}

export interface FinishedGoodsQuery {
  tab?: string
  orderNo?: string
  skuCode?: string
  page?: number
  pageSize?: number
}

export function getFinishedGoodsList(params?: FinishedGoodsQuery) {
  return request.get<FinishedGoodsRes>('/inventory/finished/items', { params })
}

export function outboundFinishedGoods(payload: { stockId: number; quantity: number }) {
  return request.patch<void>('/inventory/finished/items/outbound', payload)
}

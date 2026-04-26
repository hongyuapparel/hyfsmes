import request from './request'
import type { FinishedPickupUserOption } from './inventory-finished'

/** 待入库 */
export interface PendingListItem {
  id: number
  tabType?: 'pending' | 'shipped'
  orderId: number
  orderNo: string
  customerName: string
  skuCode: string
  imageUrl?: string
  quantity: number
  sourceType?: 'normal' | 'defect'
  pickupUserName?: string
  operatorUsername?: string
  remark?: string
  createdAt: string
}

export function getPendingList(params?: {
  tab?: 'pending' | 'shipped'
  orderNo?: string
  skuCode?: string
  page?: number
  pageSize?: number
}) {
  return request.get<{ list: PendingListItem[]; total: number; page: number; pageSize: number }>(
    '/inventory/pending/items',
    { params }
  )
}

export function doPendingInbound(body: {
  ids: number[]
  warehouseId: number | null
  inventoryTypeId?: number | null
  department: string
  location: string
  imageUrl?: string
}) {
  return request.post<void>('/inventory/pending/inbound', body)
}

export function doPendingOutbound(body: {
  items: Array<{
    id: number
    quantity: number
    sizeBreakdown?: {
      headers: string[]
      rows: Array<{ colorName: string; quantities: number[] }>
    } | null
  }>
  pickupUserId?: number | null
}) {
  return request.post<void>('/inventory/pending/outbound', body)
}

export function getPendingPickupUserOptions() {
  return request.get<FinishedPickupUserOption[]>('/inventory/pending/pickup-users')
}
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

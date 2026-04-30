import request from './request'
import type { AxiosRequestConfig } from 'axios'
import { buildSharedGetKey, sharedGet } from './shared-request-cache'

/** 成品库存快照结构（调整日志 before/after 字段） */
export interface FinishedStockSnapshot {
  headers: string[]
  rows: Array<{ colorName: string; values: number[] }>
}

/** 成品库存（含待入库/已入库） */
export interface FinishedStockRow {
  id: number
  orderId: number | null
  orderNo: string
  customerName?: string
  skuCode: string
  quantity: number
  unitPrice?: string
  warehouseId: number | null
  inventoryTypeId: number | null
  department: string
  location: string
  productImageUrl?: string
  imageUrl?: string
  createdAt: string
  type: 'pending' | 'stored'
  /** 手动入库快照：列表数量悬停展示，结构与订单 color-size-breakdown 一致 */
  sizeBreakdown?: {
    headers: string[]
    rows: Array<{ colorName: string; values: number[] }>
  } | null
  colorImages?: Array<{ colorName: string; imageUrl: string }>
}

export function getFinishedStockList(params?: {
  tab?: string
  orderNo?: string
  skuCode?: string
  customerName?: string
  inventoryTypeId?: number | null
  /** 入库时间：按记录 created_at，YYYY-MM-DD */
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
  paginateByVisibleGroup?: boolean
}, config?: AxiosRequestConfig) {
  return request.get<{
    list: FinishedStockRow[]
    total: number
    page: number
    pageSize: number
    /** 当前筛选条件下全部匹配记录的总件数（非仅本页） */
    totalQuantity: number
    /** 当前筛选条件下全部匹配记录的总金额（非仅本页） */
    totalAmount: number
  }>('/inventory/finished/items', { params, ...(config ?? {}) })
}

export function finishedOutbound(body: {
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
  return request.post<void>('/inventory/finished/outbound', body)
}

export interface FinishedPickupUserOption {
  id: number
  username: string
  displayName: string
}

export function getFinishedPickupUserOptions() {
  const key = buildSharedGetKey('/inventory/finished/pickup-users')
  return sharedGet(
    key,
    () => request.get<FinishedPickupUserOption[]>('/inventory/finished/pickup-users'),
    { ttlMs: 30000 },
  )
}

export interface FinishedStockDetailRes {
  stock: FinishedStockRow
  orderNo: string
  productImageUrl: string
  colorImages: Array<{ colorName: string; imageUrl: string; updatedAt: string }>
  adjustLogs: Array<{
    id: number
    operatorUsername: string
    before: FinishedStockSnapshot | null
    after: FinishedStockSnapshot | null
    remark: string
    createdAt: string
  }>
  colorSize: {
    headers: string[]
    colors: string[]
    rows: Array<{ colorName: string; quantities: number[] }>
  }
}

export function getFinishedStockDetail(id: number) {
  return request.get<FinishedStockDetailRes>(`/inventory/finished/items/${id}`)
}

export function updateFinishedStockMeta(
  id: number,
  body: {
    department?: string
    inventoryTypeId?: number | null
    warehouseId?: number | null
    location?: string
    unitPrice?: string
    imageUrl?: string
    remark?: string
  }
) {
  return request.patch<FinishedStockRow>(`/inventory/finished/items/${id}`, body)
}

export function upsertFinishedStockColorImage(
  id: number,
  body: { colorName: string; imageUrl: string }
) {
  return request.put<void>(`/inventory/finished/items/${id}/color-images`, body)
}

export interface FinishedOutboundRecord {
  id: number
  finishedStockId: number
  orderId: number | null
  orderNo: string
  skuCode: string
  customerName: string
  quantity: number
  department: string
  warehouseId: number | null
  inventoryTypeId: number | null
  pickupUserId?: number | null
  pickupUserName?: string
  sizeBreakdown?: {
    headers: string[]
    rows: Array<{ colorName: string; quantities: number[] }>
  } | null
  operatorUsername: string
  remark: string
  createdAt: string
  imageUrl?: string
}

export function getFinishedOutboundRecords(params?: {
  orderNo?: string
  skuCode?: string
  customerName?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}) {
  return request.get<{ list: FinishedOutboundRecord[]; total: number; page: number; pageSize: number }>(
    '/inventory/finished/outbounds',
    { params }
  )
}

export function createFinishedStock(body: {
  orderNo?: string
  skuCode: string
  quantity: number
  unitPrice?: string | number
  warehouseId: number | null
  inventoryTypeId?: number | null
  department: string
  location: string
  imageUrl?: string
  remark?: string
  colorSize?: {
    headers: string[]
    rows: Array<{ colorName: string; imageUrl?: string; quantities: number[] }>
  }
}) {
  return request.post<FinishedStockRow>('/inventory/finished/items', body)
}
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

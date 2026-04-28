import request from './request'
import type { AxiosRequestConfig } from 'axios'

/** 辅料 */
export interface AccessoryItem {
  id: number
  name: string
  category: string
  quantity: number
  unit: string
  remark: string
  customerName?: string
  salesperson?: string
  imageUrl?: string
  createdAt: string
}

export function getAccessoriesList(params?: {
  name?: string
  category?: string
  customerName?: string
  salesperson?: string
  /** 入库时间：created_at，YYYY-MM-DD */
  startDate?: string
  endDate?: string
  skipTotal?: boolean
  page?: number
  pageSize?: number
}, config?: AxiosRequestConfig) {
  return request.get<{ list: AccessoryItem[]; total: number; page: number; pageSize: number }>(
    '/inventory/accessories/items',
    { params, ...(config ?? {}) }
  )
}

export function getAccessoryOne(id: number) {
  return request.get<AccessoryItem>(`/inventory/accessories/items/${id}`)
}

export function createAccessory(body: {
  name: string
  category?: string
  quantity?: number
  unit?: string
  customerName?: string
  salesperson: string
  remark?: string
  imageUrl?: string
}) {
  return request.post<AccessoryItem>('/inventory/accessories/items', body)
}

export function updateAccessory(
  id: number,
  body: {
    name?: string
    category?: string
    quantity?: number
    unit?: string
    customerName?: string
    salesperson?: string
    remark?: string
    imageUrl?: string
  }
) {
  return request.put<AccessoryItem>(`/inventory/accessories/items/${id}`, body)
}

export function deleteAccessory(id: number) {
  return request.delete<void>(`/inventory/accessories/items/${id}`)
}

export interface AccessoryOutboundUserOption {
  id: number
  username: string
  displayName: string
}

export function getAccessoryOutboundUserOptions() {
  return request.get<AccessoryOutboundUserOption[]>('/inventory/accessories/user-options')
}

export function manualAccessoryOutbound(body: {
  accessoryId: number
  quantity: number
  remark: string
}) {
  return request.post<void>('/inventory/accessories/outbounds', body)
}

export interface AccessoryOutboundRecord {
  id: number
  accessoryId: number
  orderId: number | null
  orderNo: string
  imageUrl?: string
  customerName?: string
  category?: string
  outboundType: string
  quantity: number
  beforeQuantity: number
  afterQuantity: number
  operatorUsername: string
  remark: string
  createdAt: string
}

export interface AccessoryOperationLog {
  id: number
  accessoryId: number
  operatorUsername: string
  action: string
  beforeSnapshot: Record<string, unknown> | null
  afterSnapshot: Record<string, unknown> | null
  remark: string
  createdAt: string
}

export function getAccessoryOutboundRecords(params?: {
  accessoryId?: number
  orderNo?: string
  outboundType?: string
  page?: number
  pageSize?: number
}) {
  return request.get<{ list: AccessoryOutboundRecord[]; total: number; page: number; pageSize: number }>(
    '/inventory/accessories/outbounds',
    { params }
  )
}

export function getAccessoryOperationLogs(id: number) {
  return request.get<AccessoryOperationLog[]>(`/inventory/accessories/items/${id}/logs`)
}

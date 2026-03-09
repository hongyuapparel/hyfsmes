import request from './request'

/** 待入库 */
export interface PendingListItem {
  id: number
  orderId: number
  orderNo: string
  skuCode: string
  quantity: number
  createdAt: string
}

export function getPendingList(params?: {
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
  warehouse: string
  department: string
  location: string
  imageUrl?: string
}) {
  return request.post<void>('/inventory/pending/inbound', body)
}

/** 成品库存（含待入库/已入库） */
export interface FinishedStockRow {
  id: number
  orderId: number
  orderNo: string
  skuCode: string
  quantity: number
  warehouse: string
  department: string
  location: string
  createdAt: string
  type: 'pending' | 'stored'
}

export function getFinishedStockList(params?: {
  tab?: string
  orderNo?: string
  skuCode?: string
  page?: number
  pageSize?: number
}) {
  return request.get<{
    list: FinishedStockRow[]
    total: number
    page: number
    pageSize: number
  }>('/inventory/finished/items', { params })
}

export function finishedOutbound(id: number, quantity: number) {
  return request.post<void>('/inventory/finished/outbound', { id, quantity })
}

/** 辅料 */
export interface AccessoryItem {
  id: number
  name: string
  category: string
  quantity: number
  unit: string
  remark: string
  imageUrl?: string
  createdAt: string
}

export function getAccessoriesList(params?: {
  name?: string
  category?: string
  page?: number
  pageSize?: number
}) {
  return request.get<{ list: AccessoryItem[]; total: number; page: number; pageSize: number }>(
    '/inventory/accessories/items',
    { params }
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
  remark?: string
  imageUrl?: string
}) {
  return request.post<AccessoryItem>('/inventory/accessories/items', body)
}

export function updateAccessory(
  id: number,
  body: { name?: string; category?: string; quantity?: number; unit?: string; remark?: string; imageUrl?: string }
) {
  return request.put<AccessoryItem>(`/inventory/accessories/items/${id}`, body)
}

export function deleteAccessory(id: number) {
  return request.delete<void>(`/inventory/accessories/items/${id}`)
}

/** 面料 */
export interface FabricItem {
  id: number
  name: string
  quantity: string
  unit: string
  remark: string
  imageUrl?: string
  createdAt: string
}

export function getFabricList(params?: { name?: string; page?: number; pageSize?: number }) {
  return request.get<{ list: FabricItem[]; total: number; page: number; pageSize: number }>(
    '/inventory/fabric/items',
    { params }
  )
}

export function getFabricOne(id: number) {
  return request.get<FabricItem>(`/inventory/fabric/items/${id}`)
}

export function createFabric(body: {
  name: string
  quantity?: number
  unit?: string
  remark?: string
  imageUrl?: string
}) {
  return request.post<FabricItem>('/inventory/fabric/items', body)
}

export function updateFabric(
  id: number,
  body: { name?: string; quantity?: number; unit?: string; remark?: string; imageUrl?: string }
) {
  return request.put<FabricItem>(`/inventory/fabric/items/${id}`, body)
}

export function deleteFabric(id: number) {
  return request.delete<void>(`/inventory/fabric/items/${id}`)
}

export function fabricOutbound(body: {
  id: number
  quantity: number
  photoUrl: string
  remark: string
}) {
  return request.post<void>('/inventory/fabric/outbound', body)
}

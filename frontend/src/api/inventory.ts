import request from './request'

/** 待入库 */
export interface PendingListItem {
  id: number
  orderId: number
  orderNo: string
  customerName: string
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
  warehouseId: number | null
  inventoryTypeId?: number | null
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
  customerName: string
  skuCode: string
  quantity: number
  warehouseId: number | null
  inventoryTypeId: number | null
  department: string
  location: string
  createdAt: string
  type: 'pending' | 'stored'
}

export function getFinishedStockList(params?: {
  tab?: string
  orderNo?: string
  skuCode?: string
  customerName?: string
  inventoryTypeId?: number | null
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

export interface FinishedOutboundRecord {
  id: number
  finishedStockId: number
  orderId: number
  orderNo: string
  skuCode: string
  customerName: string
  quantity: number
  operatorUsername: string
  remark: string
  createdAt: string
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
  orderNo: string
  skuCode: string
  quantity: number
  warehouseId: number | null
  inventoryTypeId?: number | null
  department: string
  location: string
  imageUrl?: string
}) {
  return request.post<FinishedStockRow>('/inventory/finished/items', body)
}

/** 辅料 */
export interface AccessoryItem {
  id: number
  name: string
  category: string
  quantity: number
  unit: string
  remark: string
  customerName?: string
  imageUrl?: string
  createdAt: string
}

export function getAccessoriesList(params?: {
  name?: string
  category?: string
  customerName?: string
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
  outboundType: string
  quantity: number
  beforeQuantity: number
  afterQuantity: number
  operatorUsername: string
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

/** 面料 */
export interface FabricItem {
  id: number
  name: string
  quantity: string
  unit: string
  remark: string
  customerName?: string
  imageUrl?: string
  createdAt: string
}

export function getFabricList(params?: {
  name?: string
  customerName?: string
  page?: number
  pageSize?: number
}) {
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

export interface FabricOutboundRecord {
  id: number
  fabricStockId: number
  name: string
  customerName: string
  unit: string
  quantity: string
  photoUrl: string
  remark: string
  createdAt: string
}

export function getFabricOutboundRecords(params?: {
  name?: string
  customerName?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}) {
  return request.get<{ list: FabricOutboundRecord[]; total: number; page: number; pageSize: number }>(
    '/inventory/fabric/outbounds',
    { params }
  )
}

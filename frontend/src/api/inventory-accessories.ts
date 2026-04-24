import request from './request'

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
  supplierId?: number | null
  warehouseId?: number | null
  storageLocation?: string
  /** 仅展示：由 supplierId 解析 */
  supplierName?: string
  /** 仅展示：由 warehouseId 解析 */
  warehouseLabel?: string
}

export interface FabricSupplierOption {
  id: number
  name: string
}

export interface FabricPickupUserOption {
  id: number
  username: string
  displayName: string
}

export function getFabricSupplierOptions() {
  return request.get<FabricSupplierOption[]>('/inventory/fabric/supplier-options')
}

export function getFabricPickupUserOptions() {
  return request.get<FabricPickupUserOption[]>('/inventory/fabric/pickup-users')
}

export function getFabricList(params?: {
  name?: string
  customerName?: string
  /** 入库时间：created_at，YYYY-MM-DD */
  startDate?: string
  endDate?: string
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
  customerName?: string
  remark?: string
  imageUrl?: string
  supplierId?: number | null
  warehouseId?: number | null
  storageLocation?: string
}) {
  return request.post<FabricItem>('/inventory/fabric/items', body)
}

export function updateFabric(
  id: number,
  body: {
    name?: string
    quantity?: number
    unit?: string
    customerName?: string
    remark?: string
    imageUrl?: string
    supplierId?: number | null
    warehouseId?: number | null
    storageLocation?: string
  }
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
  pickupUserId: number
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
  pickupUserId?: number | null
  /** 仅展示 */
  pickupUserName?: string
  createdAt: string
}

export interface FabricOperationLog {
  id: number
  fabricStockId: number
  operatorUsername: string
  action: string
  beforeSnapshot: Record<string, unknown> | null
  afterSnapshot: Record<string, unknown> | null
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

export function getFabricOperationLogs(id: number) {
  return request.get<FabricOperationLog[]>(`/inventory/fabric/items/${id}/logs`)
}
import request from './request'

export interface AccessoriesStockItem {
  id: number
  name: string
  category: string
  quantity: number
  unit: string
  remark: string
  createdAt: string
  updatedAt: string
}

export interface AccessoriesListRes {
  list: AccessoriesStockItem[]
  total: number
  page: number
  pageSize: number
}

export function getAccessoriesList(params?: {
  name?: string
  category?: string
  page?: number
  pageSize?: number
}) {
  return request.get<AccessoriesListRes>('/inventory/accessories/items', { params })
}

export function getAccessoriesOne(id: number) {
  return request.get<AccessoriesStockItem>(`/inventory/accessories/items/${id}`)
}

export function createAccessories(data: {
  name: string
  category?: string
  quantity?: number
  unit?: string
  remark?: string
}) {
  return request.post<AccessoriesStockItem>('/inventory/accessories/items', data)
}

export function updateAccessories(
  id: number,
  data: {
    name?: string
    category?: string
    quantity?: number
    unit?: string
    remark?: string
  },
) {
  return request.put<AccessoriesStockItem>(`/inventory/accessories/items/${id}`, data)
}

export function deleteAccessories(id: number) {
  return request.delete<void>(`/inventory/accessories/items/${id}`)
}

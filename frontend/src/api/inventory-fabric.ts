import request from './request'

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

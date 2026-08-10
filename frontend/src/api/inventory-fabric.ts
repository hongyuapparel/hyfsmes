import request from './request'
import type { AxiosRequestConfig } from 'axios'

/** 面料 */
export interface FabricItem {
  id: number
  name: string
  quantity: string
  unit: string
  /** null 表示暂未计价，0 表示真实零成本 */
  unitPrice: string | null
  amount: string | null
  remark: string
  customerName?: string
  imageUrl?: string
  createdAt: string
  supplierId?: number | null
  warehouseId?: number | null
  inventoryTypeId?: number | null
  storageLocation?: string
  /** 仅展示：由 supplierId 解析 */
  supplierName?: string
  /** 仅展示：由 warehouseId 解析 */
  warehouseLabel?: string
  /** 仅展示：由 inventoryTypeId 解析 */
  inventoryTypeLabel?: string
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
  inventoryTypeId?: number | null
  skipTotal?: boolean
  sortField?: 'quantity' | 'unitPrice' | 'amount'
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}, config?: AxiosRequestConfig) {
  return request.get<{
    list: FabricItem[]
    total: number
    totalQuantity: number
    totalAmount: number
    unpricedCount: number
    unpricedQuantity: number
    page: number
    pageSize: number
  }>(
    '/inventory/fabric/items',
    { params, ...(config ?? {}) }
  )
}

export type FabricStockExportParams = {
  mode: 'selected' | 'filtered'
  name?: string
  customerName?: string
  inventoryTypeId?: number
  startDate?: string
  endDate?: string
  selectedIds?: number[]
  sortField?: 'quantity' | 'unitPrice' | 'amount'
  sortOrder?: 'asc' | 'desc'
}

export function exportFabricStock(params: FabricStockExportParams) {
  return request.post<Blob>('/inventory/fabric/export', params, {
    responseType: 'blob',
    skipGlobalErrorHandler: true,
    timeout: 120000,
  })
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
  inventoryTypeId?: number | null
  storageLocation?: string
  unitPrice?: number | null
  otherCost?: number
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
    inventoryTypeId?: number | null
    storageLocation?: string
    unitPrice?: number | null
  }
) {
  return request.put<FabricItem>(`/inventory/fabric/items/${id}`, body)
}

export function batchUpdateFabricPrices(items: Array<{ id: number; unitPrice: number }>) {
  return request.post<{ updated: number }>('/inventory/fabric/items/batch-price', { items })
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
  inventoryTypeId: number | null
  inventoryTypeLabel: string
  quantity: string
  unitPrice: string | null
  amount: string | null
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
  inventoryTypeId?: number | null
  page?: number
  pageSize?: number
}) {
  return request.get<{
    list: FabricOutboundRecord[]
    total: number
    totalQuantity: number
    totalAmount: number
    unpricedCount: number
    unpricedQuantity: number
    page: number
    pageSize: number
  }>(
    '/inventory/fabric/outbounds',
    { params }
  )
}

export function getFabricOperationLogs(id: number) {
  return request.get<FabricOperationLog[]>(`/inventory/fabric/items/${id}/logs`)
}

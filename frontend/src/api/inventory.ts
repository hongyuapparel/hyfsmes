import request from './request'

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
  imageUrl?: string
  createdAt: string
  type: 'pending' | 'stored'
  /** 手动入库快照：列表数量悬停展示，结构与订单 color-size-breakdown 一致 */
  sizeBreakdown?: {
    headers: string[]
    rows: Array<{ colorName: string; values: number[] }>
  } | null
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
}) {
  return request.get<{
    list: FinishedStockRow[]
    total: number
    page: number
    pageSize: number
    /** 当前筛选条件下全部匹配记录的总件数（非仅本页） */
    totalQuantity: number
  }>('/inventory/finished/items', { params })
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
  return request.get<FinishedPickupUserOption[]>('/inventory/finished/pickup-users')
}

export function getPendingPickupUserOptions() {
  return request.get<FinishedPickupUserOption[]>('/inventory/pending/pickup-users')
}

export interface FinishedStockDetailRes {
  stock: FinishedStockRow
  orderNo: string
  productImageUrl: string
  colorImages: Array<{ colorName: string; imageUrl: string; updatedAt: string }>
  adjustLogs: Array<{
    id: number
    operatorUsername: string
    before: any
    after: any
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
  beforeSnapshot: Record<string, any> | null
  afterSnapshot: Record<string, any> | null
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
  beforeSnapshot: Record<string, any> | null
  afterSnapshot: Record<string, any> | null
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

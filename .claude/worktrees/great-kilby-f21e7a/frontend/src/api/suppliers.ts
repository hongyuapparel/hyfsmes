import request from './request'

export interface SupplierItem {
  id: number
  name: string
  supplierTypeId: number | null
  businessScopeId: number | null
  businessScopeIds: number[] | null
  lastActiveAt: string | null
  contactPerson: string
  contactInfo: string
  factoryAddress: string
  settlementTime: string
  remark: string
  createdAt: string
  updatedAt: string
}

export interface SupplierRecentRecordItem {
  orderId: number
  orderNo: string
  skuCode: string
  status: string
  orderDate: string | null
  refType: 'material' | 'process'
  refName: string
}

export interface SupplierBusinessScopeTreeNode {
  id: number
  value: string
  children: SupplierBusinessScopeTreeNode[]
}

/** 管理页列表（支持名称、类型筛选）。type 为类型名称，如「加工供应商」 */
export function getSupplierList(params?: {
  name?: string
  supplierTypeId?: number | null
  /** 按类型名称筛选（如「加工供应商」），与 supplierTypeId 二选一 */
  type?: string
  page?: number
  pageSize?: number
}) {
  return request.get<{ list: SupplierItem[]; total: number; page: number; pageSize: number }>(
    '/suppliers/items',
    { params }
  )
}

export function getSupplierOne(id: number) {
  return request.get<SupplierItem>(`/suppliers/items/${id}`)
}

export function getSupplierRecentRecords(id: number, limit = 10) {
  return request.get<SupplierRecentRecordItem[]>(`/suppliers/items/${id}/recent-records`, {
    params: { limit },
  })
}

export function createSupplier(body: {
  name: string
  supplierTypeId?: number | null
  businessScopeId?: number | null
  businessScopeIds?: number[] | null
  contactPerson?: string
  contactInfo?: string
  factoryAddress?: string
  settlementTime?: string
  remark?: string
}) {
  return request.post<SupplierItem>('/suppliers/items', body)
}

export function updateSupplier(
  id: number,
  body: {
    name?: string
    supplierTypeId?: number | null
    businessScopeId?: number | null
    businessScopeIds?: number[] | null
    contactPerson?: string
    contactInfo?: string
    factoryAddress?: string
    settlementTime?: string
    remark?: string
  }
) {
  return request.put<SupplierItem>(`/suppliers/items/${id}`, body)
}

export function deleteSupplier(id: number) {
  return request.delete<void>(`/suppliers/items/${id}`)
}

/** 下拉搜索（订单编辑等用），返回 { list: { id, name }[] } */
export function searchSuppliers(keyword?: string, page = 1, pageSize = 20) {
  return request.get<{ list: { id: number; name: string }[]; total: number }>('/suppliers', {
    params: { keyword, page, pageSize },
  })
}

/** 供应商类型下拉选项（一级，来自系统设置-供应商设置） */
export function getSupplierTypeOptions() {
  return request.get<string[]>('/suppliers/options')
}

/** 某供应商类型下的业务范围下拉选项（返回可选层级路径，父/子分组都可选） */
export function getSupplierBusinessScopeOptions(type: string) {
  return request.get<string[]>('/suppliers/options/business-scope', {
    params: { type },
  })
}

/** 某供应商类型下的业务范围树（父/子分组树形，可展开） */
export function getSupplierBusinessScopeTreeOptions(type: string) {
  return request.get<SupplierBusinessScopeTreeNode[]>('/suppliers/options/business-scope/tree', {
    params: { type },
  })
}

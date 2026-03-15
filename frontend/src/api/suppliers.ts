import request from './request'

export interface SupplierItem {
  id: number
  name: string
  supplierTypeId: number | null
  businessScopeId: number | null
  cooperationDate: string | null
  contactPerson: string
  contactInfo: string
  factoryAddress: string
  settlementTime: string
  createdAt: string
  updatedAt: string
}

/** 管理页列表（支持名称、类型筛选）。type 为类型名称，如「生产加工厂」 */
export function getSupplierList(params?: {
  name?: string
  supplierTypeId?: number | null
  /** 按类型名称筛选（如「生产加工厂」），与 supplierTypeId 二选一 */
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

export function createSupplier(body: {
  name: string
  supplierTypeId?: number | null
  businessScopeId?: number | null
  cooperationDate?: string
  contactPerson?: string
  contactInfo?: string
  factoryAddress?: string
  settlementTime?: string
}) {
  return request.post<SupplierItem>('/suppliers/items', body)
}

export function updateSupplier(
  id: number,
  body: {
    name?: string
    supplierTypeId?: number | null
    businessScopeId?: number | null
    cooperationDate?: string
    contactPerson?: string
    contactInfo?: string
    factoryAddress?: string
    settlementTime?: string
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

/** 某供应商类型下的业务范围下拉选项（该类型下的二级配置） */
export function getSupplierBusinessScopeOptions(type: string) {
  return request.get<string[]>('/suppliers/options/business-scope', {
    params: { type },
  })
}

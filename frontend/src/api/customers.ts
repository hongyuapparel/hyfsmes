import request from './request'
import { buildSharedGetKey, invalidateSharedGetCache, sharedGet } from './shared-request-cache'

/** 客户项，字段与 customer-fields code 对应；productGroupId 为存库值，productGroup 为展示用路径 */
export interface CustomerItem {
  id: number
  customerId: string
  country: string
  companyName: string
  contactPerson: string
  contactInfo: string
  cooperationDate: string | null
  salesperson: string
  productGroupId: number | null
  productGroup: string
  createdAt: string
  updatedAt: string
  /** 列表专用：该客户最后一次被订单引用的时间（关联订单 updated_at 的最大值） */
  lastOrderReferencedAt?: string | null
}

export interface CustomerListRes {
  list: CustomerItem[]
  total: number
  page: number
  pageSize: number
}

export interface CustomerListQuery {
  companyName?: string
  salesperson?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export function getCustomers(params?: CustomerListQuery) {
  return request.get<CustomerListRes>('/customers', { params })
}

export function getCustomerCompanyOptions(params?: {
  companyName?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}) {
  const query = {
    page: 1,
    pageSize: 200,
    sortBy: 'companyName',
    sortOrder: 'asc' as const,
    ...(params ?? {}),
  }
  const key = buildSharedGetKey('/customers', query)
  return sharedGet(key, () => request.get<CustomerListRes>('/customers', { params: query }), {
    ttlMs: 30000,
  })
}

export function getCustomer(id: number) {
  return request.get<CustomerItem>(`/customers/${id}`)
}

export function createCustomer(data: Record<string, unknown>) {
  const body: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
    body[snake] = v
  }
  return request.post<CustomerItem>('/customers', body).then((response) => {
    invalidateSharedGetCache('/customers')
    return response
  })
}

export function updateCustomer(id: number, data: Record<string, unknown>) {
  const body: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
    body[snake] = v
  }
  return request.patch<CustomerItem>(`/customers/${id}`, body).then((response) => {
    invalidateSharedGetCache('/customers')
    return response
  })
}

export function deleteCustomer(id: number) {
  return request.delete(`/customers/${id}`).then((response) => {
    invalidateSharedGetCache('/customers')
    return response
  })
}

export function batchDeleteCustomers(ids: number[]) {
  return request.post('/customers/batch-delete', { ids }).then((response) => {
    invalidateSharedGetCache('/customers')
    return response
  })
}

export function getSalespeople() {
  const key = buildSharedGetKey('/customers/options/salespeople')
  return sharedGet(key, () => request.get<string[]>('/customers/options/salespeople'), { ttlMs: 30000 })
}

export function getMerchandisers() {
  const key = buildSharedGetKey('/customers/options/merchandisers')
  return sharedGet(key, () => request.get<string[]>('/customers/options/merchandisers'), { ttlMs: 30000 })
}

export function getProductGroups() {
  const key = buildSharedGetKey('/customers/options/product-groups')
  return sharedGet(key, () => request.get<{ id: number; path: string }[]>('/customers/options/product-groups'), {
    ttlMs: 30000,
  })
}

/** 小满客户项 */
export interface XiaomanCompanyItem {
  company_id: number
  serial_id: string
  name: string
  short_name: string
  order_time: string
  create_time: string
  /** 主联系人姓名（从公司详情推导） */
  contactPerson?: string
}

export interface XiaomanListRes {
  list: XiaomanCompanyItem[]
  total: number
}

export interface XiaomanImportRes {
  imported: number
  skipped: number
  errors: string[]
}

export function getXiaomanList(params?: { page?: number; pageSize?: number; keyword?: string }) {
  return request.get<XiaomanListRes>('/customers/xiaoman/list', { params })
}

export function importFromXiaoman(companyIds: number[]) {
  return request.post<XiaomanImportRes>('/customers/xiaoman/import', { companyIds })
}

export function getNextCustomerId() {
  return request.get<string>('/customers/next-id')
}

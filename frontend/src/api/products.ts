import type { AxiosRequestConfig } from 'axios'
import request from './request'
import { buildSharedGetKey, invalidateSharedGetCache, sharedGet } from './shared-request-cache'

/** 产品项，字段与 product-fields code 对应；productGroupId 为存库值，productGroup 为展示用路径 */
export interface ProductItem {
  id: number
  productName: string
  skuCode: string
  imageUrl: string
  productGroupId: number | null
  productGroup: string
  applicablePeopleId: number | null
  /** 展示用：按 applicablePeopleId 解析出的当前名称 */
  applicablePeople: string
  customerId: number | null
  salesperson: string
  createdAt: string
  updatedAt: string
  customer?: { id: number; companyName: string } | null
}

export interface ProductListRes {
  list: ProductItem[]
  total: number
  page: number
  pageSize: number
}

export interface ProductListQuery {
  productName?: string
  companyName?: string
  skuCode?: string
  productGroupId?: number | null
  applicablePeopleId?: number | null
  salesperson?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export function getProducts(params?: ProductListQuery, config?: AxiosRequestConfig) {
  return request.get<ProductListRes>('/products', { params, ...(config ?? {}) })
}

export function getProduct(id: number) {
  return request.get<ProductItem>(`/products/${id}`)
}

export function createProduct(data: Record<string, unknown>) {
  const body: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
    body[snake] = v
  }
  return request.post<ProductItem>('/products', body).then((response) => {
    invalidateSharedGetCache('/products/options')
    return response
  })
}

export function updateProduct(id: number, data: Record<string, unknown>) {
  const body: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
    body[snake] = v
  }
  return request.patch<ProductItem>(`/products/${id}`, body).then((response) => {
    invalidateSharedGetCache('/products/options')
    return response
  })
}

export function deleteProduct(id: number) {
  return request.delete(`/products/${id}`).then((response) => {
    invalidateSharedGetCache('/products/options')
    return response
  })
}

export function batchDeleteProducts(ids: number[]) {
  return request.post('/products/batch-delete', { ids }).then((response) => {
    invalidateSharedGetCache('/products/options')
    return response
  })
}

export function getProductGroups() {
  const key = buildSharedGetKey('/products/options/product-groups')
  return sharedGet(
    key,
    () => request.get<{ id: number; path: string }[]>('/products/options/product-groups'),
    { ttlMs: 30000 },
  )
}

export function getProductGroupCounts() {
  const key = buildSharedGetKey('/products/options/group-counts')
  return sharedGet(
    key,
    () => request.get<{ productGroupId: number; productGroupPath: string; count: number }[]>(
      '/products/options/group-counts',
    ),
    { ttlMs: 30000 },
  )
}

export function getProductSalespeople() {
  const key = buildSharedGetKey('/products/options/salespeople')
  return sharedGet(key, () => request.get<string[]>('/products/options/salespeople'), { ttlMs: 30000 })
}

export function getNextSkuCode() {
  return request.get<string>('/products/next-sku')
}

export function checkSkuExists(sku: string) {
  return request.get<{ exists: boolean }>('/products/check-sku', { params: { sku } })
}

export interface ProductSkuOption {
  id: number
  skuCode: string
  productName: string
  customerId: number | null
  customerName: string
  imageUrl: string
  productGroup: string
  applicablePeople: string
}

export interface ProductSkuSearchRes {
  list: ProductSkuOption[]
  total: number
  page: number
  pageSize: number
}

export function getProductSkus(params?: { keyword?: string; page?: number; pageSize?: number }) {
  return request.get<ProductSkuSearchRes>('/products/skus', { params })
}

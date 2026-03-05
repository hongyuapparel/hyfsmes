import request from './request'

/** 产品项，字段与 product-fields code 对应 */
export interface ProductItem {
  id: number
  productName: string
  skuCode: string
  imageUrl: string
  productGroup: string
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
  companyName?: string
  skuCode?: string
  productGroup?: string
  salesperson?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export function getProducts(params?: ProductListQuery) {
  return request.get<ProductListRes>('/products', { params })
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
  return request.post<ProductItem>('/products', body)
}

export function updateProduct(id: number, data: Record<string, unknown>) {
  const body: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
    body[snake] = v
  }
  return request.patch<ProductItem>(`/products/${id}`, body)
}

export function deleteProduct(id: number) {
  return request.delete(`/products/${id}`)
}

export function batchDeleteProducts(ids: number[]) {
  return request.post('/products/batch-delete', { ids })
}

export function getProductGroups() {
  return request.get<string[]>('/products/options/product-groups')
}

export function getProductGroupCounts() {
  return request.get<{ productGroup: string; count: number }[]>('/products/options/group-counts')
}

export function getProductSalespeople() {
  return request.get<string[]>('/products/options/salespeople')
}

export function getNextSkuCode() {
  return request.get<string>('/products/next-sku')
}

export function checkSkuExists(sku: string) {
  return request.get<{ exists: boolean }>('/products/check-sku', { params: { sku } })
}

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

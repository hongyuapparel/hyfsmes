import request from './request'
import type { AxiosRequestConfig } from 'axios'
import { buildSharedGetKey, invalidateSharedGetCache, sharedGet } from './shared-request-cache'

export interface ProductionProcessItem {
  id: number
  department: string
  jobType: string
  name: string
  unitPrice: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export function getProductionProcesses(params?: { department?: string; jobType?: string }, config?: AxiosRequestConfig) {
  const key = buildSharedGetKey('/production-processes', params)
  return sharedGet(key, () => request.get<ProductionProcessItem[]>('/production-processes', { ...config, params }), {
    ttlMs: 30000,
  })
}

export interface ProductionProcessPageRes {
  items: ProductionProcessItem[]
  total: number
  page: number
  pageSize: number
}

export function getProductionProcessesPage(params: {
  department?: string
  jobType?: string
  keyword?: string
  page?: number
  pageSize?: number
}) {
  return request.get<ProductionProcessPageRes>('/production-processes/page', { params })
}

export function createProductionProcess(body: {
  department?: string
  jobType?: string
  name: string
  unitPrice?: string
  sortOrder?: number
}) {
  return request.post<ProductionProcessItem>('/production-processes/create', body).then((response) => {
    invalidateSharedGetCache('/production-processes')
    return response
  })
}

export function updateProductionProcess(
  id: number,
  body: { department?: string; jobType?: string; name?: string; unitPrice?: string; sortOrder?: number },
) {
  return request.put<ProductionProcessItem>(`/production-processes/${id}`, body).then((response) => {
    invalidateSharedGetCache('/production-processes')
    return response
  })
}

export function deleteProductionProcess(id: number) {
  return request.delete<void>(`/production-processes/${id}`).then((response) => {
    invalidateSharedGetCache('/production-processes')
    return response
  })
}

export function batchMoveProductionProcesses(body: {
  ids: number[]
  department: string
  jobType: string
}) {
  return request.patch<{ moved: number }>('/production-processes/batch/move', body).then((response) => {
    invalidateSharedGetCache('/production-processes')
    return response
  })
}

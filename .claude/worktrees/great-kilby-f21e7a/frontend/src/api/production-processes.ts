import request from './request'

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

export function getProductionProcesses(params?: { department?: string; jobType?: string }) {
  return request.get<ProductionProcessItem[]>('/production-processes', { params })
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
  return request.post<ProductionProcessItem>('/production-processes/create', body)
}

export function updateProductionProcess(
  id: number,
  body: { department?: string; jobType?: string; name?: string; unitPrice?: string; sortOrder?: number },
) {
  return request.put<ProductionProcessItem>(`/production-processes/${id}`, body)
}

export function deleteProductionProcess(id: number) {
  return request.delete<void>(`/production-processes/${id}`)
}

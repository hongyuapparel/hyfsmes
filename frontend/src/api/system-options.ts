import request from './request'

export interface SystemOptionItem {
  id: number
  optionType: string
  value: string
  sortOrder: number
  parentId?: number | null
}

export interface SystemOptionTreeNode extends SystemOptionItem {
  children: SystemOptionTreeNode[]
}

export function getSystemOptions(type: string) {
  return request.get<string[]>('/system-options', { params: { type } })
}

export function getSystemOptionsList(type: string) {
  return request.get<SystemOptionItem[]>('/system-options/list', { params: { type } })
}

export function getSystemOptionsTree(type: string) {
  return request.get<SystemOptionTreeNode[]>('/system-options/tree', { params: { type } })
}

export function createSystemOption(data: {
  type: string
  value: string
  sort_order?: number
  parent_id?: number | null
}) {
  return request.post<SystemOptionItem>('/system-options', data)
}

export function updateSystemOption(
  id: number,
  data: { value?: string; sort_order?: number; parent_id?: number | null },
) {
  return request.patch<SystemOptionItem>(`/system-options/${id}`, data)
}

export function deleteSystemOption(id: number) {
  return request.delete(`/system-options/${id}`)
}

export function batchUpdateSystemOptionOrder(
  type: string,
  parentId: number | null,
  items: { id: number; sort_order: number }[],
) {
  return request.patch('/system-options/batch/order', { type, parent_id: parentId, items })
}

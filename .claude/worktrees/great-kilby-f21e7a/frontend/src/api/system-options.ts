import request from './request'
import type { AxiosRequestConfig } from 'axios'

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

export function getSystemOptionsList(type: string, config?: AxiosRequestConfig) {
  return request.get<SystemOptionItem[]>('/system-options/list', { params: { type }, ...(config ?? {}) })
}

export function getSystemOptionsTree(type: string) {
  return request.get<SystemOptionTreeNode[]>('/system-options/tree', { params: { type } })
}

/** 懒加载树：根节点（含 hasChildren） */
export interface SystemOptionLazyNode {
  id: number
  value: string
  sortOrder: number
  hasChildren: boolean
}

export function getSystemOptionsRoots(type: string) {
  return request.get<SystemOptionLazyNode[]>('/system-options/roots', { params: { type } })
}

/** 懒加载树：子节点 */
export function getSystemOptionsChildren(type: string, parentId: number) {
  return request.get<SystemOptionLazyNode[]>('/system-options/children', {
    params: { type, parent_id: parentId },
  })
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

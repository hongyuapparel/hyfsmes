import request from './request'
import type { AxiosRequestConfig } from 'axios'
import { buildSharedGetKey, invalidateSharedGetCache, sharedGet } from './shared-request-cache'

export interface SystemOptionItem {
  id: number
  optionType: string
  value: string
  sortOrder: number
  parentId?: number | null
  remark?: string
}

export interface SystemOptionTreeNode extends SystemOptionItem {
  children: SystemOptionTreeNode[]
}

export function getSystemOptions(type: string) {
  const params = { type }
  const key = buildSharedGetKey('/system-options', params)
  return sharedGet(key, () => request.get<string[]>('/system-options', { params }), { ttlMs: 30000 })
}

export function getSystemOptionsList(type: string, config?: AxiosRequestConfig) {
  const params = { type }
  if (config?.signal) {
    return request.get<SystemOptionItem[]>('/system-options/list', { params, ...(config ?? {}) })
  }
  const key = buildSharedGetKey('/system-options/list', params)
  return sharedGet(key, () => request.get<SystemOptionItem[]>('/system-options/list', { params }), {
    ttlMs: 30000,
  })
}

export function getSystemOptionsTree(type: string) {
  const params = { type }
  const key = buildSharedGetKey('/system-options/tree', params)
  return sharedGet(key, () => request.get<SystemOptionTreeNode[]>('/system-options/tree', { params }), {
    ttlMs: 30000,
  })
}

/** 懒加载树：根节点（含 hasChildren） */
export interface SystemOptionLazyNode {
  id: number
  value: string
  sortOrder: number
  hasChildren: boolean
}

export function getSystemOptionsRoots(type: string) {
  const params = { type }
  const key = buildSharedGetKey('/system-options/roots', params)
  return sharedGet(key, () => request.get<SystemOptionLazyNode[]>('/system-options/roots', { params }), {
    ttlMs: 30000,
  })
}

/** 懒加载树：子节点 */
export function getSystemOptionsChildren(type: string, parentId: number) {
  const params = { type, parent_id: parentId }
  const key = buildSharedGetKey('/system-options/children', params)
  return sharedGet(
    key,
    () => request.get<SystemOptionLazyNode[]>('/system-options/children', { params }),
    { ttlMs: 30000 },
  )
}

export function createSystemOption(data: {
  type: string
  value: string
  sort_order?: number
  parent_id?: number | null
  remark?: string
}) {
  return request.post<SystemOptionItem>('/system-options', data).then((response) => {
    invalidateSharedGetCache('/system-options')
    invalidateSharedGetCache('/dicts')
    invalidateSharedGetCache('/suppliers/options')
    return response
  })
}

export function updateSystemOption(
  id: number,
  data: { value?: string; sort_order?: number; parent_id?: number | null; remark?: string },
) {
  return request.patch<SystemOptionItem>(`/system-options/${id}`, data).then((response) => {
    invalidateSharedGetCache('/system-options')
    invalidateSharedGetCache('/dicts')
    invalidateSharedGetCache('/suppliers/options')
    return response
  })
}

export function deleteSystemOption(id: number) {
  return request.delete(`/system-options/${id}`).then((response) => {
    invalidateSharedGetCache('/system-options')
    invalidateSharedGetCache('/dicts')
    invalidateSharedGetCache('/suppliers/options')
    return response
  })
}

export function batchUpdateSystemOptionOrder(
  type: string,
  parentId: number | null,
  items: { id: number; sort_order: number }[],
) {
  return request.patch('/system-options/batch/order', { type, parent_id: parentId, items }).then((response) => {
    invalidateSharedGetCache('/system-options')
    invalidateSharedGetCache('/dicts')
    invalidateSharedGetCache('/suppliers/options')
    return response
  })
}

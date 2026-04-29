import request from './request'
import { buildSharedGetKey, invalidateSharedGetCache, sharedGet } from './shared-request-cache'

export interface FieldDefinitionItem {
  id: number
  module: string
  code: string
  label: string
  type: string
  order: number
  visible: number
  filterable: number
  sortable: number
  placeholder?: string | null
  optionsKey?: string | null
}

export function getFieldDefinitions(module: string) {
  const params = { module }
  const key = buildSharedGetKey('/field-definitions', params)
  return sharedGet(key, () => request.get<FieldDefinitionItem[]>('/field-definitions', { params }), {
    ttlMs: 30000,
  })
}

export function updateFieldDefinition(id: number, data: { order?: number; visible?: boolean }) {
  return request.patch<FieldDefinitionItem>(`/field-definitions/${id}`, data).then((response) => {
    invalidateSharedGetCache('/field-definitions')
    return response
  })
}

export function batchUpdateFieldOrder(module: string, items: { id: number; order: number }[]) {
  return request.patch<FieldDefinitionItem[]>('/field-definitions/batch/order', { module, items }).then((response) => {
    invalidateSharedGetCache('/field-definitions')
    return response
  })
}

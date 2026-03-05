import request from './request'

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
  return request.get<FieldDefinitionItem[]>('/field-definitions', { params: { module } })
}

export function updateFieldDefinition(id: number, data: { order?: number; visible?: boolean }) {
  return request.patch<FieldDefinitionItem>(`/field-definitions/${id}`, data)
}

export function batchUpdateFieldOrder(module: string, items: { id: number; order: number }[]) {
  return request.patch<FieldDefinitionItem[]>('/field-definitions/batch/order', { module, items })
}

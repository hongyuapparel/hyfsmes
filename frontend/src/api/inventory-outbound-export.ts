import request from './request'

export type OutboundExportKind = 'pending' | 'finished' | 'accessories' | 'fabric'
export type OutboundExportFilters = {
  orderNo?: string
  skuCode?: string
  name?: string
  customerName?: string
  inventoryTypeId?: number
  outboundType?: string
  startDate?: string
  endDate?: string
}
export type OutboundExportPayload = OutboundExportFilters & {
  mode: 'selected' | 'filtered'
  selectedKeys?: string[]
}
export function exportOutboundRecords(kind: OutboundExportKind, payload: OutboundExportPayload) {
  return request.post<Blob>(`/inventory/${kind}/outbounds/export`, payload, { responseType: 'blob', timeout: 120000 })
}

import request from './request'

/** 列表行（后端 PackingListRow） */
export interface PackingListRow {
  id: number
  code: string
  customerId: number | null
  customerName: string
  serviceManager: string
  poNo: string
  xiaomanOrderNo: string
  xiaomanOrderId: string
  packDate: string | null
  status: string
  shippedAt: string | null
  createdAt: string
  boxCount: number
  totalQty: number
  totalWeight: number
  styleNos: string[]
}

export interface PackingListListRes {
  list: PackingListRow[]
  total: number
}

export interface PackingListQuery {
  status?: string
  customerName?: string
  keyword?: string
  xiaomanOrderNo?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export interface PackingItemDetail {
  id: number
  styleNo: string
  styleName: string
  colorName: string
  imageUrl: string
  sizeQuantities: Record<string, number>
  totalQty: number
  sourceType: string
  sourceId: number | null
}

export interface PackingBoxDetail {
  id: number
  boxSeq: number
  weightKg: number | null
  cartonSize: string
  remark: string
  items: PackingItemDetail[]
}

export interface PackingListDetail {
  id: number
  code: string
  customerId: number | null
  customerName: string
  serviceManager: string
  poNo: string
  xiaomanOrderNo: string
  xiaomanOrderId: string
  packDate: string | null
  remark: string
  showCompany: boolean
  sizeHeaders: string[]
  status: string
  shippedAt: string | null
  operatorUsername: string
  createdAt: string
  boxes: PackingBoxDetail[]
}

export interface PackingItemPayload {
  styleNo?: string
  styleName?: string
  colorName?: string
  imageUrl?: string
  sizeQuantities?: Record<string, number> | null
  totalQty?: number
  sourceType?: string
  sourceId?: number | null
}

export interface PackingBoxPayload {
  weightKg?: number | null
  cartonSize?: string
  remark?: string
  items: PackingItemPayload[]
}

export interface SavePackingListPayload {
  customerId?: number | null
  customerName?: string
  serviceManager?: string
  poNo?: string
  xiaomanOrderNo?: string
  xiaomanOrderId?: string
  packDate?: string | null
  remark?: string
  showCompany?: boolean
  sizeHeaders?: string[]
  boxes: PackingBoxPayload[]
}

export interface PickableLine {
  sourceType: 'pending' | 'finished'
  sourceId: number
  orderNo: string
  styleNo: string
  customerName: string
  colorName: string
  imageUrl: string
  sizeQuantities: Record<string, number>
  totalQty: number
  hasSnapshot: boolean
}

export interface PickableListRes {
  list: PickableLine[]
  total: number
}

export interface PickableQuery {
  customerName?: string
  keyword?: string
  page?: number
  pageSize?: number
}

export function getPackingLists(params?: PackingListQuery) {
  return request.get<PackingListListRes>('/packing-lists', { params })
}

export function getPackingListDetail(id: number) {
  return request.get<PackingListDetail>(`/packing-lists/${id}`)
}

export function createPackingList(payload: SavePackingListPayload) {
  return request.post<{ id: number; code: string }>('/packing-lists', payload)
}

export function updatePackingList(id: number, payload: SavePackingListPayload) {
  return request.put<void>(`/packing-lists/${id}`, payload)
}

export function deletePackingList(id: number) {
  return request.delete<void>(`/packing-lists/${id}`)
}

export function shipPackingList(id: number) {
  return request.post<void>(`/packing-lists/${id}/ship`)
}

export function getPickablePending(params?: PickableQuery) {
  return request.get<PickableListRes>('/packing-lists/pickable/pending', { params })
}

export function getPickableFinished(params?: PickableQuery) {
  return request.get<PickableListRes>('/packing-lists/pickable/finished', { params })
}

export interface XiaomanOrderItem {
  order_id: number
  order_no: string
  name: string
  company_name: string
  account_date: string
  amount: number
  currency: string
}

export function searchXiaomanOrders(keyword?: string, page = 1, pageSize = 20) {
  return request.get<{ list: XiaomanOrderItem[]; total: number }>('/packing-lists/xiaoman/orders', {
    params: { keyword, page, pageSize },
  })
}

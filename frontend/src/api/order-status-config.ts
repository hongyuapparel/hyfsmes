import request from './request'

export interface OrderStatusItem {
  id: number
  code: string
  label: string
  sortOrder: number
  groupKey: string | null
  isFinal: boolean
  enabled: boolean
}

export interface OrderStatusTransitionItem {
  id: number
  chainId?: number | null
  stepOrder?: number | null
  fromStatus: string
  toStatus: string
  triggerType: string
  triggerCode: string
  conditionsJson: unknown | null
  nextDepartment: string | null
  allowRoles: string | null
  enabled: boolean
}

export interface OrderWorkflowChainItem {
  id: number
  name: string
  conditionsJson: unknown | null
  enabled: boolean
  createdAt: string
}

export interface OrderWorkflowChainWithSteps {
  chain: OrderWorkflowChainItem
  steps: OrderStatusTransitionItem[]
}

export function getOrderStatuses() {
  return request.get<OrderStatusItem[]>('/order-status-config/statuses')
}

export function createOrderStatus(data: { code: string; label: string; sortOrder?: number; groupKey?: string; isFinal?: boolean; enabled?: boolean }) {
  return request.post<OrderStatusItem>('/order-status-config/statuses', data)
}

export function updateOrderStatus(
  id: number,
  data: Partial<{ code: string; label: string; sortOrder: number; groupKey: string | null; isFinal: boolean; enabled: boolean }>,
) {
  return request.patch<OrderStatusItem>(`/order-status-config/statuses/${id}`, data)
}

/** 仅切换启用状态（列表开关使用） */
export function toggleOrderStatusEnabled(id: number) {
  return request.patch<OrderStatusItem>(`/order-status-config/statuses/${id}/enabled`, {})
}

export function deleteOrderStatus(id: number) {
  return request.delete(`/order-status-config/statuses/${id}`)
}

export function getOrderStatusTransitions(fromStatus?: string) {
  return request.get<OrderStatusTransitionItem[]>('/order-status-config/transitions', {
    params: fromStatus ? { from_status: fromStatus } : undefined,
  })
}

export function createOrderStatusTransition(data: {
  fromStatus: string
  toStatus: string
  triggerType: string
  triggerCode: string
  conditionsJson?: unknown
  nextDepartment?: string
  allowRoles?: string
  enabled?: boolean
}) {
  return request.post<OrderStatusTransitionItem>('/order-status-config/transitions', data)
}

/** 批量创建流转规则（一条链路多步） */
export function createOrderStatusTransitionsBatch(data: {
  name?: string
  conditionsJson?: unknown
  steps: Array<{
    fromStatus: string
    toStatus: string
    triggerType: string
    triggerCode: string
    nextDepartment?: string
    allowRoles?: string
    enabled?: boolean
  }>
}) {
  return request.post<{ chain: OrderWorkflowChainItem; steps: OrderStatusTransitionItem[] }>('/order-status-config/transitions/batch', data)
}

export function getOrderWorkflowChains() {
  return request.get<OrderWorkflowChainWithSteps[]>('/order-status-config/chains')
}

export function updateOrderWorkflowChain(
  id: number,
  data: Partial<{ name: string; conditionsJson: unknown; enabled: boolean; steps: Array<{ fromStatus: string; toStatus: string; triggerType: string; triggerCode: string; enabled?: boolean }> }>,
) {
  return request.patch<OrderWorkflowChainWithSteps>(`/order-status-config/chains/${id}`, data)
}

export function deleteOrderWorkflowChain(id: number) {
  return request.delete(`/order-status-config/chains/${id}`)
}

export function updateOrderStatusTransition(
  id: number,
  data: Partial<{
    fromStatus: string
    toStatus: string
    triggerType: string
    triggerCode: string
    conditionsJson: unknown
    nextDepartment: string | null
    allowRoles: string | null
    enabled: boolean
  }>,
) {
  return request.patch<OrderStatusTransitionItem>(`/order-status-config/transitions/${id}`, data)
}

export function deleteOrderStatusTransition(id: number) {
  return request.delete(`/order-status-config/transitions/${id}`)
}

// --- 订单状态时效配置（SLA）---

export interface OrderStatusSlaItem {
  id: number
  orderStatusId: number
  limitHours: string
  enabled: boolean
  orderStatus?: { id: number; code: string; label: string }
}

export function getOrderStatusSlaList() {
  return request.get<OrderStatusSlaItem[]>('/order-status-config/sla')
}

export function createOrderStatusSla(data: { orderStatusId: number; limitHours: number; enabled?: boolean }) {
  return request.post<OrderStatusSlaItem>('/order-status-config/sla', data)
}

export function updateOrderStatusSla(
  id: number,
  data: Partial<{ orderStatusId: number; limitHours: number; enabled: boolean }>,
) {
  return request.patch<OrderStatusSlaItem>(`/order-status-config/sla/${id}`, data)
}

export function deleteOrderStatusSla(id: number) {
  return request.delete(`/order-status-config/sla/${id}`)
}

export interface OrderSlaReportRow {
  orderId: number
  orderNo: string
  statusId: number
  statusLabel: string
  enteredAt: string
  leftAt: string | null
  durationHours: number
  limitHours: number | null
  isOverdue: boolean
}

export function getOrderSlaReport(params?: {
  start_date?: string
  end_date?: string
  status_id?: number
}) {
  return request.get<{ list: OrderSlaReportRow[]; summary: { total: number; overdue: number } }>(
    '/order-status-config/sla-report',
    { params },
  )
}


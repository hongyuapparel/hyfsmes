import request from './request'

export interface WorkspaceFollowOrder {
  id: number
  orderNo: string
  skuCode: string
  orderTypeName: string
  salesperson: string
  customerDueDate: string | null
  followPlan: { nextFollowDate: string | null; nextAction: string | null } | null
}

export interface WorkspaceManualTask {
  id: number
  title: string
  workDate: string
  nextFollowDate: string | null
  note: string | null
}

export interface WorkspaceSummary {
  stats: {
    todayOpsCount: number
    urgentCount: number
    dueSoonCount: number
    myOrdersCount: number
  }
  opGroups: Array<{
    action: string
    label: string
    count: number
    orderNos: string[]
  }>
}

export function upsertFollowPlan(orderId: number, data: { nextFollowDate?: string | null; nextAction?: string | null }) {
  return request.post(`/workspace/follow-plan/${orderId}`, data)
}

export function createManualTask(data: { workDate: string; title: string }) {
  return request.post<WorkspaceManualTask>('/workspace/manual-tasks', data)
}

export function updateManualTask(id: number, data: { nextFollowDate?: string | null; note?: string | null }) {
  return request.patch(`/workspace/manual-tasks/${id}`, data)
}

export function deleteManualTask(id: number) {
  return request.delete(`/workspace/manual-tasks/${id}`)
}

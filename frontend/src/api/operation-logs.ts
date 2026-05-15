import request from './request'

export interface OperationLogItem {
  id: number
  orderId: number
  orderNo: string
  operatorUsername: string
  action: string
  detail: string
  targetType: string | null
  targetRef: string | null
  createdAt: string
}

export interface OperationLogsQuery {
  module?: string
  targetType?: string
  targetRef?: string
}

export async function fetchOrderOperationLogs(
  orderId: number,
  query: OperationLogsQuery = {},
): Promise<OperationLogItem[]> {
  const { data } = await request.get<OperationLogItem[]>(`/orders/${orderId}/operation-logs`, {
    params: query,
  })
  return data
}

/**
 * 把日志映射为 OperationLogsSection 接受的形态。
 */
export function toLogSectionItems(
  logs: OperationLogItem[],
): Array<{ id: number; operatorUsername: string; createdAt: string; summary: string }> {
  return logs.map((log) => ({
    id: log.id,
    operatorUsername: log.operatorUsername || '-',
    createdAt: log.createdAt,
    summary: log.detail,
  }))
}

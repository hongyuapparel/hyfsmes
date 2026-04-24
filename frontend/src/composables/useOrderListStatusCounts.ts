import { ref, type Ref } from 'vue'
import { getOrderStatusCounts, type OrderListQuery } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'

interface OrderListFilterStateLike {
  orderNo: string
  skuCode: string
  customer: string
  orderTypeId: number | null
  processItem: string
  salesperson: string
  merchandiser: string
  factory: string
}

interface UseOrderListStatusCountsParams {
  filter: OrderListFilterStateLike
  orderDateRange: Ref<[string, string] | null>
  completedRange: Ref<[string, string] | null>
}

export function useOrderListStatusCounts(params: UseOrderListStatusCountsParams) {
  const { filter, orderDateRange, completedRange } = params

  const statusCounts = ref<Record<string, number>>({})
  const statusTotal = ref<number>(0)

  let countsReqId = 0
  let countsAbortController: AbortController | null = null

  function buildCountQuery(): Omit<OrderListQuery, 'status' | 'page' | 'pageSize'> {
    const q: Omit<OrderListQuery, 'status' | 'page' | 'pageSize'> = {
      orderNo: filter.orderNo || undefined,
      skuCode: filter.skuCode || undefined,
      customer: filter.customer || undefined,
      orderTypeId: filter.orderTypeId ?? undefined,
      processItem: filter.processItem || undefined,
      salesperson: filter.salesperson || undefined,
      merchandiser: filter.merchandiser || undefined,
      factory: filter.factory || undefined,
    }
    if (orderDateRange.value && orderDateRange.value.length === 2) {
      q.orderDateStart = orderDateRange.value[0]
      q.orderDateEnd = orderDateRange.value[1]
    }
    if (completedRange.value && completedRange.value.length === 2) {
      q.completedStart = completedRange.value[0]
      q.completedEnd = completedRange.value[1]
    }
    return q
  }

  async function refreshStatusCounts() {
    countsAbortController?.abort()
    const controller = new AbortController()
    countsAbortController = controller
    const currentReqId = ++countsReqId
    try {
      const countsRes = await getOrderStatusCounts(buildCountQuery(), { signal: controller.signal })
      const countsData = countsRes.data
      if (currentReqId !== countsReqId) return
      statusTotal.value = countsData?.total ?? 0
      statusCounts.value = countsData?.byStatus ?? {}
    } catch (e: unknown) {
      if ((e as { code?: string; name?: string })?.code === 'ERR_CANCELED') return
      if ((e as { code?: string; name?: string })?.name === 'CanceledError') return
      if (!isErrorHandled(e)) {
        console.warn('订单状态统计加载失败：', getErrorMessage(e, '状态统计加载失败'))
      }
    }
  }

  function abortStatusCounts() {
    countsAbortController?.abort()
  }

  return {
    statusCounts,
    statusTotal,
    refreshStatusCounts,
    abortStatusCounts,
  }
}

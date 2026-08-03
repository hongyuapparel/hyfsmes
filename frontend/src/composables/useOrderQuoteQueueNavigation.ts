import { computed, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getOrders } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { normalizeOrderQuoteReturnTo, parseOrderQuoteQueueQuery } from '@/utils/order-quote-queue'

/** 成本页从待报价队列进入时的返回与“下一条”导航。 */
export function useOrderQuoteQueueNavigation(orderId: Ref<number>) {
  const route = useRoute()
  const router = useRouter()
  const isQuoteQueue = computed(() => route.query.from === 'unquoted')

  function getReturnTarget(): string {
    return normalizeOrderQuoteReturnTo(route.query.returnTo)
  }

  async function goToQuoteQueueNext() {
    const queueQuery = parseOrderQuoteQueueQuery(route.query.queueQuery)
    try {
      const res = await getOrders({ ...queueQuery, unquoted: true, page: 1, pageSize: 2 })
      const nextOrder = (res.data?.list ?? []).find((item) => item.id !== orderId.value)
      if (!nextOrder) {
        ElMessage.success('当前筛选范围内的待报价已全部处理完成')
        await router.push(getReturnTarget())
        return
      }
      await router.replace({
        name: 'OrdersCost',
        params: { id: nextOrder.id },
        query: {
          ...route.query,
          tabTitle: `订单成本 ${nextOrder.orderNo || nextOrder.id}`,
        },
      })
    } catch (e: unknown) {
      if (!isErrorHandled(e)) {
        ElMessage.warning(getErrorMessage(e, '下一条加载失败，已返回待报价列表'))
      }
      await router.push(getReturnTarget())
    }
  }

  async function goAfterQuoteConfirm(action: 'next' | 'return') {
    if (action === 'next') await goToQuoteQueueNext()
    else await router.push(getReturnTarget())
  }

  function goBackFromCost() {
    void router.push(isQuoteQueue.value ? getReturnTarget() : '/orders/list')
  }

  return { isQuoteQueue, goAfterQuoteConfirm, goBackFromCost }
}

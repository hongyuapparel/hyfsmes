import { ref, watch, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { getRouteTabKey } from './useRouteCacheControl'

function parseOrderId(value: unknown): number {
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : 0
}

/**
 * 每个 keep-alive 成本页实例只跟随自己的页签路由。
 * 报价队列在同一 tabKey 内 replace 到下一单时仍会更新，后台缓存页不会被其它页签重置。
 */
export function useOrderCostRouteIdentity(route: RouteLocationNormalizedLoaded): Ref<number> {
  const instanceTabKey = getRouteTabKey(route)
  const orderId = ref(parseOrderId(route.params.id))

  watch(
    () => [getRouteTabKey(route), route.params.id] as const,
    ([activeTabKey, nextOrderId]) => {
      if (activeTabKey !== instanceTabKey) return
      orderId.value = parseOrderId(nextOrderId)
    },
  )

  return orderId
}

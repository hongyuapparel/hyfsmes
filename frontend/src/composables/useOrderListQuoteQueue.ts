import { ref, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { OrderListItem, OrderListQuery } from '@/api/orders'

interface UseOrderListQuoteQueueParams {
  currentStatus: Ref<string>
  unquoted: Ref<boolean>
  pagination: { page: number }
  resetCardScroll: () => void
  resetSelection: () => void
  load: (options?: { refreshCounts?: boolean }) => Promise<void>
  getCurrentQuery: () => OrderListQuery
  openCost: (
    order: OrderListItem,
    queueContext?: { returnTo: string; query: OrderListQuery },
  ) => void
}

interface ApplyUnquotedOptions {
  syncRoute?: boolean
  reload?: boolean
  restoreStatus?: boolean
}

/** 订单列表“待报价”快捷筛选及其路由、返回上下文。 */
export function useOrderListQuoteQueue(params: UseOrderListQuoteQueueParams) {
  const route = useRoute()
  const router = useRouter()
  const quoteQueueSwitching = ref(false)
  let statusBeforeUnquoted = 'all'
  let syncingRoute = false
  let deferredRouteState: boolean | null = null

  function routeWantsUnquoted(raw: unknown): boolean {
    return raw === '1' || raw === 'true'
  }

  async function syncUnquotedRoute(active: boolean) {
    const query = { ...route.query }
    if (active) query.unquoted = '1'
    else delete query.unquoted
    syncingRoute = true
    try {
      // 进入队列保留一条历史，浏览器后退可回到原列表；主动退出则替换当前队列记录。
      if (active) await router.push({ path: route.path, query })
      else await router.replace({ path: route.path, query })
    } finally {
      syncingRoute = false
    }
  }

  async function applyUnquotedState(active: boolean, options: ApplyUnquotedOptions = {}) {
    const { syncRoute = true, reload = true, restoreStatus = true } = options
    if (quoteQueueSwitching.value) return

    quoteQueueSwitching.value = true
    const wasActive = params.unquoted.value
    try {
      // 先完成地址栏同步，再更新筛选和发请求，避免路由监听用旧状态覆盖新列表。
      if (syncRoute) await syncUnquotedRoute(active)

      if (active) {
        if (!wasActive) statusBeforeUnquoted = params.currentStatus.value
        params.unquoted.value = true
        params.currentStatus.value = 'completed'
      } else {
        params.unquoted.value = false
        if (restoreStatus && wasActive && params.currentStatus.value === 'completed') {
          params.currentStatus.value = statusBeforeUnquoted
        }
      }
      params.pagination.page = 1
      params.resetCardScroll()
      params.resetSelection()
      if (reload) await params.load({ refreshCounts: true })
    } finally {
      quoteQueueSwitching.value = false
    }
  }

  function initializeUnquotedFromRoute() {
    const active = routeWantsUnquoted(route.query.unquoted)
    if (!active) {
      params.unquoted.value = false
      return
    }
    statusBeforeUnquoted = params.currentStatus.value === 'completed'
      ? 'all'
      : params.currentStatus.value
    params.unquoted.value = true
    params.currentStatus.value = 'completed'
  }

  async function toggleUnquoted() {
    if (quoteQueueSwitching.value) return
    await applyUnquotedState(!params.unquoted.value)
  }

  async function exitUnquotedForStatusChange(): Promise<boolean> {
    if (!params.unquoted.value || params.currentStatus.value === 'completed') return false
    await applyUnquotedState(false, { restoreStatus: false })
    return true
  }

  function openCostFromList(order: OrderListItem) {
    if (!params.unquoted.value) {
      params.openCost(order)
      return
    }
    params.openCost(order, {
      returnTo: '/orders/list?unquoted=1',
      query: params.getCurrentQuery(),
    })
  }

  function reconcileUnquotedFromRoute() {
    const active = routeWantsUnquoted(route.query.unquoted)
    if (syncingRoute) return
    if (quoteQueueSwitching.value) {
      deferredRouteState = active
      return
    }
    if (active !== params.unquoted.value) {
      void applyUnquotedState(active, { syncRoute: false })
    }
  }

  watch(() => route.query.unquoted, reconcileUnquotedFromRoute, { flush: 'sync' })
  watch(quoteQueueSwitching, (switching) => {
    if (switching || deferredRouteState === null) return
    const active = deferredRouteState
    deferredRouteState = null
    if (active !== params.unquoted.value) {
      void applyUnquotedState(active, { syncRoute: false })
    }
  }, { flush: 'sync' })

  return {
    quoteQueueSwitching,
    applyUnquotedState,
    initializeUnquotedFromRoute,
    toggleUnquoted,
    exitUnquotedForStatusChange,
    openCostFromList,
  }
}

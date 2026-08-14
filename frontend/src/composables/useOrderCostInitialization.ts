import { nextTick, onMounted, ref, watch, type Ref } from 'vue'
import type { OrderDetail } from '@/api/orders'
import type { CostSnapshotLoadResult, OrderCostLoadOptions } from './useOrderCostLoader'

const LOAD_RETRY_DELAY_MS = 300
const PERF_TAG = '[orders-cost-perf]'
const waitMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface UseOrderCostInitializationParams {
  orderId: Readonly<Ref<number>>
  order: Ref<OrderDetail | null>
  materialRows: Ref<unknown[]>
  processItemRows: Ref<unknown[]>
  selectedProductionRows: Ref<unknown[]>
  hasLocalDraftChanges: Ref<boolean>
  suppressDirtyTracking: Ref<boolean>
  resetOrderCostState: () => void
  loadOrder: (options?: OrderCostLoadOptions) => Promise<boolean>
  loadCostSnapshot: (options?: OrderCostLoadOptions) => Promise<CostSnapshotLoadResult>
  reconcileCostRowsFromOrder: (order: OrderDetail) => void
  ensureCostRowsBase: () => void
  loadProcesses: () => Promise<void>
  syncProductionIdsFromName: () => void
  loadMaterialTypes: () => Promise<void>
  syncMaterialTypeIdsFromLabel: () => void
}

/** 初始化成本页，并忽略快速切换订单时返回的过期异步结果。 */
export function useOrderCostInitialization(params: UseOrderCostInitializationParams) {
  const mountStartAt = performance.now()
  const initialLoading = ref(true)
  const initialLoadFailed = ref(false)
  let initializationRunId = 0

  async function initializeOrderCostPage() {
    const runId = ++initializationRunId
    params.resetOrderCostState()
    params.selectedProductionRows.value = []
    params.hasLocalDraftChanges.value = false
    const browserWindow = window as Window & { __ordersCostMountCount?: number }
    browserWindow.__ordersCostMountCount = (browserWindow.__ordersCostMountCount ?? 0) + 1
    console.info(PERF_TAG, '页面 mount 次数', { mountCount: browserWindow.__ordersCostMountCount })
    params.suppressDirtyTracking.value = true
    initialLoading.value = true
    initialLoadFailed.value = false
    try {
      let [orderLoaded, snapshotResult] = await Promise.all([
        params.loadOrder({ silent: true }),
        params.loadCostSnapshot({ silent: true }),
      ])
      if (runId !== initializationRunId) return
      if (!orderLoaded) {
        await waitMs(LOAD_RETRY_DELAY_MS)
        orderLoaded = await params.loadOrder()
      }
      if (!snapshotResult.requestSucceeded) {
        await waitMs(LOAD_RETRY_DELAY_MS)
        snapshotResult = await params.loadCostSnapshot()
      }
      if (runId !== initializationRunId) return
      if (!orderLoaded || !snapshotResult.requestSucceeded) {
        initialLoadFailed.value = true
        return
      }
      if (!snapshotResult.hasUserSavedSnapshot && orderLoaded && params.order.value) {
        params.reconcileCostRowsFromOrder(params.order.value)
      } else {
        params.ensureCostRowsBase()
      }
      await Promise.all([params.loadProcesses(), params.loadMaterialTypes()])
      if (runId !== initializationRunId) return
      params.syncProductionIdsFromName()
      params.syncMaterialTypeIdsFromLabel()
      await nextTick()
      console.info(PERF_TAG, '首屏渲染时间(ms)', { elapsedMs: Math.round(performance.now() - mountStartAt) })
    } finally {
      if (runId === initializationRunId) {
        params.suppressDirtyTracking.value = false
        initialLoading.value = false
      }
    }
  }

  onMounted(() => { void initializeOrderCostPage() })
  watch(params.orderId, (nextId, previousId) => {
    if (nextId && nextId !== previousId) void initializeOrderCostPage()
  })

  return { initialLoading, initialLoadFailed }
}

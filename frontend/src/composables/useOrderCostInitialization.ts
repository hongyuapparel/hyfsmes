import { nextTick, onMounted, watch, type Ref } from 'vue'
import type { OrderDetail } from '@/api/orders'

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
  loadOrder: () => Promise<void>
  loadCostSnapshot: () => Promise<boolean>
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
    const [, hasUserSavedSnapshot] = await Promise.all([params.loadOrder(), params.loadCostSnapshot()])
    if (runId !== initializationRunId) return
    if (!params.order.value) { await waitMs(LOAD_RETRY_DELAY_MS); await params.loadOrder() }
    let savedSnapshot = hasUserSavedSnapshot
    if (!savedSnapshot && !params.materialRows.value.length && !params.processItemRows.value.length) {
      await waitMs(LOAD_RETRY_DELAY_MS)
      savedSnapshot = await params.loadCostSnapshot()
    }
    if (runId !== initializationRunId) return
    if (!savedSnapshot && params.order.value) params.reconcileCostRowsFromOrder(params.order.value)
    else params.ensureCostRowsBase()
    await params.loadProcesses()
    if (runId !== initializationRunId) return
    params.syncProductionIdsFromName()
    await params.loadMaterialTypes()
    if (runId !== initializationRunId) return
    params.syncMaterialTypeIdsFromLabel()
    params.suppressDirtyTracking.value = false
    await nextTick()
    console.info(PERF_TAG, '首屏渲染时间(ms)', { elapsedMs: Math.round(performance.now() - mountStartAt) })
  }

  onMounted(() => { void initializeOrderCostPage() })
  watch(params.orderId, (nextId, previousId) => {
    if (nextId && nextId !== previousId) void initializeOrderCostPage()
  })
}

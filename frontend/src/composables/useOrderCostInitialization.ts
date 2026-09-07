import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import type { OrderDetail } from '@/api/orders'
import type { CostSnapshotLoadResult, OrderCostLoadOptions } from './useOrderCostLoader'

const LOAD_RETRY_DELAY_MS = 300
const waitMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface UseOrderCostInitializationParams {
  orderId: Readonly<Ref<number>>
  order: Ref<OrderDetail | null>
  materialRows: Ref<unknown[]>
  processItemRows: Ref<unknown[]>
  selectedProductionRows: Ref<unknown[]>
  suppressDirtyTracking: Ref<boolean>
  resetOrderCostState: () => void
  loadOrder: (options?: OrderCostLoadOptions) => Promise<boolean>
  loadCostSnapshot: (options?: OrderCostLoadOptions) => Promise<CostSnapshotLoadResult>
  reconcileCostRowsFromOrder: (order: OrderDetail) => void
  ensureCostRowsBase: () => void
  loadProcesses: () => Promise<boolean>
  syncProductionIdsFromName: () => void
  loadMaterialTypes: () => Promise<boolean>
  syncMaterialTypeIdsFromLabel: () => void
}

/** 初始化成本页，并忽略快速切换订单时返回的过期异步结果。 */
export function useOrderCostInitialization(params: UseOrderCostInitializationParams) {
  const initialLoading = ref(true)
  const initialLoadFailed = ref(false)
  const optionsLoading = ref(true)
  const optionsLoadFailed = ref(false)
  let initializationRunId = 0

  async function loadOptions() {
    const results = await Promise.all([params.loadProcesses(), params.loadMaterialTypes()])
    return results.every(Boolean)
  }

  async function finishOptions(result: Promise<boolean>, runId: number) {
    const succeeded = await result
    if (runId !== initializationRunId) return
    if (succeeded) {
      params.syncProductionIdsFromName()
      params.syncMaterialTypeIdsFromLabel()
    }
    await nextTick()
    if (runId !== initializationRunId) return
    optionsLoadFailed.value = !succeeded
    optionsLoading.value = false
    params.suppressDirtyTracking.value = false
  }

  async function retryOptions() {
    if (optionsLoading.value) return
    optionsLoading.value = true
    params.suppressDirtyTracking.value = true
    await finishOptions(loadOptions(), initializationRunId)
  }

  async function initializeOrderCostPage() {
    const runId = ++initializationRunId
    params.resetOrderCostState()
    params.selectedProductionRows.value = []
    params.suppressDirtyTracking.value = true
    initialLoading.value = true
    initialLoadFailed.value = false
    optionsLoading.value = true
    optionsLoadFailed.value = false
    const optionsResult = loadOptions()
    try {
      let [orderLoaded, snapshotResult] = await Promise.all([
        params.loadOrder({ silent: true }),
        params.loadCostSnapshot({ silent: true }),
      ])
      if (runId !== initializationRunId) return
      if (!orderLoaded || !snapshotResult.requestSucceeded) {
        await waitMs(LOAD_RETRY_DELAY_MS)
        if (runId !== initializationRunId) return
        ;[orderLoaded, snapshotResult] = await Promise.all([
          orderLoaded ? Promise.resolve(true) : params.loadOrder({ silent: true }),
          snapshotResult.requestSucceeded ? Promise.resolve(snapshotResult) : params.loadCostSnapshot({ silent: true }),
        ])
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
      initialLoading.value = false
      await finishOptions(optionsResult, runId)
    } finally {
      if (runId === initializationRunId) {
        initialLoading.value = false
      }
    }
  }

  onMounted(() => { void initializeOrderCostPage() })
  onBeforeUnmount(() => { initializationRunId++ })
  watch(params.orderId, (nextId, previousId) => {
    if (nextId && nextId !== previousId) void initializeOrderCostPage()
  })

  return { initialLoading, initialLoadFailed, optionsLoading, optionsLoadFailed, retryOptions, retryLoad: initializeOrderCostPage }
}

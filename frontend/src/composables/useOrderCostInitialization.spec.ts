import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OrderDetail } from '@/api/orders'
import { useOrderCostInitialization } from './useOrderCostInitialization'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
function setup(options: { slow?: Promise<boolean>; failCore?: boolean; failOptions?: boolean } = {}) {
  const params = {
    orderId: ref(1), order: ref({ id: 1 } as OrderDetail), materialRows: ref([]), processItemRows: ref([]), selectedProductionRows: ref([]), suppressDirtyTracking: ref(true),
    resetOrderCostState: vi.fn(), loadOrder: vi.fn(async () => !options.failCore),
    loadCostSnapshot: vi.fn(async () => ({ requestSucceeded: !options.failCore, hasUserSavedSnapshot: true })),
    reconcileCostRowsFromOrder: vi.fn(), ensureCostRowsBase: vi.fn(),
    loadProcesses: vi.fn(() => options.slow ?? Promise.resolve(!options.failOptions)),
    loadMaterialTypes: vi.fn(async () => true), syncProductionIdsFromName: vi.fn(), syncMaterialTypeIdsFromLabel: vi.fn(),
  }
  let state!: ReturnType<typeof useOrderCostInitialization>
  const wrapper = mount(defineComponent({ setup() { state = useOrderCostInitialization(params); return () => null } }))
  return { params, state, wrapper }
}
describe('cost initialization', () => {
  afterEach(() => vi.useRealTimers())
  it('starts all independent requests immediately and shows core data before slow options', async () => {
    const slow = deferred<boolean>(), s = setup({ slow: slow.promise })
    expect(s.params.loadOrder).toHaveBeenCalledTimes(1)
    expect(s.params.loadCostSnapshot).toHaveBeenCalledTimes(1)
    expect(s.params.loadProcesses).toHaveBeenCalledTimes(1)
    expect(s.params.loadMaterialTypes).toHaveBeenCalledTimes(1)
    await flushPromises()
    expect(s.state.initialLoading.value).toBe(false)
    expect(s.state.optionsLoading.value).toBe(true)
    slow.resolve(true); await flushPromises()
    expect(s.state.optionsLoading.value).toBe(false)
    expect(s.params.suppressDirtyTracking.value).toBe(false)
    s.wrapper.unmount()
  })
  it('retries both failed core requests after one delay and remains blocked after failure', async () => {
    vi.useFakeTimers()
    const s = setup({ failCore: true })
    await flushPromises(); await vi.advanceTimersByTimeAsync(300)
    expect(s.params.loadOrder).toHaveBeenCalledTimes(2)
    expect(s.params.loadCostSnapshot).toHaveBeenCalledTimes(2)
    expect(s.state.initialLoadFailed.value).toBe(true)
    expect(s.params.suppressDirtyTracking.value).toBe(true)
    s.wrapper.unmount()
  })
  it('keeps core content after an option failure and supports retry', async () => {
    const s = setup({ failOptions: true })
    await flushPromises()
    expect(s.state.initialLoadFailed.value).toBe(false)
    expect(s.state.optionsLoadFailed.value).toBe(true)
    s.params.loadProcesses.mockResolvedValue(true)
    await s.state.retryOptions()
    expect(s.state.optionsLoadFailed.value).toBe(false)
    s.wrapper.unmount()
  })
  it('does not synchronize state after unmount', async () => {
    const slow = deferred<boolean>(), s = setup({ slow: slow.promise })
    await flushPromises(); s.wrapper.unmount(); slow.resolve(true); await flushPromises()
    expect(s.params.syncProductionIdsFromName).not.toHaveBeenCalled()
  })
})

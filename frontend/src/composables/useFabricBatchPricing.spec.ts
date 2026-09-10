import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FabricItem } from '@/api/inventory'
import { useFabricBatchPricing } from './useFabricBatchPricing'

const api = vi.hoisted(() => ({ save: vi.fn(), warning: vi.fn() }))
vi.mock('@/api/inventory', () => ({ batchUpdateFabricPrices: api.save }))
vi.mock('@/api/request', () => ({ getErrorMessage: () => '保存失败', isErrorHandled: () => false }))
vi.mock('element-plus', () => ({ ElMessage: { warning: api.warning, success: vi.fn(), error: vi.fn() } }))
const item: FabricItem = { id: 1, name: 'QA面料', quantity: '8.60', unit: '米', unitPrice: '16', amount: '137.60', remark: '', createdAt: '' }
function setup() {
  const selectedRows = ref([item]); const reload = vi.fn(); const clearSelection = vi.fn()
  return { state: useFabricBatchPricing({ selectedRows, reload, clearSelection }), selectedRows, reload, clearSelection }
}
beforeEach(() => { vi.clearAllMocks(); api.save.mockResolvedValue({ data: { updated: 1 } }) })

describe('面料批量补价', () => {
  it('快速连点只提交一次，保存中不能重新打开覆盖草稿', async () => {
    const { state, selectedRows, reload } = setup(); state.open()
    let finish!: () => void
    api.save.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
    const saving = state.submit(); void state.submit()
    expect(api.save).toHaveBeenCalledTimes(1)
    selectedRows.value = [{ ...item, id: 2 }]; state.open(); expect(state.rows[0].id).toBe(1)
    finish(); await saving; expect(reload).toHaveBeenCalledTimes(1)
  })
  it('未打开或空列表不调用补价接口', async () => {
    const { state } = setup(); await state.submit()
    state.visible.value = true; await state.submit(); expect(api.save).not.toHaveBeenCalled()
  })
  it('取消不改原库存；零价有效，空价和非法价格拒绝', async () => {
    const { state, selectedRows } = setup(); state.open(); state.rows[0].unitPrice = 18
    state.visible.value = false; expect(selectedRows.value[0].unitPrice).toBe('16')
    state.open()
    for (const price of [null, -1, NaN, Infinity]) { state.rows[0].unitPrice = price; await state.submit() }
    expect(api.save).not.toHaveBeenCalled()
    state.rows[0].unitPrice = 0; await state.submit(); expect(api.save).toHaveBeenCalledWith([{ id: 1, unitPrice: 0 }])
  })
  it('失败保留草稿且允许重试，成功才清空选择', async () => {
    const { state, clearSelection } = setup(); state.open(); state.rows[0].unitPrice = 18
    api.save.mockRejectedValueOnce(new Error('失败')); await state.submit()
    expect(state.visible.value).toBe(true); expect(state.submitting.value).toBe(false)
    expect(state.rows[0].unitPrice).toBe(18); expect(clearSelection).not.toHaveBeenCalled()
    await state.submit(); expect(clearSelection).toHaveBeenCalledTimes(1); expect(state.visible.value).toBe(false)
  })
})

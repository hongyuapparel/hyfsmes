import { effectScope, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFabricInventoryStock } from './useFabricInventoryStock'

const api = vi.hoisted(() => ({ list: vi.fn(), error: vi.fn() }))
vi.mock('@/api/inventory', () => ({ getFabricList: api.list, exportFabricStock: vi.fn(), getFabricSupplierOptions: vi.fn() }))
vi.mock('@/api/customers', () => ({ getAllCustomerCompanyOptions: vi.fn() }))
vi.mock('@/api/dicts', () => ({ getDictItems: vi.fn() }))
vi.mock('@/api/request', () => ({ getErrorMessage: () => '查询失败', isErrorHandled: () => false }))
vi.mock('element-plus', () => ({ ElMessage: { error: api.error } }))
vi.mock('@/composables/useTableColumnWidthPersist', () => ({ useTableColumnWidthPersist: () => ({ restoreColumnWidths: vi.fn() }) }))
vi.mock('@/composables/useFlexShellTableHeight', () => ({ useFlexShellTableHeight: () => ({ tableHeight: ref(500) }) }))
vi.mock('@/composables/useInventoryWorkbookExport', () => ({ useInventoryWorkbookExport: () => ({ exporting: ref(false), onExport: vi.fn() }) }))
const scopes: ReturnType<typeof effectScope>[] = []
function setup() { const scope = effectScope(); scopes.push(scope); return { scope, state: scope.run(useFabricInventoryStock)! } }
function response(id: number) { return { data: { list: [{ id }], total: id, totalQuantity: id * 2, totalAmount: id * 3, unpricedCount: id, unpricedQuantity: id } } }
function deferred() { let resolve!: (value: ReturnType<typeof response>) => void; let reject!: (reason: Error) => void
  const promise = new Promise<ReturnType<typeof response>>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
beforeEach(() => { vi.clearAllMocks(); api.list.mockResolvedValue(response(1)) })
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); vi.useRealTimers() })

describe('面料筛选与分页请求', () => {
  it('旧请求晚返回不能覆盖新列表、总数和金额', async () => {
    const { state } = setup(); const old = deferred(); api.list.mockReturnValueOnce(old.promise)
    const first = state.load(); api.list.mockResolvedValueOnce(response(2)); await state.load()
    old.resolve(response(1)); await first
    expect(state.list.value[0].id).toBe(2); expect(state.pagination.total).toBe(2)
    expect(state.stockTotalQuantity.value).toBe(4); expect(state.stockTotalAmount.value).toBe(6)
  })
  it('旧请求失败不弹错误或提前结束新请求的加载状态', async () => {
    const { state } = setup(); const old = deferred(); const latest = deferred()
    api.list.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
    const first = state.load(); const second = state.load(); old.reject(new Error('过期')); await first
    expect(state.loading.value).toBe(true); expect(api.error).not.toHaveBeenCalled()
    latest.resolve(response(2)); await second; expect(state.loading.value).toBe(false)
  })
  it('重新查询立即清除旧勾选，避免操作上次筛选的库存', async () => {
    const { state } = setup(); const clearSelection = vi.fn(); state.fabricStockTableRef.value = { clearSelection }
    state.selectedRows.value = [{ id: 1, name: '旧库存', quantity: '1', unit: '米', unitPrice: null, amount: null, remark: '', createdAt: '' }]
    const pending = state.load(); expect(state.selectedRows.value).toEqual([]); expect(clearSelection).toHaveBeenCalledOnce(); await pending
  })
  it('手动搜索取消待执行的防抖；清空同时移除全部筛选', async () => {
    vi.useFakeTimers(); const { state } = setup()
    Object.assign(state.filter, { name: '面料', customerName: '客户A', supplierId: 2, inventoryTypeId: 3 })
    state.inboundDateRange.value = ['2026-09-01', '2026-09-08']; state.debouncedSearch(); state.onSearch(true)
    await vi.advanceTimersByTimeAsync(500); expect(api.list).toHaveBeenCalledTimes(1)
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ supplierId: 2, inventoryTypeId: 3, startDate: '2026-09-01', endDate: '2026-09-08' }))
    state.debouncedSearch(); state.onReset(); await vi.advanceTimersByTimeAsync(500)
    expect(api.list).toHaveBeenCalledTimes(2); expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ name: undefined, supplierId: undefined, customerName: undefined, inventoryTypeId: undefined, startDate: undefined, endDate: undefined, page: 1 }))
  })
  it('组件销毁时取消延迟搜索并忽略进行中的响应', async () => {
    vi.useFakeTimers(); const { state, scope } = setup(); const pending = deferred(); api.list.mockReturnValueOnce(pending.promise)
    const loading = state.load(); state.debouncedSearch(); scope.stop(); pending.resolve(response(2)); await loading
    await vi.advanceTimersByTimeAsync(500); expect(api.list).toHaveBeenCalledTimes(1); expect(state.list.value).toEqual([])
  })
})

import { effectScope } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinishedOutboundRecords } from './useFinishedOutboundRecords'
const api = vi.hoisted(() => ({ list: vi.fn(), error: vi.fn() }))
vi.mock('@/api/inventory', () => ({ getFinishedOutboundRecords: api.list }))
vi.mock('@/api/request', () => ({ getErrorMessage: () => '失败', isErrorHandled: () => false }))
vi.mock('element-plus', () => ({ ElMessage: { error: api.error } }))
vi.mock('@/composables/useTableColumnWidthPersist', () => ({ useTableColumnWidthPersist: () => ({ restoreColumnWidths: vi.fn() }) }))
const scopes: ReturnType<typeof effectScope>[] = []
function setup() { const scope = effectScope(); scopes.push(scope); return { scope, state: scope.run(useFinishedOutboundRecords)! } }
function response(id: number) { return { data: { list: [{ id }], total: id } } }
beforeEach(() => { vi.clearAllMocks(); api.list.mockResolvedValue(response(2)) })
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))
describe('成品出库记录查询隔离', () => {
  it('旧结果不能覆盖新筛选结果', async () => {
    const { state } = setup(); let resolve!: (value: ReturnType<typeof response>) => void
    api.list.mockReturnValueOnce(new Promise(done => { resolve = done })); const old = state.loadOutbounds()
    await state.loadOutbounds(); resolve(response(1)); await old
    expect(state.outboundList.value).toEqual([{ id: 2 }]); expect(state.outboundPagination.total).toBe(2)
  })
  it('卸载后不更新列表和报错', async () => {
    const { state, scope } = setup(); let reject!: (reason: Error) => void
    api.list.mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail })); const pending = state.loadOutbounds()
    scope.stop(); reject(new Error('过期')); await pending; expect(api.error).not.toHaveBeenCalled(); expect(state.outboundList.value).toEqual([])
  })
  it('清空日期兼容组件 null，清空全部筛选恢复第一页', async () => {
    const { state } = setup(); Object.assign(state.outboundFilter, { dateRange: null, orderNo: 'QA', skuCode: 'QA', customerName: 'QA' })
    await state.loadOutbounds(); expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: undefined, endDate: undefined }))
    state.outboundPagination.page = 2; state.onOutboundReset()
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ orderNo: undefined, skuCode: undefined, customerName: undefined, page: 1 }))
  })
})

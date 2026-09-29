import { describe, expect, it, vi, beforeEach } from 'vitest'
import { usePackingListData } from './usePackingListData'
const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/packing-lists', () => ({ getPackingLists: api.get }))
vi.mock('@/api/request', () => ({ getErrorMessage: () => '', isErrorHandled: () => false }))
vi.mock('element-plus', () => ({ ElMessage: { error: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())
const response = (total = 2) => ({ data: { list: [], total, summary: { boxCount: total, totalQty: total * 5 } } })
describe('packing list status filtering', () => {
  it('状态、客户、业务员、排序和分页传到同一次查询，汇总不取当前页合计', async () => {
    api.get.mockResolvedValue(response(40))
    const state = usePackingListData(() => ({ status: 'held', customerName: 'A', serviceManager: '甲', sortField: 'packDate', sortOrder: 'asc' }), vi.fn())
    state.pagination.page = 2
    await state.load()
    expect(api.get).toHaveBeenCalledWith({ status: 'held', customerName: 'A', serviceManager: '甲', sortField: 'packDate', sortOrder: 'asc', page: 2, pageSize: 20 })
    expect(state.filterSummary).toEqual({ boxCount: 40, totalQty: 200 })
  })
  it('移走末页最后一条后回到最后有效页；无结果归零', async () => {
    api.get.mockResolvedValue(response(20))
    const state = usePackingListData(() => ({ status: 'held' }), vi.fn())
    state.pagination.page = 2
    await state.load()
    expect(state.pagination.page).toBe(1)
    expect(api.get).toHaveBeenLastCalledWith({ status: 'held', page: 1, pageSize: 20 })
    api.get.mockResolvedValue(response(0))
    await state.load()
    expect(state.filterSummary).toEqual({ boxCount: 0, totalQty: 0 })
  })
  it('快速切换页签时旧请求不覆盖新分类或统计', async () => {
    let resolveOld: ((value: ReturnType<typeof response>) => void) | undefined
    api.get.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
      .mockResolvedValueOnce(response(3))
    let status = 'draft'
    const state = usePackingListData(() => ({ status }), vi.fn())
    const old = state.load()
    status = 'held'
    await state.load()
    resolveOld?.(response(9))
    await old
    expect(state.pagination.total).toBe(3)
    expect(state.filterSummary.totalQty).toBe(15)
  })
})

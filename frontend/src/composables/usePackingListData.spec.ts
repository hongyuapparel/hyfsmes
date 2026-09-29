import { describe, expect, it, vi, beforeEach } from 'vitest'
import { usePackingListData } from './usePackingListData'
const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api/packing-lists', () => ({ getPackingLists: api.get }))
vi.mock('@/api/request', () => ({ getErrorMessage: () => '', isErrorHandled: () => false }))
vi.mock('element-plus', () => ({ ElMessage: { error: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())
const response = (total = 2) => ({ data: { list: [], total, summary: { boxCount: total, totalQty: total * 5 },
  tabCounts: { all: total, draft: 0, held: total, shipped: 0 } } })
describe('packing list status filtering', () => {
  it('状态、客户、业务员、排序和分页传到同一次查询，汇总不取当前页合计', async () => {
    api.get.mockResolvedValue(response(40))
    const state = usePackingListData(() => ({ status: 'held', customerName: 'A', serviceManager: '甲', sortField: 'packDate', sortOrder: 'asc' }), vi.fn())
    state.pagination.page = 2
    await state.load()
    expect(api.get).toHaveBeenCalledWith({ status: 'held', customerName: 'A', serviceManager: '甲', sortField: 'packDate', sortOrder: 'asc', page: 2, pageSize: 20 })
    expect(state.filterSummary).toEqual({ boxCount: 40, totalQty: 200 })
    expect(state.tabCounts.value).toEqual({ all: 40, draft: 0, held: 40, shipped: 0 })
    expect(api.get).toHaveBeenCalledTimes(1)
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
    expect(state.getTabLabel({ label: '滞留待发', name: 'held' })).toBe('滞留待发（0）')
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
    expect(state.tabCounts.value?.all).toBe(3)
  })
  it('未加载和旧接口缺少计数时显示横线，不伪装为零；计数使用服务端完整筛选范围', async () => {
    const state = usePackingListData(() => ({ status: 'held' }), vi.fn())
    const tab = { name: 'all', label: '全部' } as const
    expect(state.getTabLabel(tab)).toBe('全部（—）')
    api.get.mockResolvedValue({ data: { ...response(2).data, tabCounts: { all: 45, draft: 40, held: 2, shipped: 3 } } })
    await state.load()
    expect(state.getTabLabel(tab)).toBe('全部（45）')
    expect(state.pagination.total).toBe(2)
    api.get.mockResolvedValue({ data: { ...response(2).data, tabCounts: undefined } })
    await state.load()
    expect(state.getTabLabel(tab)).toBe('全部（—）')
  })
})

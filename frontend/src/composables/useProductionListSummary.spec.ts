import { createApp } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ items: vi.fn(), counts: vi.fn() }))
vi.mock('@/api/production-purchase', () => ({ getPurchaseItems: api.items, getPurchaseTabCounts: api.counts, exportPurchaseItems: vi.fn() }))
vi.mock('@/api/production-pattern', () => ({ getPatternItems: api.items, getPatternTabCounts: api.counts, exportPatternItems: vi.fn() }))
vi.mock('@/api/production-cutting', () => ({ getCuttingItems: api.items, getCuttingTabCounts: api.counts, exportCuttingItems: vi.fn() }))
vi.mock('@/api/production-sewing', () => ({ getSewingItems: api.items, getSewingTabCounts: api.counts, exportSewingItems: vi.fn() }))
vi.mock('@/api/production-finishing', () => ({ getFinishingItems: api.items, getFinishingTabCounts: api.counts, exportFinishingItems: vi.fn() }))
vi.mock('@/composables/useTableColumnWidthPersist', () => ({ useTableColumnWidthPersist: () => ({ restoreColumnWidths: vi.fn(), onHeaderDragEnd: vi.fn() }) }))
vi.mock('@/composables/useFlexShellTableHeight', () => ({ useFlexShellTableHeight: () => ({ tableHeight: 500 }) }))
vi.mock('@/composables/useCompactTableStyle', () => ({ useCompactTableStyle: () => ({}) }))
vi.mock('element-plus', () => ({ ElMessage: { error: vi.fn() } }))
vi.mock('@/api/request', () => ({ getErrorMessage: () => '失败', isErrorHandled: () => false }))

import { usePurchaseList } from './usePurchaseList'
import { usePatternList } from './usePatternList'
import { useCuttingListData } from './useCuttingListData'
import { useSewingList } from './useSewingList'
import { useFinishingListData } from './useFinishingListData'

const factories = [usePurchaseList, usePatternList, () => useCuttingListData({}), useSewingList, () => useFinishingListData({})]
function setup(index: number) {
  let state!: ReturnType<(typeof factories)[number]>
  const host = document.createElement('div')
  const app = createApp({ setup() { state = factories[index](); return () => null } })
  app.mount(host)
  return { state, stop: () => app.unmount() }
}
function count(state: ReturnType<(typeof factories)[number]>) {
  return 'tabTotal' in state ? String(state.tabTotal.value ?? '—') : state.getTabLabel({ label: '全部', value: 'all' }).slice(3, -1)
}
for (const [index, name] of ['采购', '纸样', '裁床', '车缝', '尾部'].entries()) {
  describe(`${name}列表与数量同步`, () => {
    beforeEach(() => vi.resetAllMocks())
    it('未加载不伪装为零，一次请求同时更新列表和全部数量', async () => {
      const { state, stop } = setup(index)
      expect(count(state)).toBe('—')
      api.items.mockResolvedValue({ data: { list: [{ orderId: 1 }], total: 1, totalQuantity: 3, tabCounts: { all: 7, completed: 6 } } })
      await state.load()
      expect(api.items).toHaveBeenCalledOnce()
      expect(api.counts).not.toHaveBeenCalled()
      expect(state.list.value[0].orderId).toBe(1)
      expect(count(state)).toBe('7')
      expect(state.pagination.total).toBe(1)
      stop()
    })
    it('较早的慢请求不能覆盖新筛选的列表和数量', async () => {
      const { state, stop } = setup(index)
      const resolves: Array<(data: unknown) => void> = []
      api.items.mockImplementation(() => new Promise(resolve => resolves.push(resolve)))
      state.filter.orderNo = '旧条件'; const old = state.load()
      state.filter.orderNo = '新条件'; const latest = state.load()
      resolves[1]({ data: { list: [{ orderId: 2 }], total: 1, tabCounts: { all: 2 } } }); await latest
      resolves[0]({ data: { list: [{ orderId: 1 }], total: 9, tabCounts: { all: 9 } } }); await old
      expect(state.list.value[0].orderId).toBe(2)
      expect(count(state)).toBe('2')
      expect(state.pagination.total).toBe(1)
      expect(state.loading.value).toBe(false)
      stop()
    })
    it('失败保留未知状态，成功查无结果才显示零', async () => {
      const { state, stop } = setup(index)
      api.items.mockRejectedValueOnce(new Error('网络错误'))
      await state.load(); expect(count(state)).toBe('—')
      api.items.mockResolvedValue({ data: { list: [], total: 0, tabCounts: { all: 0 } } })
      await state.load(); expect(count(state)).toBe('0')
      stop()
    })
  })
}

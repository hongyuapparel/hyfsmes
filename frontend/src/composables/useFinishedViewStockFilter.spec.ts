import { describe, expect, it, vi } from 'vitest'
import { useFinishedViewStockFilter } from './useFinishedViewStockFilter'

describe('useFinishedViewStockFilter', () => {
  it('清空时重置部门筛选并重新加载第一页', () => {
    const load = vi.fn()
    const clearSelection = vi.fn()
    const { filter, pagination, onReset } = useFinishedViewStockFilter(load, clearSelection)

    filter.department = 'B2B外贸'
    pagination.page = 3
    onReset()

    expect(filter.department).toBe('')
    expect(pagination.page).toBe(1)
    expect(clearSelection).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledOnce()
  })
})

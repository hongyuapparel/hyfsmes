import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getOrders: vi.fn(),
}))

vi.mock('@/api/orders', () => ({
  getOrders: api.getOrders,
}))

vi.mock('@/api/request', () => ({
  getErrorMessage: vi.fn(() => 'request failed'),
  isErrorHandled: vi.fn(() => false),
  isRequestCanceled: vi.fn(() => false),
}))

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn() },
}))

import { useOrderListData } from './useOrderListData'

describe('order list reset behavior', () => {
  beforeEach(() => {
    api.getOrders.mockReset()
    api.getOrders.mockResolvedValue({
      data: { list: [], total: 0, totalQuantity: 0 },
    })
  })

  it('clears field filters without leaving the quote queue', () => {
    const state = useOrderListData()
    state.unquoted.value = true
    state.currentStatus.value = 'completed'
    state.filter.orderNo = 'PDDW210'
    state.pagination.page = 3

    state.onReset()

    expect(state.filter.orderNo).toBe('')
    expect(state.unquoted.value).toBe(true)
    expect(state.currentStatus.value).toBe('completed')
    expect(state.pagination.page).toBe(1)
    expect(api.getOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        unquoted: true,
        page: 1,
      }),
      expect.any(Object),
    )
  })
})

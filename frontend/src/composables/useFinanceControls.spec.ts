import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ transfers: vi.fn() }))
vi.mock('@/api/finance-control', () => ({ getFinanceTransfers: mocks.transfers }))
import { useFinanceControls } from './useFinanceControls'

describe('finance transfer search', () => {
  beforeEach(() => mocks.transfers.mockReset())
  it('keeps the latest search when an older request finishes later', async () => {
    let finish!: (value: unknown) => void
    mocks.transfers.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    mocks.transfers.mockResolvedValueOnce({data:{list:[{id:2}],total:1}})
    const state = useFinanceControls()
    const old = state.loadTransfers({keyword:'old'})
    await state.loadTransfers({keyword:'new'})
    finish({data:{list:[{id:1}],total:99}}); await old
    expect(state.transfers.value).toEqual([{id:2}])
    expect(state.transferTotal.value).toBe(1)
    expect(state.transferLoading.value).toBe(false)
  })
  it('returns to the last available page after voiding the last item', async () => {
    mocks.transfers.mockResolvedValueOnce({data:{list:[],total:20}})
    mocks.transfers.mockResolvedValueOnce({data:{list:[{id:1}],total:20}})
    const state = useFinanceControls()
    await state.loadTransfers({page:2})
    expect(state.transferQuery.page).toBe(1)
    expect(mocks.transfers).toHaveBeenLastCalledWith({page:1,pageSize:20,status:'active',keyword:''})
    expect(state.transfers.value).toEqual([{id:1}])
    expect(state.transferLoading.value).toBe(false)
  })
  it('clears stale results when the current query fails', async () => {
    mocks.transfers.mockResolvedValueOnce({data:{list:[{id:1}],total:1}})
    const state = useFinanceControls()
    await state.loadTransfers()
    mocks.transfers.mockRejectedValueOnce(new Error('offline'))
    await expect(state.loadTransfers({status:'void'})).rejects.toThrow('offline')
    expect(state.transfers.value).toEqual([])
    expect(state.transferTotal.value).toBe(0)
    expect(state.transferLoading.value).toBe(false)
  })
})

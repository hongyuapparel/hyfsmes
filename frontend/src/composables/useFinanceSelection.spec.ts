import { describe, expect, it } from 'vitest'
import { useFinanceSelection } from './useFinanceSelection'

describe('finance selection', () => {
  it('totals selected monetary values in cents', () => {
    const state = useFinanceSelection()
    state.selected.value = [{ id: 1, amount: '0.10' }, { id: 2, amount: '0.20' }]
    expect(state.selectedAmount.value).toBe(0.3)
  })
  it('reports successful and failed records separately', async () => {
    const state = useFinanceSelection()
    const result = await state.removeRecords([1, 2, 3], async id => {
      if (id === 2) throw new Error('permission denied')
    })
    expect(result).toEqual({ deletedCount: 2, failedIds: [2] })
    expect(state.deleting.value).toBe(false)
  })
  it('prevents concurrent batches and empty deletion', async () => {
    const state = useFinanceSelection()
    expect(await state.removeRecords([], async () => { throw new Error('must not run') })).toBeNull()
    let finish!: () => void
    const first = state.removeRecords([1], () => new Promise<void>(resolve => { finish = resolve }))
    expect(await state.removeRecords([2], async () => { throw new Error('must not run') })).toBeNull()
    finish()
    expect(await first).toEqual({ deletedCount: 1, failedIds: [] })
  })
})

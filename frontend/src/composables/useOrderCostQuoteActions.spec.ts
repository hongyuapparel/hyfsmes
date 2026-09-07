import { computed, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrderDetail } from '@/api/orders'
import { buildSnapshotPayload } from '@/utils/order-cost'
import { useOrderCostQuoteActions } from './useOrderCostQuoteActions'

const mocks = vi.hoisted(() => ({ save: vi.fn(), confirm: vi.fn(), dialog: vi.fn(), message: vi.fn() }))
vi.mock('@/api/orders', () => ({ saveOrderCost: mocks.save, confirmOrderCost: mocks.confirm }))
vi.mock('@/api/request', () => ({ isErrorHandled: () => false, getErrorMessage: () => '模拟失败' }))
vi.mock('element-plus', () => ({ ElMessage: { warning: mocks.message, success: mocks.message, error: mocks.message }, ElMessageBox: { confirm: mocks.dialog } }))

function setup() {
  const params = {
    authStore: { user: { displayName: '测试员' } }, orderId: ref(1), order: ref({ id: 1, exFactoryPrice: '10.00' } as OrderDetail),
    canSubmitCost: ref(true), computedExFactoryPrice: ref(49.41), quoteConfirmedAt: ref(''), quoteConfirmedBy: ref(''), quoteNeedsReconfirm: ref(true),
    hasLocalDraftChanges: computed(() => true), isQuoteQueue: ref(false), costIssues: ref<string[]>([]), structureDifferences: ref<string[]>([]),
    buildCurrentSnapshot: () => buildSnapshotPayload({ materialRows: [{ materialName: '布', unitPrice: 20, usagePerPiece: 2, lossPercent: 5 }], processItemRows: [], productionRows: [], productionCostMultiplier: 2, profitMargin: 0.15 }),
    markSaved: vi.fn(), goAfterQuoteConfirm: vi.fn(async () => {}),
  }
  return { params, actions: useOrderCostQuoteActions(params) }
}
describe('cost quote submission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.save.mockResolvedValue({ data: { snapshot: { quoteNeedsReconfirm: true } } })
    mocks.confirm.mockResolvedValue({ data: {} })
    mocks.dialog.mockResolvedValue('confirm')
  })
  it('saving drafts never changes the confirmed factory price', async () => {
    const s = setup(); await s.actions.saveDraft()
    expect(s.params.order.value.exFactoryPrice).toBe('10.00')
    expect(s.params.markSaved).toHaveBeenCalledWith(expect.objectContaining({ profitMargin: 0.15 }))
    expect(mocks.confirm).not.toHaveBeenCalled()
  })
  it('leaves edits and confirmed price intact on server failure', async () => {
    mocks.save.mockRejectedValueOnce(new Error('offline')); mocks.confirm.mockRejectedValueOnce(new Error('offline'))
    const s = setup(); await s.actions.saveDraft(); await s.actions.confirmQuote()
    expect(s.params.markSaved).not.toHaveBeenCalled()
    expect(s.params.order.value.exFactoryPrice).toBe('10.00')
    expect(s.actions.savingDraft.value).toBe(false)
    expect(s.actions.confirmingQuote.value).toBe(false)
  })
  it('requires explicit acknowledgement for missing items and source differences', async () => {
    const s = setup(); s.params.costIssues.value = ['物料未定价']; s.params.structureDifferences.value = ['物料']
    mocks.dialog.mockRejectedValueOnce('cancel')
    await s.actions.confirmQuote()
    expect(mocks.confirm).not.toHaveBeenCalled()
    await s.actions.confirmQuote()
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    expect(s.params.order.value.exFactoryPrice).toBe('49.41')
  })
  it('rejects invalid prices and unauthorized submission', async () => {
    const s = setup(); s.params.computedExFactoryPrice.value = Number.NaN
    await s.actions.confirmQuote()
    s.params.canSubmitCost.value = false; await s.actions.saveDraft()
    expect(mocks.confirm).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled()
  })
  it('does not submit twice while confirmation is pending', async () => {
    let resolve!: () => void
    mocks.confirm.mockImplementationOnce(() => new Promise<void>(done => { resolve = done }))
    const s = setup(), pending = s.actions.confirmQuote()
    await s.actions.confirmQuote(); await s.actions.saveDraft()
    expect(mocks.confirm).toHaveBeenCalledTimes(1); expect(mocks.save).not.toHaveBeenCalled()
    resolve(); await pending
  })
  it.each(['next', 'return'] as const)('allows confirmed queue navigation (%s) without unlocking duplicate submission', async (action) => {
    const s = setup(); s.params.isQuoteQueue.value = true
    s.params.goAfterQuoteConfirm.mockImplementationOnce(async () => {
      expect(s.params.markSaved).toHaveBeenCalled()
      expect(s.actions.blockingSubmission.value).toBe(false)
      expect(s.actions.confirmingQuote.value).toBe(true)
      await s.actions.confirmQuote(); await s.actions.saveDraft()
      expect(mocks.confirm).toHaveBeenCalledTimes(1)
      expect(mocks.save).not.toHaveBeenCalled()
    })
    await s.actions.confirmQuote(action)
    expect(s.params.goAfterQuoteConfirm).toHaveBeenCalledWith(action)
    expect(s.actions.confirmingQuote.value).toBe(false)
  })
})

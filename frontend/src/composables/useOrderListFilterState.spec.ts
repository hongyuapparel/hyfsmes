import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useOrderListFilterState } from './useOrderListFilterState'

function createState() {
  const filter = {
    orderNo: '', skuCode: '', customer: '', orderTypeId: null, collaborationTypeId: null,
    productGroupId: null, processItem: '', salesperson: '', merchandiser: '', factory: '',
  }
  const orderDateRange = ref<[string, string] | null>(null)
  const customerDueRange = ref<[string, string] | null>(null)
  const completedRange = ref<[string, string] | null>(null)
  const currentStatus = ref('all')
  const state = useOrderListFilterState({
    storageKey: 'test-order-list-filter',
    filter,
    orderDateRange,
    customerDueRange,
    completedRange,
    currentStatus,
    pagination: { page: 1, pageSize: 20 },
    orderNoLabelVisible: ref(false),
    skuCodeLabelVisible: ref(false),
  })
  return { filter, customerDueRange, completedRange, currentStatus, state }
}

describe('order-list route filters', () => {
  it('applies home shortcuts for status, merchandiser, customer due and completion date', () => {
    const context = createState()
    context.state.applyQueryFromRoute({
      status: 'pending_review',
      merchandiser: 'Andy',
      customerDueStart: '2026-08-03',
      customerDueEnd: '2026-08-10',
      completedStart: '2026-07-01',
      completedEnd: '2026-07-31',
    })

    expect(context.currentStatus.value).toBe('pending_review')
    expect(context.filter.merchandiser).toBe('Andy')
    expect(context.customerDueRange.value).toEqual(['2026-08-03', '2026-08-10'])
    expect(context.completedRange.value).toEqual(['2026-07-01', '2026-07-31'])
  })
})

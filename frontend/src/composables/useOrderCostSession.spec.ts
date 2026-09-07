import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSnapshotPayload, type MaterialRow } from '@/utils/order-cost'
import { useOrderCostSession } from './useOrderCostSession'
import { canCloseTab } from './useRouteCacheControl'

const mocks = vi.hoisted(() => ({ confirm: vi.fn() }))
vi.mock('element-plus', () => ({ ElMessageBox: { confirm: mocks.confirm } }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/orders/cost/1', query: { tabKey: 'cost-1' } }),
  onBeforeRouteLeave: vi.fn(), onBeforeRouteUpdate: vi.fn(),
}))

describe('cost session', () => {
  beforeEach(() => mocks.confirm.mockReset())
  function setup() {
    const rows = ref<MaterialRow[]>([{ materialName: '布', unitPrice: 10, usagePerPiece: 1 }]), loading = ref(true), submitting = ref(false)
    const snapshot = () => buildSnapshotPayload({ materialRows: rows.value, processItemRows: [], productionRows: [], profitMargin: 0.15, productionCostMultiplier: 2 })
    let session!: ReturnType<typeof useOrderCostSession>
    const wrapper = mount(defineComponent({ setup() {
      session = useOrderCostSession(snapshot, value => { rows.value = value.materialRows }, loading, () => submitting.value)
      return () => null
    } }))
    loading.value = false
    return { rows, submitting, session, wrapper, snapshot }
  }
  it('detects text edits without changing totals and clears dirty after undo', () => {
    const s = setup()
    expect(s.session.hasLocalDraftChanges.value).toBe(false)
    s.rows.value[0].remark = '备注'
    expect(s.session.hasLocalDraftChanges.value).toBe(true)
    s.rows.value[0].remark = ''
    expect(s.session.hasLocalDraftChanges.value).toBe(false)
    s.wrapper.unmount()
  })
  it('retains unsaved changes after cancel and restores latest baseline after discard', async () => {
    const s = setup()
    s.rows.value[0].unitPrice = 20
    mocks.confirm.mockRejectedValueOnce('cancel')
    expect(await canCloseTab('cost-1')).toBe(false)
    expect(s.rows.value[0].unitPrice).toBe(20)
    mocks.confirm.mockResolvedValueOnce('confirm')
    expect(await canCloseTab('cost-1')).toBe(true)
    expect(s.rows.value[0].unitPrice).toBe(10)
    expect(s.session.hasLocalDraftChanges.value).toBe(false)
    s.wrapper.unmount()
  })
  it('does not clear newer edits when an earlier save completes and blocks closure during submit', async () => {
    const s = setup()
    s.rows.value[0].unitPrice = 20
    const sent = s.snapshot()
    s.rows.value[0].unitPrice = 30
    s.session.markSaved(sent)
    expect(s.session.hasLocalDraftChanges.value).toBe(true)
    s.submitting.value = true
    expect(await canCloseTab('cost-1')).toBe(false)
    expect(mocks.confirm).not.toHaveBeenCalled()
    s.wrapper.unmount()
  })
})

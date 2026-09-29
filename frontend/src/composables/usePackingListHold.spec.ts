import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { packingAgeLabel, usePackingListHold } from './usePackingListHold'
import type { PackingListRow } from '@/api/packing-lists'

const api = vi.hoisted(() => ({ set: vi.fn(), message: vi.fn() }))
vi.mock('@/api/packing-lists', () => ({ setPackingListHold: api.set }))
vi.mock('@/api/request', () => ({ getErrorMessage: () => '失败', isErrorHandled: () => false }))
vi.mock('element-plus', () => ({ ElMessage: { success: api.message, error: api.message, warning: api.message } }))
function row(id: number, status = 'draft'): PackingListRow {
  return { id, status, holdReason: '', code: `PL-${id}`, customerId: null, customerName: '', serviceManager: '',
    poNo: '', xiaomanOrderNo: '', xiaomanOrderId: '', packDate: null, shippedAt: null, createdAt: '',
    boxCount: 1, totalQty: 5, totalWeight: 0, styleNos: [] }
}
beforeEach(() => { vi.clearAllMocks(); api.set.mockResolvedValue({ data: { changed: 2 } }) })
describe('packing hold actions', () => {
  it('无选择、混合状态不能批量操作；同类单可批量移入或移回', () => {
    const selected = ref<PackingListRow[]>([])
    const hold = usePackingListHold(selected, vi.fn(), vi.fn())
    expect(hold.canHold.value).toBe(false)
    expect(hold.canResume.value).toBe(false)
    selected.value = [row(1), row(2, 'shipped')]
    hold.openHold(selected.value, 'held')
    expect(hold.holdDialog.visible).toBe(false)
    selected.value = [row(1), row(2)]
    expect(hold.canHold.value).toBe(true)
    selected.value = [row(1, 'held'), row(2, 'held')]
    expect(hold.canResume.value).toBe(true)
  })
  it('取消后重新打开不留原因；空原因可保存；成功刷新并清勾选', async () => {
    const reload = vi.fn(), clear = vi.fn()
    const hold = usePackingListHold(ref([]), reload, clear)
    hold.openHold([row(1)], 'held')
    hold.holdDialog.reason = '误填'
    hold.holdDialog.visible = false
    hold.openHold([row(1), row(2)], 'held')
    expect(hold.holdDialog.reason).toBe('')
    await hold.submitHold()
    expect(api.set).toHaveBeenCalledWith({ ids: [1, 2], status: 'held', reason: '' })
    expect(reload).toHaveBeenCalledOnce()
    expect(clear).toHaveBeenCalledOnce()
    expect(hold.holdDialog.visible).toBe(false)
  })
  it('接口失败保留现场，不报成功也不清选择', async () => {
    api.set.mockRejectedValue(new Error('failed'))
    const reload = vi.fn(), clear = vi.fn()
    const hold = usePackingListHold(ref([]), reload, clear)
    hold.openHold([row(1)], 'held')
    hold.holdDialog.reason = '等尾款'
    await hold.submitHold()
    expect(hold.holdDialog.visible).toBe(true)
    expect(hold.holdDialog.reason).toBe('等尾款')
    expect(hold.holdDialog.submitting).toBe(false)
    expect(clear).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })
  it('装箱天数按自然日计算，空日期不猜测，未来日期不显示负天数', () => {
    const now = new Date(2026, 8, 29, 23, 59)
    expect(packingAgeLabel('2026-09-29', now)).toBe('0 天')
    expect(packingAgeLabel('2026-09-28', now)).toBe('1 天')
    expect(packingAgeLabel('2026-09-30', now)).toBe('装箱日期未到')
    expect(packingAgeLabel(null, now)).toBe('-')
    expect(packingAgeLabel('2026-02-30', now)).toBe('-')
  })
})

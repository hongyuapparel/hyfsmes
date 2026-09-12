import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FabricItem } from '@/api/inventory'
import { useFabricInventoryOutbound } from './useFabricInventoryOutbound'

const api = vi.hoisted(() => ({ save: vi.fn(), confirm: vi.fn(), warning: vi.fn() }))
vi.mock('@/api/inventory', () => ({ fabricOutbound: api.save, getFabricPickupUserOptions: vi.fn() }))
vi.mock('@/api/request', () => ({ getErrorMessage: () => '出库失败', isErrorHandled: () => false }))
vi.mock('element-plus', () => ({ ElMessage: { warning: api.warning, success: vi.fn(), error: vi.fn() }, ElMessageBox: { confirm: api.confirm } }))
const item: FabricItem = { id: 1, name: 'QA', quantity: '8.60', unit: '米', unitPrice: '16', amount: '137.60', remark: '', createdAt: '' }
function setup(unitPrice: string | null = '16') {
  const state = useFabricInventoryOutbound({ selectedRows: ref([{ ...item, unitPrice }]), reloadStock: vi.fn(), reloadOutbounds: vi.fn(), clearSelection: vi.fn() })
  state.openOutboundDialog(); Object.assign(state.outboundForm, { pickupUserId: 1, photoUrl: '/uploads/qa.png', remark: 'QA领料' })
  state.outboundFormRef.value = { validate: async () => true, clearValidate: vi.fn() }
  return state
}
beforeEach(() => { vi.clearAllMocks(); api.save.mockResolvedValue({}); api.confirm.mockResolvedValue('confirm') })
describe('面料出库提交保护', () => {
  it.each([0, -1, NaN, Infinity, 8.61])('非法或超库存数量 %s 不扣库', async quantity => {
    const state = setup(); state.outboundForm.quantity = quantity; await state.submitOutbound(); expect(api.save).not.toHaveBeenCalled()
  })
  it('小数及全部出库正常；零价不被当成未计价', async () => {
    const state = setup('0'); state.outboundForm.quantity = 8.6; await state.submitOutbound()
    expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ id: 1, quantity: 8.6 })); expect(api.confirm).not.toHaveBeenCalled()
  })
  it('校验等待中连点只提交一次，且不能换行或重置草稿', async () => {
    const state = setup(); let resolve!: (value: boolean) => void
    state.outboundFormRef.value!.validate = () => new Promise<boolean>(done => { resolve = done })
    const first = state.submitOutbound(); await state.submitOutbound(); state.openOutboundDialog({ ...item, id: 2 }); state.resetOutboundForm()
    expect(state.outboundDialog.row?.id).toBe(1); resolve(true); await first; expect(api.save).toHaveBeenCalledTimes(1)
  })
  it('取消未计价确认不扣库，解除锁定后可以重试', async () => {
    const state = setup(null); api.confirm.mockRejectedValueOnce('cancel'); await state.submitOutbound()
    expect(api.save).not.toHaveBeenCalled(); expect(state.outboundDialog.submitting).toBe(false)
    await state.submitOutbound(); expect(api.save).toHaveBeenCalledOnce()
  })
  it('校验不通过或出库失败保留草稿，关闭后不提交', async () => {
    const state = setup(); state.outboundFormRef.value!.validate = async () => false; await state.submitOutbound()
    expect(api.save).not.toHaveBeenCalled(); state.outboundFormRef.value!.validate = async () => true
    api.save.mockRejectedValueOnce(new Error('失败')); await state.submitOutbound(); expect(state.outboundDialog.visible).toBe(true)
    expect(state.outboundDialog.submitting).toBe(false); state.outboundDialog.visible = false; await state.submitOutbound(); expect(api.save).toHaveBeenCalledOnce()
  })
})

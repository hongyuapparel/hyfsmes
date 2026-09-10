import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormInstance } from 'element-plus'
import { useFinishedOutboundDialog, type FinishedOutboundStockInfo } from './useFinishedOutboundDialog'
const api = vi.hoisted(() => ({ save: vi.fn(), warning: vi.fn() }))
vi.mock('@/api/inventory', () => ({ finishedOutbound: api.save, getFinishedPickupUserOptions: vi.fn() }))
vi.mock('@/api/request', () => ({ getErrorMessage: () => '出库失败', isErrorHandled: () => false }))
vi.mock('element-plus', () => ({ ElMessage: { warning: api.warning, success: vi.fn(), error: vi.fn() } }))
const stock: FinishedOutboundStockInfo = { id: 1, orderId: null, orderNo: '', skuCode: 'QA', customerName: '', quantity: 5,
  imageUrl: '', colorName: '蓝', colorImages: [], sizeBreakdown: { headers: ['S', 'M'], rows: [{ colorName: '蓝', values: [2, 3] }] } }
async function setup() {
  const state = useFinishedOutboundDialog(vi.fn(), vi.fn()); await state.initOutboundSizeList([stock])
  state.outboundFormRef.value = { validate: async () => true, clearValidate: vi.fn() } as unknown as FormInstance
  state.outboundForm.pickupUserId = 1; return state
}
beforeEach(() => { vi.clearAllMocks(); api.save.mockResolvedValue({}) })
describe('成品出库真实数量与提交保护', () => {
  it('空尺码列不改变后续尺码数量的索引', async () => {
    const state = await setup(); await state.initOutboundSizeList([{ ...stock, sizeBreakdown: { headers: ['', 'S', 'M'], rows: [{ colorName: '蓝', values: [0, 2, 3] }] } }])
    expect(state.outboundItems.value[0].rows[0].quantities).toEqual([2, 3])
  })
  it.each([-1, NaN, Infinity, 1.5])('不静默修正非法尺码数量 %s', async qty => {
    const state = await setup(); state.outboundItems.value[0].rows[0].quantities = [qty, 0]; await state.submitOutbound(); expect(api.save).not.toHaveBeenCalled()
  })
  it('正常全部出库连点只扣一次', async () => {
    const state = await setup(); await Promise.all([state.submitOutbound(), state.submitOutbound()])
    expect(api.save).toHaveBeenCalledOnce(); expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ quantity: 5 })] }))
  })
  it('表单校验明确返回 false 时不提交', async () => {
    const state = await setup()
    state.outboundFormRef.value!.validate = (async () => false) as FormInstance['validate']
    await state.submitOutbound(); expect(api.save).not.toHaveBeenCalled()
  })
  it('等待校验时关闭或切换记录，不提交新会话的数据', async () => {
    const state = await setup(); let resolve!: (value: boolean) => void
    state.outboundFormRef.value!.validate = (() => new Promise<boolean>(done => { resolve = done })) as FormInstance['validate']
    const pending = state.submitOutbound(); state.resetOutboundForm(); resolve(true); await pending; expect(api.save).not.toHaveBeenCalled()
  })
})

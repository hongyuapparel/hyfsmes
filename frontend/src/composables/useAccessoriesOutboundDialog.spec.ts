import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccessoryItem } from '@/api/inventory'
const api = vi.hoisted(() => ({ users: vi.fn(), outbound: vi.fn(), warning: vi.fn() }))
vi.mock('@/api/inventory', () => ({ getAccessoryOutboundUserOptions: api.users, manualAccessoryOutbound: api.outbound }))
vi.mock('element-plus', () => ({ ElMessage: { warning: api.warning, success: vi.fn(), error: vi.fn() } }))
import { useAccessoriesOutboundDialog } from './useAccessoriesOutboundDialog'

async function setup(sized = true) {
  const row: AccessoryItem = { id: 1, name: 'QA', category: '', quantity: 8, unit: '个', remark: '', createdAt: '',
    isSized: sized, sizeHeaders: ['S', 'M'], sizeQuantities: [3, 5] }
  const state = useAccessoriesOutboundDialog(ref([row]), vi.fn(), ref({ validate: async () => true, clearValidate: vi.fn() }))
  await state.openOutboundDialog(); state.outboundForm.pickupUserId = 1
  return state
}
beforeEach(() => {
  vi.clearAllMocks()
  api.users.mockResolvedValue({ data: [{ id: 1, username: 'admin', displayName: '管理员' }] })
  api.outbound.mockResolvedValue({})
})
describe('手动辅料出库不影响正常操作', () => {
  it.each([-1, NaN, Infinity, 1.5])('非法单码数量 %s 不被清洗后提交', async qty => {
    const state = await setup(); state.outboundForm.sizeQuantities = [qty, 1]; await state.submitOutbound(); expect(api.outbound).not.toHaveBeenCalled()
  })
  it('校验期间关闭弹窗，不继续提交', async () => {
    const selected = ref<AccessoryItem[]>([{ id: 1, name: 'QA', category: '', quantity: 8, unit: '个', remark: '', createdAt: '' }])
    let resolve!: (value: boolean) => void
    const state = useAccessoriesOutboundDialog(selected, vi.fn(), ref({ validate: () => new Promise<boolean>(done => { resolve = done }), clearValidate: vi.fn() }))
    await state.openOutboundDialog(); state.outboundForm.pickupUserId = 1
    const saving = state.submitOutbound(); state.outboundDialog.visible = false; state.resetOutboundDialog(); resolve(true); await saving
    expect(api.outbound).not.toHaveBeenCalled()
  })
  it.each([2, 8])('普通出库 %s 个正常提交，包括全部出完', async qty => {
    const state = await setup(false); state.outboundForm.quantity = qty; await state.submitOutbound()
    expect(api.outbound).toHaveBeenCalledWith(expect.objectContaining({ quantity: qty, remark: '领取人：管理员' }))
  })
  it('总量足够但单码不足时不提交', async () => {
    const state = await setup(); state.outboundForm.sizeQuantities = [4, 0]; await state.submitOutbound()
    expect(api.outbound).not.toHaveBeenCalled(); expect(api.warning).toHaveBeenCalledWith(expect.stringContaining('尺码 S 最多可出 3'))
  })
  it('各码全部出完正常提交', async () => {
    const state = await setup(); state.outboundForm.sizeQuantities = [3, 5]; await state.submitOutbound()
    expect(api.outbound).toHaveBeenCalledWith(expect.objectContaining({ quantity: 8, sizeOutbound: { headers: ['S', 'M'], quantities: [3, 5] } }))
  })
  it('总量超库存拦截', async () => {
    const state = await setup(false); state.outboundForm.quantity = 9; await state.submitOutbound()
    expect(api.outbound).not.toHaveBeenCalled()
  })
  it('快速连点只提交一次', async () => {
    const state = await setup(false)
    await Promise.all([state.submitOutbound(), state.submitOutbound()])
    expect(api.outbound).toHaveBeenCalledTimes(1)
  })
})

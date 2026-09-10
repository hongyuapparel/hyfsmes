import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccessoryItem } from '@/api/inventory'
import { useAccessoriesFormDialog } from './useAccessoriesFormDialog'
const api = vi.hoisted(() => ({ update: vi.fn(), create: vi.fn(), logs: vi.fn() }))
vi.mock('@/api/inventory', () => ({ updateAccessory: api.update, createAccessory: api.create, getAccessoryOperationLogs: api.logs }))
vi.mock('@/api/request', () => ({ getErrorMessage: () => '失败', isErrorHandled: () => false }))
vi.mock('element-plus', () => ({ ElMessage: { warning: vi.fn(), success: vi.fn(), error: vi.fn() } }))
const row: AccessoryItem = { id: 1, name: 'QA', category: '', quantity: 8, unit: '个', remark: '', createdAt: '', salesperson: 'QA' }
function setup() {
  const dialog = ref({ validate: vi.fn(async () => true), clearValidate: vi.fn() })
  const state = useAccessoriesFormDialog(ref([]), vi.fn(), dialog); state.openForm(row, 'edit'); return { state, dialog }
}
beforeEach(() => { vi.clearAllMocks(); api.update.mockResolvedValue({}); api.logs.mockResolvedValue({ data: [] }) })
describe('辅料编辑会话与日志隔离', () => {
  it('快速连续保存只写一次', async () => {
    const { state } = setup(); await Promise.all([state.submitForm(), state.submitForm()]); expect(api.update).toHaveBeenCalledOnce()
  })
  it('校验期间取消编辑，不保存还原后的表单', async () => {
    const { state, dialog } = setup(); let resolve!: (value: boolean) => void
    dialog.value.validate.mockImplementation(() => new Promise(done => { resolve = done }))
    const pending = state.submitForm(); state.exitEdit(); resolve(true); await pending; expect(api.update).not.toHaveBeenCalled()
  })
  it('A日志晚于B返回也不串到B详情', async () => {
    const { state } = setup(); let resolve!: (value: { data: { id: number }[] }) => void
    api.logs.mockReturnValueOnce(new Promise(done => { resolve = done })); state.openForm(row, 'view')
    api.logs.mockResolvedValueOnce({ data: [{ id: 2 }] }); state.openForm({ ...row, id: 2 }, 'view')
    await Promise.resolve(); resolve({ data: [{ id: 1 }] }); await Promise.resolve()
    expect(state.logs.value).toEqual([{ id: 2 }]); expect(state.formDialog.logsLoading).toBe(false)
  })
  it('清空客户与类别显式传空字符串，不改变未编辑的数量', async () => {
    const { state } = setup(); Object.assign(state.form, { customerName: undefined, category: undefined }); await state.submitForm()
    expect(api.update).toHaveBeenCalledWith(1, expect.objectContaining({ customerName: '', category: '' }))
    expect(api.update.mock.calls[0][1]).not.toHaveProperty('quantity')
  })
  it('日志未返回时进入编辑再取消，重新加载而不一直等待旧请求', async () => {
    const { state } = setup(); let resolve!: (value: { data: { id: number }[] }) => void
    api.logs.mockReturnValueOnce(new Promise(done => { resolve = done })); state.openForm(row, 'view')
    state.enterEdit(); api.logs.mockResolvedValueOnce({ data: [{ id: 3 }] }); state.exitEdit()
    await Promise.resolve(); resolve({ data: [{ id: 1 }] }); await Promise.resolve()
    expect(state.logs.value).toEqual([{ id: 3 }]); expect(state.formDialog.logsLoading).toBe(false)
  })
})

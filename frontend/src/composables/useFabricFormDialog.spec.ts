import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FabricItem } from '@/api/inventory'
import { useFabricFormDialog } from './useFabricFormDialog'

const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), logs: vi.fn(), warning: vi.fn(), error: vi.fn() }))
vi.mock('@/api/inventory', () => ({ createFabric: api.create, updateFabric: api.update, getFabricOperationLogs: api.logs }))
vi.mock('element-plus', () => ({ ElMessage: { warning: api.warning, error: api.error, success: vi.fn() } }))

const row: FabricItem = { id: 1, name: 'QA面料', quantity: '8.60', unit: '米', unitPrice: '16.0000', amount: '137.60',
  customerName: '客户A', imageUrl: '/uploads/qa.png', remark: '原备注', createdAt: '' }
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup(selected: FabricItem[] = []) {
  const reload = vi.fn()
  const validate = vi.fn().mockResolvedValue(true)
  const state = useFabricFormDialog(ref(selected), reload, ref({ validate, clearValidate: vi.fn() }), vi.fn())
  return { state, reload, validate }
}
beforeEach(() => {
  vi.clearAllMocks()
  api.create.mockResolvedValue({ data: row }); api.update.mockResolvedValue({ data: row }); api.logs.mockResolvedValue({ data: [] })
})

describe('面料表单现场与保存', () => {
  it('编辑清空客户和图片会明确提交空值，不提交只读数量', async () => {
    const { state, reload } = setup(); await state.openForm(row, 'edit')
    state.form.customerName = ''; state.form.imageUrl = ''; state.form.quantity = 999
    await state.submitForm()
    expect(api.update).toHaveBeenCalledWith(1, expect.objectContaining({ customerName: '', imageUrl: '', unitPrice: 16 }))
    expect(api.update.mock.calls[0]?.[1]).not.toHaveProperty('quantity')
    expect(reload).toHaveBeenCalledTimes(1)
  })
  it('取消编辑恢复原值，不写入接口', async () => {
    const { state } = setup(); await state.openForm(row, 'view'); state.enterEdit()
    state.form.customerName = ''; state.form.imageUrl = ''; state.form.unitPrice = 20; state.exitEdit()
    expect(state.form).toMatchObject({ customerName: '客户A', imageUrl: '/uploads/qa.png', unitPrice: 16 })
    expect(state.formDialog.mode).toBe('view'); expect(api.update).not.toHaveBeenCalled()
  })
  it('Element Plus 清空下拉返回 undefined 时仍明确删除旧值', async () => {
    const { state } = setup(); await state.openForm(row, 'edit')
    for (const key of ['customerName', 'supplierId', 'warehouseId', 'inventoryTypeId']) Reflect.set(state.form, key, undefined)
    await state.submitForm()
    expect(api.update).toHaveBeenCalledWith(1, expect.objectContaining({ customerName: '', supplierId: null, warehouseId: null, inventoryTypeId: null }))
  })
  it('快速连点新增只提交一次，避免重复入库', async () => {
    const { state } = setup([row]); await state.openForm(null)
    state.form.quantity = 2; state.form.unitPrice = 16
    await Promise.all([state.submitForm(), state.submitForm()])
    expect(api.create).toHaveBeenCalledTimes(1)
  })
  it('空白名称在编辑态也不提交', async () => {
    const { state } = setup(); await state.openForm(row, 'edit'); state.form.name = '  '
    await state.submitForm(); expect(api.update).not.toHaveBeenCalled()
  })
  it('校验未结束时关闭表单，不能继续保存', async () => {
    const { state, validate } = setup(); await state.openForm(row, 'edit')
    const gate = deferred<boolean>(); validate.mockReturnValue(gate.promise)
    const saving = state.submitForm(); state.formDialog.visible = false; state.resetForm()
    gate.resolve(true); await saving; expect(api.update).not.toHaveBeenCalled()
  })
  it('校验未结束时切换记录，不能保存另一条记录', async () => {
    const { state, validate } = setup(); await state.openForm(row, 'edit')
    const gate = deferred<boolean>(); validate.mockReturnValue(gate.promise)
    const saving = state.submitForm(); await state.openForm({ ...row, id: 2 }, 'edit')
    gate.resolve(true); await saving; expect(api.update).not.toHaveBeenCalled()
  })
  it('保存失败保留编辑内容并允许重试', async () => {
    const { state } = setup(); await state.openForm(row, 'edit'); state.form.remark = '未保存内容'
    api.update.mockRejectedValueOnce(new Error('模拟错误')); await state.submitForm()
    expect(state.formDialog.visible).toBe(true); expect(state.formDialog.submitting).toBe(false)
    expect(state.form.remark).toBe('未保存内容'); await state.submitForm(); expect(api.update).toHaveBeenCalledTimes(2)
  })
  it('暂未计价新增不带入旧成本，数量和清空字段保持原规则', async () => {
    const { state } = setup([row]); await state.openForm(null)
    expect(state.form.quantity).toBe(0); expect(state.form.unitPrice).toBeNull()
    state.form.quantity = 2; state.form.isUnpriced = true; await state.submitForm()
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ quantity: 2, unitPrice: null, otherCost: 0 }))
  })
})

describe('面料操作记录请求隔离', () => {
  it('旧记录后返回不能覆盖新记录的日志', async () => {
    const old = deferred<{ data: Array<{ id: number }> }>()
    api.logs.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ data: [{ id: 2 }] })
    const { state } = setup(); await state.openForm(row, 'view'); await state.openForm({ ...row, id: 2 }, 'view')
    await flushPromises(); old.resolve({ data: [{ id: 1 }] }); await flushPromises()
    expect(state.logs.value).toEqual([{ id: 2 }]); expect(state.formDialog.logsLoading).toBe(false)
  })
  it('旧请求失败不会清空新日志或弹出无关错误', async () => {
    const old = deferred<unknown>(); api.logs.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ data: [{ id: 2 }] })
    const { state } = setup(); await state.openForm(row, 'view'); await state.openForm({ ...row, id: 2 }, 'view')
    await flushPromises(); old.reject(new Error('旧请求失败')); await flushPromises()
    expect(state.logs.value).toEqual([{ id: 2 }]); expect(api.error).not.toHaveBeenCalled()
  })
})

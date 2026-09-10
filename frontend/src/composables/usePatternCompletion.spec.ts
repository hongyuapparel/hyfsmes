import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PatternListItem } from '@/api/production-pattern'

const api = vi.hoisted(() => ({ check: vi.fn(), complete: vi.fn(), edit: vi.fn(), upload: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
vi.mock('@/api/production-pattern', () => ({ checkPatternCompletion: api.check, completePattern: api.complete, editCompletedPattern: api.edit }))
vi.mock('@/api/uploads', () => ({ uploadImage: api.upload }))
vi.mock('element-plus', () => ({ ElMessage: { success: api.success, error: api.error, warning: api.warning } }))
vi.mock('@/api/request', () => ({ getErrorMessage: (error: Error) => error.message, isErrorHandled: () => false }))
import { usePatternCompletion } from './usePatternCompletion'

function row(id: number): PatternListItem {
  return {
    orderId: id, orderNo: `TEST-${id}`, customerName: '', salesperson: '', merchandiser: '', quantity: 1,
    arrivedAtPattern: null, completedAt: null, orderDate: null, customerDueDate: null,
    skuCode: '', imageUrl: '', orderTypeId: null, collaborationTypeId: null,
    patternStatus: 'in_progress', patternMaster: '', sampleMaker: '', sampleImageUrl: `image-${id}`,
    timeRating: '进行中', timeRatingReason: '', overdueDays: 0, canAssign: true,
  }
}
function setup(count = 3) {
  const selected = ref(Array.from({ length: count }, (_, i) => row(i + 1)))
  const loaders = { reloadList: vi.fn() }
  const state = usePatternCompletion(selected, loaders)
  return { selected, loaders, ...state }
}

describe('纸样完成', () => {
  beforeEach(() => { vi.resetAllMocks(); api.check.mockResolvedValue({ data: { issues: [] } }); api.complete.mockResolvedValue({}); api.edit.mockResolvedValue({}) })
  it('多选全部处理，保留各单图片，不受打开后列表选中项变化影响', async () => {
    const state = setup()
    state.openCompleteDialog()
    state.selected.value = []
    await state.submitComplete()
    expect(api.complete.mock.calls.map(([payload]) => payload)).toEqual([1, 2, 3].map((id) => ({ orderId: id, sampleImageUrl: `image-${id}` })))
    expect(state.completeDialog.visible).toBe(false)
    expect(state.loaders.reloadList).toHaveBeenCalledOnce()
  })
  it('部分失败显示订单及剩余数量，重试不重复提交已成功订单', async () => {
    const state = setup()
    api.complete.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('测试失败'))
    state.openCompleteDialog()
    await state.submitComplete()
    expect(state.completeDialog.error).toContain('TEST-2')
    expect(state.completeDialog.rows.map((item) => item.orderId)).toEqual([2, 3])
    expect(state.completeDialog.visible).toBe(true)
    await state.submitComplete()
    expect(api.complete.mock.calls.map(([payload]) => payload.orderId)).toEqual([1, 2, 2, 3])
    expect(state.selected.value).toEqual([])
  })
  it('连续点击不会重复发送，处理中关闭不丢失队列', async () => {
    const state = setup(1)
    let finish: (() => void) | undefined
    api.complete.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    state.openCompleteDialog()
    const submitting = state.submitComplete()
    state.resetCompleteForm()
    await state.submitComplete()
    await vi.waitFor(() => expect(api.complete).toHaveBeenCalledOnce())
    expect(state.completeDialog.rows).toHaveLength(1)
    finish?.()
    await submitting
  })
  it('图片上传时不提交，单选可保存新图片', async () => {
    const state = setup(1)
    state.openCompleteDialog()
    state.sampleImageUploading.value = true
    await state.submitComplete()
    expect(api.complete).not.toHaveBeenCalled()
    state.sampleImageUploading.value = false
    state.completeForm.sampleImageUrl = 'new-image'
    await state.submitComplete()
    expect(api.complete).toHaveBeenCalledWith({ orderId: 1, sampleImageUrl: 'new-image' })
  })
  it('纠错只允许单选并调用纠错接口，混选完成状态不提交', async () => {
    const state = setup(2)
    state.selected.value[0].patternStatus = 'completed'
    state.openCompleteDialog()
    expect(state.completeDialog.visible).toBe(false)
    state.openEditCompletedDialog()
    expect(state.completeDialog.visible).toBe(false)
    state.selected.value = [state.selected.value[0]]
    state.openEditCompletedDialog()
    await state.submitComplete()
    expect(api.edit).toHaveBeenCalledOnce()
    expect(api.complete).not.toHaveBeenCalled()
  })
  it('成功后的列表刷新失败不误报完成失败', async () => {
    const state = setup(1)
    state.loaders.reloadList.mockRejectedValue(new Error('刷新失败'))
    state.openCompleteDialog()
    await state.submitComplete()
    expect(state.completeDialog.rows).toHaveLength(0)
    expect(api.error).not.toHaveBeenCalled()
    expect(api.warning).toHaveBeenCalledOnce()
    expect(state.completeDialog.submitting).toBe(false)
  })
})

describe('工作区保存并完成', () => {
  beforeEach(() => { vi.resetAllMocks(); api.check.mockResolvedValue({ data: { issues: [] } }); api.complete.mockResolvedValue({}) })
  it('先保存当前订单再完成，不使用列表中其他勾选订单', async () => {
    const state = setup(3); const before = vi.fn(async () => true); const after = vi.fn()
    state.openCompleteDialog([row(9)], before, after)
    await state.submitComplete()
    expect(before).toHaveBeenCalledOnce()
    expect(api.complete).toHaveBeenCalledWith({ orderId: 9, sampleImageUrl: 'image-9' })
    expect(before.mock.invocationCallOrder[0]).toBeLessThan(api.complete.mock.invocationCallOrder[0])
    expect(after).toHaveBeenCalledOnce()
    expect(state.selected.value).toHaveLength(3)
  })
  it('用料保存失败不提交完成，保留窗口供重试', async () => {
    const state = setup(1); const before = vi.fn(async () => false)
    state.openCompleteDialog([row(1)], before)
    await state.submitComplete()
    expect(api.complete).not.toHaveBeenCalled()
    expect(state.completeDialog.visible).toBe(true)
    expect(state.completeDialog.submitting).toBe(false)
  })
  it('完成被后端缺项检查拦截时保留订单和错误信息', async () => {
    const state = setup(1)
    api.complete.mockRejectedValue(new Error('第 2 行请填写大于 0 的单件用量'))
    state.openCompleteDialog(); await state.submitComplete()
    expect(state.completeDialog.error).toContain('第 2 行')
    expect(state.completeDialog.rows).toHaveLength(1)
    expect(state.loaders.reloadList).not.toHaveBeenCalled()
  })
})

describe('批量完成前检查', () => {
  beforeEach(() => { vi.resetAllMocks(); api.complete.mockResolvedValue({}) })
  it('集中显示两单缺项，不写入任何完成；补齐后可重试全部', async () => {
    const state = setup(2)
    api.check.mockResolvedValueOnce({ data: { issues: [{ orderId: 1, message: '主布用量未填' }, { orderId: 2, message: '里布用量未填' }] } })
    state.openCompleteDialog(); await state.submitComplete()
    expect(state.completeDialog.error).toContain('TEST-1：主布用量未填')
    expect(state.completeDialog.error).toContain('TEST-2：里布用量未填')
    expect(api.complete).not.toHaveBeenCalled()
    expect(state.selected.value).toHaveLength(2)
    api.check.mockResolvedValueOnce({ data: { issues: [] } })
    await state.submitComplete()
    expect(api.complete).toHaveBeenCalledTimes(2)
  })
  it('前一单合格、后一单缺项也不会先完成前一单', async () => {
    const state = setup(2)
    api.check.mockResolvedValue({ data: { issues: [{ orderId: 2, message: '缺用量' }] } })
    state.openCompleteDialog(); await state.submitComplete()
    expect(api.check).toHaveBeenCalledWith([1, 2])
    expect(api.complete).not.toHaveBeenCalled()
  })
  it('检查服务不可用时不提交任何订单', async () => {
    const state = setup(2)
    api.check.mockRejectedValue(new Error('检查失败'))
    state.openCompleteDialog(); await state.submitComplete()
    expect(api.complete).not.toHaveBeenCalled()
    expect(state.completeDialog.submitting).toBe(false)
  })
})

import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PatternListItem } from '@/api/production-pattern'

const api = vi.hoisted(() => ({ complete: vi.fn(), edit: vi.fn(), upload: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() }))
vi.mock('@/api/production-pattern', () => ({ completePattern: api.complete, editCompletedPattern: api.edit }))
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
    timeRating: '进行中', timeRatingReason: '',
  }
}
function setup(count = 3) {
  const selected = ref(Array.from({ length: count }, (_, i) => row(i + 1)))
  const loaders = { reloadList: vi.fn(), reloadTabCounts: vi.fn() }
  const state = usePatternCompletion(selected, loaders)
  return { selected, loaders, ...state }
}

describe('纸样完成', () => {
  beforeEach(() => { vi.resetAllMocks(); api.complete.mockResolvedValue({}); api.edit.mockResolvedValue({}) })
  it('多选全部处理，保留各单图片，不受打开后列表选中项变化影响', async () => {
    const state = setup()
    state.openCompleteDialog()
    state.selected.value = []
    await state.submitComplete()
    expect(api.complete.mock.calls.map(([payload]) => payload)).toEqual([1, 2, 3].map((id) => ({ orderId: id, sampleImageUrl: `image-${id}` })))
    expect(state.completeDialog.visible).toBe(false)
    expect(state.loaders.reloadList).toHaveBeenCalledOnce()
    expect(state.loaders.reloadTabCounts).toHaveBeenCalledOnce()
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
    expect(api.complete).toHaveBeenCalledOnce()
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

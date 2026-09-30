import { describe, expect, it, vi } from 'vitest'
import { useFinishedCreateForm } from './useFinishedCreateForm'

describe('成品手动品名与均码', () => {
  it('新建不猜填品名，均码只在数量为空时切换', () => {
    const state = useFinishedCreateForm(vi.fn(), vi.fn())
    expect(state.createForm.productName).toBe('')
    state.createSizeRows.value[0].quantities[0] = 3
    const headers = [...state.createSizeHeaders.value]
    state.useOneSize()
    expect(state.createSizeHeaders.value).toEqual(headers)
    expect(state.createSizeRows.value[0].quantities[0]).toBe(3)
    state.createSizeRows.value[0].quantities[0] = 0
    state.useOneSize()
    expect(state.createSizeHeaders.value).toEqual(['均码'])
    expect(state.createSizeRows.value[0].quantities).toEqual([0])
  })
  it('补货继承名称与均码，关闭后重新新建不会串入上次品名', () => {
    const state = useFinishedCreateForm(vi.fn(), vi.fn())
    state.resetCreateForm({ skuCode: 'UMB001', productName: '折叠雨伞',
      sizeBreakdown: { headers: ['均码'], rows: [{ colorName: '蓝色', values: [8] }] } })
    expect(state.createForm.productName).toBe('折叠雨伞')
    expect(state.createSizeHeaders.value).toEqual(['均码'])
    state.resetCreateForm()
    expect(state.createForm.productName).toBe('')
  })
})

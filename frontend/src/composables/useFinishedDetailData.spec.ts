import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
const api = vi.hoisted(() => ({ detail: vi.fn(), save: vi.fn(), rollback: vi.fn() }))
vi.mock('@/api/inventory', () => ({ getFinishedStockDetail: api.detail, repartitionFinishedStockDetail: api.save, rollbackFinishedStockChange: api.rollback }))
import { useFinishedDetailData } from './useFinishedDetailData'

describe('成品详情请求顺序', () => {
  it.each(['save', 'rollback'] as const)('%s 请求期间打开新详情，只刷新列表且保留新编辑状态', async action => {
    let finish!: () => void
    api[action].mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    api.detail.mockResolvedValue({ data: { stock: { id: 2, skuCode: 'B' }, colorImages: [] } })
    const onMetaSaved = vi.fn().mockResolvedValue(undefined)
    const state = useFinishedDetailData({ inventoryTypeOptions: () => [], warehouseOptions: () => [],
      onColorImagesSynced: vi.fn(), onColorImageSaved: vi.fn(), onMetaSaved })
    const pending = action === 'save' ? state.saveMeta(1) : state.rollbackLog(1, 3)
    state.openDetail({ stockId: 2, groupProductImage: '', groupSizeHeaders: [], groupColorSizeSnapshot: null,
      groupColorImages: [], initialColorName: null, initialQuantity: null })
    await flushPromises()
    state.toggleEditMode()
    state.editForm.remark = 'B 尚未保存的内容'
    finish(); await pending
    expect(onMetaSaved).toHaveBeenCalledWith(false)
    expect(state.metaEditing.value).toBe(true)
    expect(state.editForm.remark).toBe('B 尚未保存的内容')
  })
  it('旧记录较慢返回时不能覆盖最新打开的详情', async () => {
    let finishOld!: (result: unknown) => void
    api.detail.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    api.detail.mockResolvedValueOnce({ data: { stock: { id: 2, skuCode: '最新记录' }, colorImages: [] } })
    const synced = vi.fn()
    const state = useFinishedDetailData({ inventoryTypeOptions: () => [], warehouseOptions: () => [],
      onColorImagesSynced: synced, onColorImageSaved: vi.fn(), onMetaSaved: async () => {} })
    const payload = { groupProductImage: '', groupSizeHeaders: [], groupColorSizeSnapshot: null,
      groupColorImages: [], initialColorName: null, initialQuantity: null }
    state.openDetail({ ...payload, stockId: 1 })
    state.openDetail({ ...payload, stockId: 2 })
    await flushPromises()
    expect(state.data.value?.stock.id).toBe(2)
    finishOld({ data: { stock: { id: 1, skuCode: '旧记录' }, colorImages: [] } })
    await flushPromises()
    expect(state.data.value?.stock.id).toBe(2)
    expect(state.editForm.skuCode).toBe('最新记录')
    expect(synced).toHaveBeenCalledTimes(1)
    expect(state.loading.value).toBe(false)
  })
})

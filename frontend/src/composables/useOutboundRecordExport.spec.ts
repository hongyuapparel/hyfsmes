import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
const request = vi.hoisted(() => vi.fn())
vi.mock('@/api/inventory-outbound-export', () => ({ exportOutboundRecords: request }))
vi.mock('element-plus', () => ({ ElMessage: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))
import { useOutboundRecordExport } from './useOutboundRecordExport'

beforeEach(() => {
  vi.clearAllMocks()
  request.mockResolvedValue({ data: new Blob(['xlsx']), headers: {} })
  Object.defineProperty(window.URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test') })
  Object.defineProperty(window.URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})

function setup() {
  const loading = ref(false), total = ref(100), name = ref(''), clearSelection = vi.fn()
  const scope = effectScope()
  const api = scope.run(() => useOutboundRecordExport({
    kind: 'finished', filename: '成品出库记录', loading: () => loading.value, total: () => total.value,
    filters: () => ({ name: name.value || undefined }), table: ref({ clearSelection }),
  }))!
  return { api, loading, total, name, clearSelection, scope }
}

describe('出库选择导出', () => {
  it('同一出库多颜色保留各行唯一键，勾选什么就导出什么', async () => {
    const { api, scope } = setup()
    api.onSelectionChange([{ id: 3, exportKey: '3:0' }, { id: 3, exportKey: '3:1' }])
    expect(api.buttonText.value).toBe('导出选中（2）')
    await api.onExport()
    expect(request).toHaveBeenCalledWith('finished', { mode: 'selected', selectedKeys: ['3:0', '3:1'] })
    scope.stop()
  })
  it('未勾选时使用当前筛选，且不传分页', async () => {
    const { api, name, scope } = setup(); name.value = '测试'
    await api.onExport()
    expect(request).toHaveBeenCalledWith('finished', { mode: 'filtered', name: '测试' })
    scope.stop()
  })
  it('筛选变化或翻页加载会清除选择，加载中禁止导出', async () => {
    const { api, name, loading, clearSelection, scope } = setup()
    api.onSelectionChange([{ id: 3 }]); name.value = '新条件'
    expect(api.selectedRows.value).toEqual([])
    api.onSelectionChange([{ id: 4 }]); loading.value = true
    expect(api.selectedRows.value).toEqual([]); expect(clearSelection).toHaveBeenCalled()
    api.onSelectionChange([{ id: 5 }]); expect(api.selectedRows.value).toEqual([])
    await api.onExport(); expect(request).not.toHaveBeenCalled()
    loading.value = false; expect(api.disabled.value).toBe(false)
    scope.stop()
  })
  it('无数据禁止导出，失败保留当前选中行以便重试', async () => {
    const { api, total, scope } = setup(); total.value = 0
    await api.onExport(); expect(request).not.toHaveBeenCalled()
    total.value = 1; api.onSelectionChange([{ id: 3 }]); request.mockRejectedValueOnce(new Error('网络故障'))
    await api.onExport(); expect(api.selectedRows.value).toEqual([{ id: 3 }]); expect(api.exporting.value).toBe(false)
    scope.stop()
  })
})

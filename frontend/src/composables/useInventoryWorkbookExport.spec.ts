import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const message = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}))

vi.mock('element-plus', () => ({ ElMessage: message }))

import { useInventoryWorkbookExport } from './useInventoryWorkbookExport'

type Row = { id: number }
type Payload = { mode: 'selected' | 'filtered'; selectedIds?: number[] }

function createHarness(rows: Row[], total = 2) {
  const request = vi.fn().mockResolvedValue({
    data: new Blob(['workbook']),
    headers: { 'x-export-row-count': '2', 'x-image-failures': '0' },
  })
  const buildPayload = vi.fn((selectedIds: number[], selectedMode: boolean): Payload => ({
    mode: selectedMode ? 'selected' : 'filtered',
    selectedIds: selectedMode ? selectedIds : undefined,
  }))
  const composable = useInventoryWorkbookExport<Row, Payload>({
    selectedRows: ref(rows),
    total: () => total,
    getRowId: (row) => row.id,
    buildPayload,
    request,
    filenamePrefix: '库存导出',
  })
  return { ...composable, buildPayload, request }
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window.URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:test'),
  })
  Object.defineProperty(window.URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
})

describe('useInventoryWorkbookExport', () => {
  it('有勾选时只提交选中的库存 ID', async () => {
    const { onExport, buildPayload, request } = createHarness([{ id: 3 }, { id: 5 }])

    await onExport()

    expect(buildPayload).toHaveBeenCalledWith([3, 5], true)
    expect(request).toHaveBeenCalledWith({ mode: 'selected', selectedIds: [3, 5] })
  })

  it('无勾选时按当前筛选条件导出', async () => {
    const { onExport, buildPayload, request } = createHarness([])

    await onExport()

    expect(buildPayload).toHaveBeenCalledWith([], false)
    expect(request).toHaveBeenCalledWith({ mode: 'filtered', selectedIds: undefined })
  })

  it('勾选行 ID 异常时阻止请求，避免误导出全部库存', async () => {
    const { onExport, request } = createHarness([{ id: 0 }])

    await onExport()

    expect(request).not.toHaveBeenCalled()
    expect(message.error).toHaveBeenCalledWith('选中的库存数据无效，请刷新页面后重试')
  })
})

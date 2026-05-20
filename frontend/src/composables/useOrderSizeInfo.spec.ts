import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useOrderSizeInfo } from './useOrderSizeInfo'
import Sortable from 'sortablejs'

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('sortablejs', () => ({
  default: {
    create: vi.fn(() => ({ destroy: vi.fn() })),
  },
}))

describe('useOrderSizeInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the table instance from child component to initialize row sorting', async () => {
    const api = useOrderSizeInfo({
      sizeHeaders: ref(['S']),
      parseClipboardText: (text: string) => text.split('\n').map((line) => line.split('\t')),
    })

    const tableRoot = document.createElement('div')
    tableRoot.innerHTML = '<div class="el-table__body-wrapper"><table><tbody><tr></tr></tbody></table></div>'

    api.setSizeInfoTableRef({ $el: tableRoot })
    api.initSizeInfoSortable()
    await nextTick()

    const tbody = tableRoot.querySelector('tbody')
    expect(Sortable.create).toHaveBeenCalledWith(tbody, expect.objectContaining({
      handle: '.size-row-drag-handle',
      draggable: '> tr',
    }))
  })

  it('reorders rows from Sortable indices when table rows do not expose row keys', async () => {
    const api = useOrderSizeInfo({
      sizeHeaders: ref(['S']),
      parseClipboardText: (text: string) => text.split('\n').map((line) => line.split('\t')),
    })
    api.sizeInfoRows.value = [
      { __rowKey: 'row-1', metaValues: ['第一行'], sizeValues: ['1'] },
      { __rowKey: 'row-2', metaValues: ['第二行'], sizeValues: ['2'] },
    ]

    const tableRoot = document.createElement('div')
    tableRoot.innerHTML = '<div class="el-table__body-wrapper"><table><tbody><tr class="el-table__row"></tr><tr class="el-table__row"></tr></tbody></table></div>'

    api.setSizeInfoTableRef({ $el: tableRoot })
    api.initSizeInfoSortable()
    await nextTick()

    const [, options] = vi.mocked(Sortable.create).mock.calls[0]
    options.onEnd?.({
      oldIndex: 1,
      newIndex: 0,
      oldDraggableIndex: 1,
      newDraggableIndex: 0,
    })

    expect(api.sizeInfoRows.value.map((row) => row.metaValues[0])).toEqual(['第二行', '第一行'])
  })
})

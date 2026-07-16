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

  describe('syncSizeValuesWithHeaderChange', () => {
    function setup() {
      const sizeHeaders = ref(['S', 'M', 'L'])
      const api = useOrderSizeInfo({
        sizeHeaders,
        parseClipboardText: (text: string) => text.split('\n').map((line) => line.split('\t')),
      })
      api.sizeInfoRows.value = [
        { __rowKey: 'row-1', metaValues: ['衣长'], sizeValues: ['10', '11', '12'] },
      ]
      return { api, sizeHeaders }
    }

    it('insert 在指定索引插入空值，原尺码数据不移位', () => {
      const { api, sizeHeaders } = setup()
      sizeHeaders.value = ['S', '尺码4', 'M', 'L']
      api.syncSizeValuesWithHeaderChange({ type: 'insert', index: 1 })
      expect(api.sizeInfoRows.value[0].sizeValues).toEqual(['10', '', '11', '12'])
    })

    it('remove 删除指定索引，两侧数据仍绑定原尺码', () => {
      const { api, sizeHeaders } = setup()
      sizeHeaders.value = ['S', 'L']
      api.syncSizeValuesWithHeaderChange({ type: 'remove', index: 1 })
      expect(api.sizeInfoRows.value[0].sizeValues).toEqual(['10', '12'])
    })

    it('append 仅在末尾补空，不影响已有值', () => {
      const { api, sizeHeaders } = setup()
      sizeHeaders.value = ['S', 'M', 'L', 'XL']
      api.syncSizeValuesWithHeaderChange({ type: 'append' })
      expect(api.sizeInfoRows.value[0].sizeValues).toEqual(['10', '11', '12', ''])
    })

    it('短数组 remove 时先补齐再删，避免 splice 无效导致错位', () => {
      const sizeHeaders = ref(['S', 'L'])
      const api = useOrderSizeInfo({
        sizeHeaders,
        parseClipboardText: (text: string) => text.split('\n').map((line) => line.split('\t')),
      })
      // 模拟脏数据：仍按旧三列意图存了 S/M/L，但 length 只有 1；headers 已变成删掉 M 后的 S/L
      // 更贴近真实：变更前为 S,M,L 且 sizeValues 过短 ['10']，删 M(index=1) 后 headers=[S,L]
      api.sizeInfoRows.value = [
        { __rowKey: 'row-1', metaValues: ['衣长'], sizeValues: ['10'] },
      ]
      api.syncSizeValuesWithHeaderChange({ type: 'remove', index: 1 })
      expect(api.sizeInfoRows.value[0].sizeValues).toEqual(['10', ''])
    })
  })
})

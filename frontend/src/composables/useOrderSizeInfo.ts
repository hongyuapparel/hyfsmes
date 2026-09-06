import type { Ref } from 'vue'
import { nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { nextRowKey, useTableRowDragSort } from '@/composables/useTableRowDragSort'
import type { SizeHeaderChange } from '@/composables/useOrderColorSizeMatrix'
import { parseSizeClipboard, serializeSizeClipboard } from '@/utils/size-grid-clipboard'

type InputComponentInstance = HTMLElement | { focus?: () => void } | null

export interface SizeInfoRow {
  __rowKey: string
  metaValues: string[]
  sizeValues: string[]
}

export interface UseOrderSizeInfoOptions {
  sizeHeaders: Ref<string[]>
  parseClipboardText: (text: string) => string[][]
}

export function useOrderSizeInfo(options: UseOrderSizeInfoOptions) {
  const { sizeHeaders } = options
  const defaultSizeMetaHeaders = ['部位cm', '量法', '样衣尺寸', '公差']
  const sizeMetaHeaders = ref<string[]>([...defaultSizeMetaHeaders])
  const sizeInfoRows = ref<SizeInfoRow[]>([])
  const sizeGridRefs = ref<InputComponentInstance[][]>([])
  const rowDragApi = useTableRowDragSort(sizeInfoRows, '.size-row-drag-handle')
  const sizeInfoTableRef = rowDragApi.tableRef

  function nextSizeInfoRowKey() {
    return nextRowKey('size-row')
  }

  function setSizeGridCellRef(el: unknown, rowIndex: number, colIndex: number) {
    if (!sizeGridRefs.value[rowIndex]) sizeGridRefs.value[rowIndex] = []
    let target: InputComponentInstance = null
    if (el && typeof el === 'object') {
      const maybeEl = el as { $el?: HTMLElement; focus?: () => void }
      if (maybeEl.$el) {
        target = (maybeEl.$el.querySelector('input') as HTMLElement | null) ?? maybeEl.$el
      } else {
        target = maybeEl as InputComponentInstance
      }
    }
    sizeGridRefs.value[rowIndex][colIndex] = target
  }

  function focusSizeGridCell(rowIndex: number, colIndex: number) {
    if (rowIndex < 0 || colIndex < 0) return
    const row = sizeGridRefs.value[rowIndex]
    const cell = row?.[colIndex]
    if (cell && typeof cell.focus === 'function') {
      nextTick(() => {
        cell.focus && cell.focus()
      })
    }
  }

  function onSizeGridKeydown(e: KeyboardEvent, rowIndex: number, colIndex: number) {
    const rowsCount = sizeInfoRows.value.length
    const colsCount = sizeMetaHeaders.value.length + sizeHeaders.value.length
    let targetRow = rowIndex
    let targetCol = colIndex

    const input = e.target as HTMLInputElement | null
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey && e.key !== 'Tab') return
    if (e.key === 'ArrowLeft' && input && input.selectionStart !== 0) return
    if (e.key === 'ArrowRight' && input && input.selectionEnd !== input.value.length) return

    if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
      targetCol = colIndex + 1
      if (targetCol >= colsCount) {
        targetCol = 0
        targetRow = rowIndex + 1
      }
    } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
      targetCol = colIndex - 1
      if (targetCol < 0) {
        targetCol = colsCount - 1
        targetRow = rowIndex - 1
      }
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      targetRow = rowIndex + 1
    } else if (e.key === 'ArrowUp') {
      targetRow = rowIndex - 1
    } else {
      return
    }

    e.preventDefault()

    if (targetRow < 0 || targetRow >= rowsCount || targetCol < 0 || targetCol >= colsCount) {
      return
    }

    focusSizeGridCell(targetRow, targetCol)
  }

  function onSizeGridPaste(e: ClipboardEvent, startRow: number, startCol: number) {
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (!text) return

    const matrix = parseSizeClipboard(text)
    if (!matrix.length) return

    const width = Math.max(...matrix.map(row => row.length))
    const columns = sizeMetaHeaders.value.length + sizeHeaders.value.length
    if (startCol + width > columns || matrix.length * width > 10000) {
      ElMessage.warning('粘贴范围超出可用列或超过 10000 格，请缩小范围或先增加对应列')
      return
    }

    const requiredRows = startRow + matrix.length
    while (sizeInfoRows.value.length < requiredRows) {
      sizeInfoRows.value.push({
        __rowKey: nextSizeInfoRowKey(),
        metaValues: Array(sizeMetaHeaders.value.length).fill(''),
        sizeValues: Array(sizeHeaders.value.length).fill(''),
      })
    }

    const maxRows = sizeInfoRows.value.length
    const totalCols = sizeMetaHeaders.value.length + sizeHeaders.value.length

    matrix.forEach((rowValues, rOffset) => {
      const rowIndex = startRow + rOffset
      if (rowIndex >= maxRows) return
      rowValues.forEach((value, cOffset) => {
        const gridCol = startCol + cOffset
        if (gridCol >= totalCols) return
        if (gridCol < sizeMetaHeaders.value.length) {
          sizeInfoRows.value[rowIndex].metaValues[gridCol] = value ?? ''
        } else {
          const sizeCol = gridCol - sizeMetaHeaders.value.length
          sizeInfoRows.value[rowIndex].sizeValues[sizeCol] = value ?? ''
        }
      })
    })
  }

  function normalizeSizeInfoRows() {
    const metaLen = sizeMetaHeaders.value.length
    const sizeLen = sizeHeaders.value.length
    sizeInfoRows.value.forEach((row) => {
      if (!row.__rowKey) row.__rowKey = nextSizeInfoRowKey()
      if (!Array.isArray(row.metaValues)) row.metaValues = []
      if (!Array.isArray(row.sizeValues)) row.sizeValues = []
      if (row.metaValues.length < metaLen) {
        row.metaValues.push(...Array(metaLen - row.metaValues.length).fill(''))
      } else if (row.metaValues.length > metaLen) {
        row.metaValues.splice(metaLen)
      }
      if (row.sizeValues.length < sizeLen) {
        row.sizeValues.push(...Array(sizeLen - row.sizeValues.length).fill(''))
      } else if (row.sizeValues.length > sizeLen) {
        row.sizeValues.splice(sizeLen)
      }
    })
  }

  /** 与 B 区尺码列增删对齐：按索引插入/删除，避免仅按长度在末尾补空导致错位 */
  function syncSizeValuesWithHeaderChange(change: SizeHeaderChange) {
    if (change.type === 'insert') {
      // headers 已含新列；先补齐到变更前长度，再按索引插入空值
      const priorLen = Math.max(sizeHeaders.value.length - 1, 0)
      sizeInfoRows.value.forEach((row) => {
        if (!Array.isArray(row.sizeValues)) row.sizeValues = []
        if (row.sizeValues.length < priorLen) {
          row.sizeValues.push(...Array(priorLen - row.sizeValues.length).fill(''))
        }
        row.sizeValues.splice(change.index, 0, '')
      })
    } else if (change.type === 'remove') {
      // headers 已去掉该列；先补齐到变更前长度，再按索引删除，避免短数组 splice 无效
      const priorLen = sizeHeaders.value.length + 1
      sizeInfoRows.value.forEach((row) => {
        if (!Array.isArray(row.sizeValues)) row.sizeValues = []
        if (row.sizeValues.length < priorLen) {
          row.sizeValues.push(...Array(priorLen - row.sizeValues.length).fill(''))
        }
        row.sizeValues.splice(change.index, 1)
      })
    }
    normalizeSizeInfoRows()
  }

  function addSizeInfoRow() {
    sizeInfoRows.value.push({
      __rowKey: nextSizeInfoRowKey(),
      metaValues: Array(sizeMetaHeaders.value.length).fill(''),
      sizeValues: Array(sizeHeaders.value.length).fill(''),
    })
  }

  function removeSizeInfoRow(index: number) {
    sizeInfoRows.value.splice(index, 1)
  }

  function addSizeMetaColumn() {
    sizeMetaHeaders.value.push(`字段${sizeMetaHeaders.value.length + 1}`)
    normalizeSizeInfoRows()
  }

  function removeSizeMetaColumn(mIndex: number) {
    if (sizeMetaHeaders.value.length <= 1) return
    sizeMetaHeaders.value.splice(mIndex, 1)
    sizeInfoRows.value.forEach((row) => {
      if (Array.isArray(row.metaValues)) row.metaValues.splice(mIndex, 1)
    })
    normalizeSizeInfoRows()
  }

  async function copySizeInfoToClipboard() {
    const headers = [...sizeMetaHeaders.value, ...sizeHeaders.value]
    const rows = sizeInfoRows.value.map((row) => {
      const meta = sizeMetaHeaders.value.map((_, idx) => row.metaValues?.[idx] ?? '')
      const sizes = sizeHeaders.value.map((_, idx) => String(row.sizeValues?.[idx] ?? ''))
      return [...meta, ...sizes]
    })
    const lines = serializeSizeClipboard([headers, ...rows])
    try {
      await navigator.clipboard.writeText(lines)
      ElMessage.success('已复制整表（含表头），可粘贴到 Excel')
    } catch {
      ElMessage.error('复制失败，请检查剪贴板权限，或选中单元格后按 Ctrl+C')
    }
  }

  return {
    defaultSizeMetaHeaders,
    sizeMetaHeaders,
    sizeInfoRows,
    sizeInfoTableRef,
    setSizeInfoTableRef: rowDragApi.setTableRef,
    sizeGridRefs,
    setSizeGridCellRef,
    focusSizeGridCell,
    onSizeGridKeydown,
    onSizeGridPaste,
    normalizeSizeInfoRows,
    syncSizeValuesWithHeaderChange,
    addSizeInfoRow,
    removeSizeInfoRow,
    initSizeInfoSortable: rowDragApi.initSortable,
    destroySizeInfoSortable: rowDragApi.destroySortable,
    addSizeMetaColumn,
    removeSizeMetaColumn,
    copySizeInfoToClipboard,
    nextSizeInfoRowKey,
  }
}

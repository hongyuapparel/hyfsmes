import { nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { nextRowKey, useTableRowDragSort } from '@/composables/useTableRowDragSort'

export type InputComponentInstance = HTMLElement | { focus?: () => void } | null

export interface SizeInfoRow {
  __rowKey: string
  metaValues: string[]
  sizeValues: string[]
}

export const defaultSizeMetaHeaders = ['部位cm', '量法', '样衣尺寸', '公差']

function nextSizeInfoRowKey() {
  return nextRowKey('size-row')
}

export function useOrderSizeInfoTable(
  getSizeHeaders: () => string[],
  parseClipboardText: (text: string) => string[][],
) {
  const sizeMetaHeaders = ref<string[]>([...defaultSizeMetaHeaders])
  const sizeInfoRows = ref<SizeInfoRow[]>([])
  const sizeGridRefs = ref<InputComponentInstance[][]>([])
  const rowDragApi = useTableRowDragSort(sizeInfoRows, '.size-row-drag-handle')
  const sizeInfoTableRef = rowDragApi.tableRef

  function normalizeSizeInfoRows() {
    const metaLen = sizeMetaHeaders.value.length
    const sizeLen = getSizeHeaders().length
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
      nextTick(() => { cell.focus && cell.focus() })
    }
  }

  function onSizeGridKeydown(e: KeyboardEvent, rowIndex: number, colIndex: number) {
    const rowsCount = sizeInfoRows.value.length
    const colsCount = sizeMetaHeaders.value.length + getSizeHeaders().length
    let targetRow = rowIndex
    let targetCol = colIndex

    if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void copySizeInfoToClipboard()
      return
    }

    if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
      targetCol = colIndex + 1
      if (targetCol >= colsCount) { targetCol = 0; targetRow = rowIndex + 1 }
    } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
      targetCol = colIndex - 1
      if (targetCol < 0) { targetCol = colsCount - 1; targetRow = rowIndex - 1 }
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      targetRow = rowIndex + 1
    } else if (e.key === 'ArrowUp') {
      targetRow = rowIndex - 1
    } else {
      return
    }

    e.preventDefault()
    if (targetRow < 0 || targetRow >= rowsCount || targetCol < 0 || targetCol >= colsCount) return
    focusSizeGridCell(targetRow, targetCol)
  }

  function onSizeGridPaste(e: ClipboardEvent, startRow: number, startCol: number) {
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (!text) return
    const matrix = parseClipboardText(text)
    if (!matrix.length) return

    const requiredRows = startRow + matrix.length
    while (sizeInfoRows.value.length < requiredRows) {
      sizeInfoRows.value.push({
        __rowKey: nextSizeInfoRowKey(),
        metaValues: Array(sizeMetaHeaders.value.length).fill(''),
        sizeValues: Array(getSizeHeaders().length).fill(''),
      })
    }

    const maxRows = sizeInfoRows.value.length
    const totalCols = sizeMetaHeaders.value.length + getSizeHeaders().length
    matrix.forEach((rowValues, rOffset) => {
      const rowIndex = startRow + rOffset
      if (rowIndex >= maxRows) return
      rowValues.forEach((value, cOffset) => {
        const gridCol = startCol + cOffset
        if (gridCol >= totalCols) return
        if (gridCol < sizeMetaHeaders.value.length) {
          sizeInfoRows.value[rowIndex].metaValues[gridCol] = value ?? ''
        } else {
          sizeInfoRows.value[rowIndex].sizeValues[gridCol - sizeMetaHeaders.value.length] = value ?? ''
        }
      })
    })
  }

  function addSizeInfoRow() {
    sizeInfoRows.value.push({
      __rowKey: nextSizeInfoRowKey(),
      metaValues: Array(sizeMetaHeaders.value.length).fill(''),
      sizeValues: Array(getSizeHeaders().length).fill(''),
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
    const sizeHeaders = getSizeHeaders()
    const headers = [...sizeMetaHeaders.value, ...sizeHeaders]
    const rows = sizeInfoRows.value.map((row) => {
      const meta = sizeMetaHeaders.value.map((_, idx) => row.metaValues?.[idx] ?? '')
      const sizes = sizeHeaders.map((_, idx) => String(row.sizeValues?.[idx] ?? ''))
      return [...meta, ...sizes]
    })
    const lines = [headers, ...rows].map((r) => r.join('\t')).join('\n')
    try {
      const nav = navigator as { clipboard?: { writeText?: (text: string) => Promise<void> } }
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(lines)
        ElMessage.success('已复制到剪贴板，可直接粘贴到 Excel')
      } else {
        throw new Error('clipboard not available')
      }
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = lines
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        ElMessage.success('已复制到剪贴板，可直接粘贴到 Excel')
      } catch {
        ElMessage.error('复制失败，请手动选择后复制')
      } finally {
        document.body.removeChild(textarea)
      }
    }
  }

  return {
    defaultSizeMetaHeaders,
    sizeMetaHeaders,
    sizeInfoRows,
    sizeInfoTableRef,
    sizeGridRefs,
    nextSizeInfoRowKey,
    normalizeSizeInfoRows,
    setSizeGridCellRef,
    focusSizeGridCell,
    onSizeGridKeydown,
    onSizeGridPaste,
    addSizeInfoRow,
    removeSizeInfoRow,
    initSizeInfoSortable: rowDragApi.initSortable,
    destroySizeInfoSortable: rowDragApi.destroySortable,
    addSizeMetaColumn,
    removeSizeMetaColumn,
    copySizeInfoToClipboard,
  }
}

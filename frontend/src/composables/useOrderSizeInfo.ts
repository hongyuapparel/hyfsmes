import type { Ref } from 'vue'
import { nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus'
import Sortable from 'sortablejs'

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
  const { sizeHeaders, parseClipboardText } = options
  const defaultSizeMetaHeaders = ['部位cm', '量法', '样衣尺寸', '公差']
  const sizeMetaHeaders = ref<string[]>([...defaultSizeMetaHeaders])
  const sizeInfoRows = ref<SizeInfoRow[]>([])
  const sizeInfoTableRef = ref<any>()
  const sizeGridRefs = ref<InputComponentInstance[][]>([])
  let sizeInfoSortable: Sortable | null = null
  let sizeInfoRowKeySeed = 0

  function nextSizeInfoRowKey() {
    sizeInfoRowKeySeed += 1
    return `size-row-${Date.now()}-${sizeInfoRowKeySeed}`
  }

  function setSizeGridCellRef(el: unknown, rowIndex: number, colIndex: number) {
    if (!sizeGridRefs.value[rowIndex]) sizeGridRefs.value[rowIndex] = []
    let target: InputComponentInstance = null
    if (el && typeof el === 'object') {
      const anyEl = el as any
      if (anyEl.$el) {
        target = (anyEl.$el.querySelector('input') as HTMLElement | null) ?? (anyEl.$el as HTMLElement)
      } else {
        target = anyEl as InputComponentInstance
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

    if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      void copySizeInfoToClipboard()
      return
    }

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

    const matrix = parseClipboardText(text)
    if (!matrix.length) return

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

  function initSizeInfoSortable() {
    nextTick(() => {
      const root = sizeInfoTableRef.value?.$el as HTMLElement | undefined
      const tbody = root?.querySelector('.el-table__body-wrapper tbody') as HTMLElement | null
      if (!tbody) return

      destroySizeInfoSortable()

      sizeInfoSortable = Sortable.create(tbody, {
        animation: 120,
        handle: '.size-row-drag-handle',
        draggable: '> tr',
        onEnd: (evt) => {
          const orderedKeys = Array.from(tbody.querySelectorAll('tr.el-table__row'))
            .map((tr) => tr.getAttribute('data-row-key'))
            .filter((k): k is string => !!k)
          if (orderedKeys.length === sizeInfoRows.value.length) {
            const rowMap = new Map(sizeInfoRows.value.map((r) => [r.__rowKey, r]))
            const nextRows = orderedKeys.map((k) => rowMap.get(k)).filter((r): r is SizeInfoRow => !!r)
            if (nextRows.length === sizeInfoRows.value.length) {
              sizeInfoRows.value = nextRows
              return
            }
          }
          const anyEvt = evt as unknown as {
            oldIndex?: number
            newIndex?: number
            oldDraggableIndex?: number
            newDraggableIndex?: number
          }
          const oldIndex = anyEvt.oldDraggableIndex ?? anyEvt.oldIndex
          const newIndex = anyEvt.newDraggableIndex ?? anyEvt.newIndex
          if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
          if (
            oldIndex < 0 ||
            newIndex < 0 ||
            oldIndex >= sizeInfoRows.value.length ||
            newIndex >= sizeInfoRows.value.length
          ) {
            return
          }
          const moved = sizeInfoRows.value.splice(oldIndex, 1)[0]
          if (!moved) return
          sizeInfoRows.value.splice(newIndex, 0, moved)
        },
      })
    })
  }

  function destroySizeInfoSortable() {
    if (sizeInfoSortable) {
      sizeInfoSortable.destroy()
      sizeInfoSortable = null
    }
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
    const lines = [headers, ...rows].map((r) => r.join('\t')).join('\n')
    try {
      const nav: any = navigator
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
    setSizeGridCellRef,
    focusSizeGridCell,
    onSizeGridKeydown,
    onSizeGridPaste,
    normalizeSizeInfoRows,
    addSizeInfoRow,
    removeSizeInfoRow,
    initSizeInfoSortable,
    destroySizeInfoSortable,
    addSizeMetaColumn,
    removeSizeMetaColumn,
    copySizeInfoToClipboard,
    nextSizeInfoRowKey,
  }
}

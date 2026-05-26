import { computed, nextTick, ref } from 'vue'

export type InputComponentInstance = HTMLElement | { focus?: () => void } | null
export type BEditCol = number | 'color' | 'remark'

export interface ColorRow {
  colorName: string
  quantities: number[]
  remark: string
}

export const defaultSizeHeaders = ['S', 'M', 'L', 'XL', '2XL']

export function useOrderColorSizeTable() {
  const sizeHeaders = ref<string[]>([...defaultSizeHeaders])
  const colorRows = ref<ColorRow[]>([])
  const editingCell = ref<{ rowIndex: number; col: BEditCol } | null>(null)
  const bTableRef = ref<{ $el?: HTMLElement } | null>(null)
  const colorCellRefs = ref<InputComponentInstance[][]>([])
  const activeColorCell = ref<{ row: number; col: number } | null>(null)
  const colorNameInputRef = ref<{ focus: () => void; $el?: HTMLElement } | null>(null)
  const remarkInputRef = ref<{ focus: () => void; $el?: HTMLElement } | null>(null)

  const sizeTotals = computed(() => {
    const len = sizeHeaders.value.length
    const sums = Array(len).fill(0) as number[]
    colorRows.value.forEach((row) => {
      row.quantities.forEach((num, idx) => {
        sums[idx] += Number(num) || 0
      })
    })
    return sums
  })

  const grandTotal = computed(() => sizeTotals.value.reduce((s, n) => s + n, 0))

  function normalizeColorRows() {
    const len = sizeHeaders.value.length
    colorRows.value.forEach((row) => {
      if (!Array.isArray(row.quantities)) row.quantities = []
      if (row.quantities.length < len) {
        row.quantities.push(...Array(len - row.quantities.length).fill(0))
      } else if (row.quantities.length > len) {
        row.quantities.splice(len)
      }
    })
  }

  function setColorCellRef(el: unknown, rowIndex: number, colIndex: number) {
    if (!colorCellRefs.value[rowIndex]) colorCellRefs.value[rowIndex] = []
    let target: InputComponentInstance = null
    if (el && typeof el === 'object') {
      const maybeEl = el as { $el?: HTMLElement; focus?: () => void }
      if (maybeEl.$el) {
        target = (maybeEl.$el.querySelector('input') as HTMLElement | null) ?? maybeEl.$el
      } else {
        target = maybeEl as InputComponentInstance
      }
    }
    colorCellRefs.value[rowIndex][colIndex] = target
  }

  function setActiveColorCell(rowIndex: number, colIndex: number) {
    activeColorCell.value = { row: rowIndex, col: colIndex }
  }

  function focusColorCell(rowIndex: number, colIndex: number) {
    if (rowIndex < 0 || colIndex < 0) return
    editingCell.value = { rowIndex, col: colIndex }
    nextTick(() => {
      const row = colorCellRefs.value[rowIndex]
      const cell = row?.[colIndex]
      if (cell && typeof cell.focus === 'function') {
        cell.focus && cell.focus()
        activeColorCell.value = { row: rowIndex, col: colIndex }
      }
    })
  }

  function startEditBCell(rowIndex: number, col: BEditCol) {
    editingCell.value = { rowIndex, col }
    if (typeof col === 'number') {
      nextTick(() => focusColorCell(rowIndex, col))
    } else {
      nextTick(() => {
        const ref = col === 'color' ? colorNameInputRef.value : remarkInputRef.value
        const input = ref?.$el?.querySelector?.('input') ?? ref?.$el
        if (input?.focus) input.focus()
        else if (typeof ref?.focus === 'function') ref.focus()
      })
    }
  }

  function onBCellBlur() {
    setTimeout(() => {
      const root = bTableRef.value?.$el ?? bTableRef.value
      const container =
        root instanceof HTMLElement
          ? root
          : root && typeof root === 'object' && '$el' in root && root.$el instanceof HTMLElement
            ? root.$el
            : null
      const active = document.activeElement as HTMLElement | null
      if (!container || !active || !container.contains(active)) {
        editingCell.value = null
      }
    }, 0)
  }

  function onColorCellKeydown(e: KeyboardEvent, rowIndex: number, colIndex: number) {
    const rowsCount = colorRows.value.length
    const colsCount = sizeHeaders.value.length
    let targetRow = rowIndex
    let targetCol = colIndex

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
    focusColorCell(targetRow, targetCol)
  }

  function parseClipboardText(text: string): string[][] {
    return text
      .split(/\r?\n/)
      .map((line) => line.split('\t'))
      .filter((row) => row.some((cell) => cell.trim() !== ''))
  }

  function onColorCellPaste(e: ClipboardEvent, startRow: number, startCol: number) {
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (!text) return
    const matrix = parseClipboardText(text)
    if (!matrix.length) return
    const maxRows = colorRows.value.length
    const maxCols = sizeHeaders.value.length
    matrix.forEach((rowValues, rOffset) => {
      const rowIndex = startRow + rOffset
      if (rowIndex >= maxRows) return
      rowValues.forEach((value, cOffset) => {
        const colIndex = startCol + cOffset
        if (colIndex >= maxCols) return
        const clean = value.replace(/[^\d.-]/g, '')
        const num = Number(clean)
        colorRows.value[rowIndex].quantities[colIndex] = Number.isNaN(num) ? 0 : num
      })
    })
  }

  function ensureAtLeastOneColorRow() {
    if (colorRows.value.length > 0) return
    colorRows.value.push({ colorName: '', quantities: Array(sizeHeaders.value.length).fill(0), remark: '' })
  }

  function addColorRow() {
    colorRows.value.push({ colorName: '', quantities: Array(sizeHeaders.value.length).fill(0), remark: '' })
  }

  function removeColorRow(index: number) {
    colorRows.value.splice(index, 1)
    ensureAtLeastOneColorRow()
  }

  function guessSizeLabelBefore(sIndex: number): string {
    const current = String(sizeHeaders.value[sIndex] ?? '').trim().toUpperCase()
    if (current === 'S') {
      const hasXS = sizeHeaders.value.some((h) => String(h ?? '').trim().toUpperCase() === 'XS')
      if (!hasXS) return 'XS'
    }
    return `尺码${sizeHeaders.value.length + 1}`
  }

  function addSizeColumn(onAfter?: () => void) {
    sizeHeaders.value.push(`尺码${sizeHeaders.value.length + 1}`)
    normalizeColorRows()
    onAfter?.()
  }

  function insertSizeColumnBefore(sIndex: number, onAfter?: () => void) {
    if (sIndex < 0 || sIndex > sizeHeaders.value.length) return
    sizeHeaders.value.splice(sIndex, 0, guessSizeLabelBefore(sIndex))
    colorRows.value.forEach((row) => {
      if (!Array.isArray(row.quantities)) row.quantities = []
      row.quantities.splice(sIndex, 0, 0)
    })
    const cur = editingCell.value
    if (cur && typeof cur.col === 'number' && cur.col >= sIndex) {
      editingCell.value = { ...cur, col: cur.col + 1 }
    }
    normalizeColorRows()
    onAfter?.()
  }

  function removeSizeColumn(sIndex: number, onAfter?: () => void) {
    if (sizeHeaders.value.length <= 1) return
    sizeHeaders.value.splice(sIndex, 1)
    colorRows.value.forEach((row) => {
      if (Array.isArray(row.quantities)) row.quantities.splice(sIndex, 1)
    })
    const cur = editingCell.value
    if (cur && typeof cur.col === 'number') {
      if (cur.col === sIndex) editingCell.value = null
      else if (cur.col > sIndex) editingCell.value = { ...cur, col: cur.col - 1 }
    }
    onAfter?.()
  }

  function calcRowTotal(row: ColorRow) {
    return (row.quantities ?? []).reduce((s, n) => s + (Number(n) || 0), 0)
  }

  function bSummaryMethod() {
    const totals = sizeTotals.value
    const total = grandTotal.value
    const row: (string | number)[] = ['合计', ...totals, total, '', '']
    return row
  }

  return {
    defaultSizeHeaders,
    sizeHeaders,
    colorRows,
    editingCell,
    bTableRef,
    colorCellRefs,
    activeColorCell,
    colorNameInputRef,
    remarkInputRef,
    sizeTotals,
    grandTotal,
    setColorCellRef,
    setActiveColorCell,
    focusColorCell,
    startEditBCell,
    onBCellBlur,
    onColorCellKeydown,
    parseClipboardText,
    onColorCellPaste,
    normalizeColorRows,
    ensureAtLeastOneColorRow,
    addColorRow,
    removeColorRow,
    addSizeColumn,
    guessSizeLabelBefore,
    insertSizeColumnBefore,
    removeSizeColumn,
    calcRowTotal,
    bSummaryMethod,
  }
}

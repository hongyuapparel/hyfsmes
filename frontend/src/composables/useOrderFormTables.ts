import { computed, nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus'
import Sortable from 'sortablejs'

export type InputComponentInstance = HTMLElement | { focus?: () => void } | null
export type BEditCol = number | 'color' | 'remark'

export interface ColorRow {
  colorName: string
  quantities: number[]
  remark: string
}

export interface SizeInfoRow {
  __rowKey: string
  metaValues: string[]
  sizeValues: string[]
}

// B 区
const defaultSizeHeaders = ['S', 'M', 'L', 'XL', '2XL']
const sizeHeaders = ref<string[]>([...defaultSizeHeaders])
const colorRows = ref<ColorRow[]>([])
const editingCell = ref<{ rowIndex: number; col: BEditCol } | null>(null)
const bTableRef = ref<{ $el?: HTMLElement } | null>(null)
const colorCellRefs = ref<InputComponentInstance[][]>([])
const activeColorCell = ref<{ row: number; col: number } | null>(null)
const colorNameInputRef = ref<{ focus: () => void; $el?: HTMLElement } | null>(null)
const remarkInputRef = ref<{ focus: () => void; $el?: HTMLElement } | null>(null)

// D 区
const defaultSizeMetaHeaders = ['部位cm', '量法', '样衣尺寸', '公差']
const sizeMetaHeaders = ref<string[]>([...defaultSizeMetaHeaders])
const sizeInfoRows = ref<SizeInfoRow[]>([])
const sizeInfoTableRef = ref<{ $el?: HTMLElement } | null>(null)
let sizeInfoSortable: Sortable | null = null
let sizeInfoRowKeySeed = 0
const sizeGridRefs = ref<InputComponentInstance[][]>([])

function nextSizeInfoRowKey() {
  sizeInfoRowKeySeed += 1
  return `size-row-${Date.now()}-${sizeInfoRowKeySeed}`
}

// B 区 computed
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

// D 区 normalize (shared with B via sizeHeaders)
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

// B 区 functions
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

function addSizeColumn() {
  sizeHeaders.value.push(`尺码${sizeHeaders.value.length + 1}`)
  normalizeColorRows()
  normalizeSizeInfoRows()
}

function insertSizeColumnBefore(sIndex: number) {
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
  normalizeSizeInfoRows()
}

function removeSizeColumn(sIndex: number) {
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
  normalizeSizeInfoRows()
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

// D 区 functions
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
        sizeInfoRows.value[rowIndex].sizeValues[gridCol - sizeMetaHeaders.value.length] = value ?? ''
      }
    })
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

    if (sizeInfoSortable) {
      sizeInfoSortable.destroy()
      sizeInfoSortable = null
    }

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
          oldIndex?: number; newIndex?: number
          oldDraggableIndex?: number; newDraggableIndex?: number
        }
        const oldIndex = anyEvt.oldDraggableIndex ?? anyEvt.oldIndex
        const newIndex = anyEvt.newDraggableIndex ?? anyEvt.newIndex
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
        if (oldIndex < 0 || newIndex < 0 || oldIndex >= sizeInfoRows.value.length || newIndex >= sizeInfoRows.value.length) return
        const moved = sizeInfoRows.value.splice(oldIndex, 1)[0]
        if (!moved) return
        sizeInfoRows.value.splice(newIndex, 0, moved)
      },
    })
  })
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

function destroySizeInfoSortable() {
  if (sizeInfoSortable) {
    sizeInfoSortable.destroy()
    sizeInfoSortable = null
  }
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

export function useOrderFormTables() {
  return {
    // B 区
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
    // D 区
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
    initSizeInfoSortable,
    destroySizeInfoSortable,
    addSizeMetaColumn,
    removeSizeMetaColumn,
    copySizeInfoToClipboard,
  }
}

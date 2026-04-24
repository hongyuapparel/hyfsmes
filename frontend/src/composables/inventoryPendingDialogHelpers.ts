import { formatDisplayNumber } from '@/utils/display-number'
import type { InboundPreviewItem, PendingOutboundDialogItem } from '@/composables/useInventoryPendingDialogs'

export function getOutboundItemTotal(item: PendingOutboundDialogItem) {
  return item.rows.reduce(
    (sum, row) => sum + row.quantities.reduce((rowSum, q) => rowSum + (Number(q) || 0), 0),
    0,
  )
}

export function getOutboundRowTotal(row: { quantities: number[] }) {
  return row.quantities.reduce((rowSum, q) => rowSum + (Number(q) || 0), 0)
}

/**
 * 按订单颜色×尺码比例，将「待处理数量」预填到各格（合计等于 targetTotal，可直接改）。
 * baseRows 来自接口，values 末尾可能含「合计」列，仅取前 headersLen 格参与比例。
 */
export function distributePendingToColorSizeGrid(
  dialogRows: Array<{ quantities: number[] }>,
  baseRows: Array<{ colorName?: string; values: number[] }>,
  headersLen: number,
  targetTotal: number,
) {
  if (!headersLen || !dialogRows.length) return
  const flatBase: number[] = []
  const rowCount = Math.min(dialogRows.length, baseRows.length)
  for (let ri = 0; ri < rowCount; ri++) {
    const vals = baseRows[ri]?.values ?? []
    for (let ci = 0; ci < headersLen; ci++) {
      flatBase.push(Math.max(0, Number(vals[ci]) || 0))
    }
  }
  const n = flatBase.length
  const baseSum = flatBase.reduce((a, b) => a + b, 0)
  let flatOut: number[]
  if (targetTotal <= 0 || n === 0) {
    flatOut = new Array(n).fill(0)
  } else if (baseSum === 0) {
    flatOut = new Array(n).fill(0)
    flatOut[0] = targetTotal
  } else {
    const scaled = flatBase.map((v) => (v / baseSum) * targetTotal)
    const floors = scaled.map((x) => Math.floor(x))
    const rem = targetTotal - floors.reduce((a, b) => a + b, 0)
    const order = scaled
      .map((x, i) => ({ i, f: x - floors[i] }))
      .sort((a, b) => b.f - a.f || a.i - b.i)
    for (let k = 0; k < rem; k++) {
      floors[order[k].i]++
    }
    flatOut = floors
  }
  let idx = 0
  for (let ri = 0; ri < dialogRows.length; ri++) {
    for (let ci = 0; ci < headersLen; ci++) {
      dialogRows[ri].quantities[ci] = idx < flatOut.length ? flatOut[idx] : 0
      idx++
    }
  }
}

export function getOutboundTableSummaries(
  item: PendingOutboundDialogItem,
  param: { columns: unknown[]; data: Array<{ quantities: number[] }> },
) {
  const { columns, data } = param
  const sums: string[] = []
  const lastCol = columns.length - 1
  columns.forEach((_, index) => {
    if (index === 0) {
      sums[index] = '合计'
      return
    }
    if (index === lastCol) {
      sums[index] = formatDisplayNumber(getOutboundItemTotal(item))
      return
    }
    const colIdx = index - 1
    if (colIdx < 0 || colIdx >= item.headers.length) {
      sums[index] = ''
      return
    }
    const total = data.reduce((sum, row) => sum + (Number(row.quantities[colIdx]) || 0), 0)
    sums[index] = formatDisplayNumber(total)
  })
  return sums
}

export function toInboundPreviewTableRows(item: InboundPreviewItem) {
  return item.rows.map((row) => ({
    colorName: row.colorName,
    values: item.headers.map((_, idx) => Number(row.values?.[idx] ?? 0)),
  }))
}

export function getInboundPreviewRowTotal(values: number[]) {
  return values.reduce((sum, v) => sum + (Number(v) || 0), 0)
}

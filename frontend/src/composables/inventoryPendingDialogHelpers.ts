import { formatDisplayNumber } from '@/utils/display-number'
import type { PendingListItem } from '@/api/inventory'
import type {
  InboundPreviewItem,
  PendingColorSizeCache,
  PendingOutboundDialogItem,
} from '@/composables/useInventoryPendingDialogs'

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
 * 按颜色×尺码比例，将数量预填到各格（合计等于 targetTotal）。
 * baseRows.values 末尾可能含「合计」列，仅取前 headersLen 格。
 * 仅用于：本批 snapshot 合计与待处理数量短暂不一致时的兜底（正常分批后应已扣减对齐）。
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

/** 发货弹窗预填：优先本批 snapshot；无则仅借表头手工填（不用订单计划数量）。 */
export function buildOutboundDialogItem(
  row: PendingListItem,
  colorSizeCache: PendingColorSizeCache,
): { item: PendingOutboundDialogItem; warning?: string } {
  const target = Number(row.quantity) || 0
  const snap = row.colorSizeSnapshot
  if (snap?.headers?.length && snap.rows?.length) {
    const headers = snap.headers.filter((h) => h !== '合计')
    const dialogRows = snap.rows.map((r) => ({
      colorName: r.colorName || '',
      quantities: headers.map((_, i) => Math.max(0, Math.trunc(Number(r.quantities?.[i]) || 0))),
    }))
    const snapTotal = dialogRows.reduce(
      (sum, r) => sum + r.quantities.reduce((a, b) => a + b, 0),
      0,
    )
    if (snapTotal === target) {
      return { item: { row, headers, rows: dialogRows } }
    }
    if (snapTotal > 0 && target > 0 && target < snapTotal) {
      // 老数据未扣减 snapshot 时：按真实剩余总数从本批比例缩（优于订单计划）
      distributePendingToColorSizeGrid(
        dialogRows,
        snap.rows.map((r) => ({ colorName: r.colorName, values: r.quantities ?? [] })),
        headers.length,
        target,
      )
      return {
        item: { row, headers, rows: dialogRows },
        warning: `订单 ${row.orderNo} / ${row.skuCode} 尺码明细合计(${snapTotal})与待处理数(${target})不一致，已按本批比例预填，请核对后发货`,
      }
    }
    return {
      item: { row, headers, rows: dialogRows },
      warning: `订单 ${row.orderNo} / ${row.skuCode} 尺码明细合计(${snapTotal})与待处理数(${target})不一致，请手工核对各码数量`,
    }
  }
  const breakdown = row.orderId ? colorSizeCache[row.orderId] : undefined
  const headers = (breakdown?.headers ?? []).filter((h) => h !== '合计')
  const br = breakdown?.rows ?? []
  // 无本批真值：只用表头开空表，禁止按订单计划自动填数
  const dialogRows =
    br.length > 0
      ? br.map((r) => ({
          colorName: r.colorName,
          quantities: headers.map(() => 0),
        }))
      : headers.length
        ? [{ colorName: '-', quantities: headers.map(() => 0) }]
        : []
  return {
    item: { row, headers, rows: dialogRows },
    warning: headers.length
      ? `订单 ${row.orderNo} / ${row.skuCode} 未留存本批尺码明细，请手工填写发货数量（不可用订单计划估算）`
      : undefined,
  }
}

export function buildInboundPreviewItem(
  row: PendingListItem,
  colorSizeCache: PendingColorSizeCache,
): InboundPreviewItem {
  const snap = row.colorSizeSnapshot
  if (snap?.headers?.length && snap.rows?.length) {
    const headers = snap.headers.filter((h) => h !== '合计')
    return {
      id: row.id,
      orderId: row.orderId,
      orderNo: row.orderNo,
      skuCode: row.skuCode,
      quantity: row.quantity,
      headers,
      rows: snap.rows.map((r) => ({
        colorName: r.colorName || '',
        values: headers.map((_, i) => Math.max(0, Math.trunc(Number(r.quantities?.[i]) || 0))),
      })),
    }
  }
  const breakdown = row.orderId ? colorSizeCache[row.orderId] : undefined
  const headers = (breakdown?.headers ?? []).filter((h) => h !== '合计')
  return {
    id: row.id,
    orderId: row.orderId,
    orderNo: row.orderNo,
    skuCode: row.skuCode,
    quantity: row.quantity,
    headers,
    rows: breakdown?.rows ?? [],
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

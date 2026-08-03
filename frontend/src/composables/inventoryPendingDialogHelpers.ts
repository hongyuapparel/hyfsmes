import { formatDisplayNumber } from '@/utils/display-number'
import type { PendingListItem } from '@/api/inventory'
import type {
  InboundPreviewItem,
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

/** 发货弹窗只接受与待处理数量一致的本批事实快照。 */
export function buildOutboundDialogItem(
  row: PendingListItem,
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
    if (snapTotal === target && row.detailStatus === 'recorded') {
      return { item: { row, headers, rows: dialogRows } }
    }
    return {
      item: { row, headers: [], rows: [] },
      warning: `订单 ${row.orderNo} / ${row.skuCode} 本批明细合计(${snapTotal})与待处理数(${target})不一致，请先在尾部纠错中按实际数据修正`,
    }
  }
  return {
    item: { row, headers: [], rows: [] },
    warning: row.detailStatus === 'missing'
      ? `订单 ${row.orderNo} / ${row.skuCode} 未留存本批颜色尺码明细，请先在尾部纠错中按实际数据补录`
      : `订单 ${row.orderNo} / ${row.skuCode} 没有可用的颜色尺码明细，暂不支持从此弹窗发货`,
  }
}

export function buildInboundPreviewItem(
  row: PendingListItem,
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
  return {
    id: row.id,
    orderId: row.orderId,
    orderNo: row.orderNo,
    skuCode: row.skuCode,
    quantity: row.quantity,
    headers: [],
    rows: [],
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

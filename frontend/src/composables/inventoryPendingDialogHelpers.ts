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
    const columns = snap.headers.map((header, index) => ({ header, index })).filter(c => c.header !== '合计')
    const headers = columns.map(c => c.header)
    const dialogRows = snap.rows.map((r) => ({
      colorName: r.colorName || '',
      quantities: columns.map(c => r.quantities[c.index]),
      availableQuantities: columns.map(c => r.quantities[c.index]),
    }))
    if (!headers.length || new Set(headers).size !== headers.length || headers.some(h => !h.trim()) ||
      dialogRows.some(r => r.quantities.some(q => !Number.isInteger(q) || q < 0))) {
      return { item: { row, headers: [], rows: [] }, warning: `订单 ${row.orderNo} / ${row.skuCode} 本批尺码或数量明细无效，请先核对原始登记` }
    }
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
    const columns = snap.headers.map((header, index) => ({ header, index })).filter(c => c.header !== '合计')
    const headers = columns.map(c => c.header)
    return {
      id: row.id,
      orderId: row.orderId,
      orderNo: row.orderNo,
      skuCode: row.skuCode,
      quantity: row.quantity,
      headers,
      rows: snap.rows.map((r) => ({
        colorName: r.colorName || '',
        values: columns.map(c => r.quantities[c.index]),
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

export function getOutboundValidationMessage(item: PendingOutboundDialogItem): string {
  const label = `订单 ${item.row.orderNo} / ${item.row.skuCode}`
  if (!item.headers.length || !item.rows.length) return `${label} 暂无颜色尺码明细，无法发货`
  for (const row of item.rows) {
    for (let index = 0; index < item.headers.length; index++) {
      const quantity = row.quantities[index]
      const available = row.availableQuantities[index]
      if (!Number.isInteger(quantity) || quantity < 0) return `${label} ${row.colorName} / ${item.headers[index]} 请填写非负整数`
      if (quantity > available) return `${label} ${row.colorName} / ${item.headers[index]} 最多可发 ${available} 件，当前填写 ${quantity} 件`
    }
  }
  const total = getOutboundItemTotal(item)
  if (total <= 0) return `${label} 请填写发货数量`
  if (total > item.row.quantity) return `${label} 发货数量不能大于当前待处理数量`
  return ''
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

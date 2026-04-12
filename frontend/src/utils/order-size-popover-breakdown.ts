import type { OrderSizeBreakdownColorBlock, OrderSizeBreakdownRes } from '@/api/orders'

/** 与订单列表数量悬停一致：补齐列、过滤行、尾部入库数按参考行分摊到尺码列 */
export function normalizeBlockRows(
  headers: string[],
  rowsIn: Array<{ label: string; values: (number | null)[] }>,
): Array<{ label: string; values: (number | null)[] }> {
  const expectedLen = headers.length
  let rows = Array.isArray(rowsIn) ? rowsIn.map((r) => ({ ...r, values: [...(r.values ?? [])] })) : []

  rows = rows.filter((r) => r.label !== '尾部出货数')

  if (expectedLen <= 1) return rows

  const inbound = rows.find((r) => r.label === '尾部入库数')
  if (!inbound) return rows

  while (inbound.values.length < expectedLen) inbound.values.push(null)
  inbound.values = inbound.values.slice(0, expectedLen)

  const inboundTotalRaw = inbound.values[expectedLen - 1]
  const inboundTotal = Number(inboundTotalRaw)
  if (!Number.isFinite(inboundTotal) || inboundTotal <= 0) return rows

  const hasInboundPerSize = inbound.values.slice(0, expectedLen - 1).some((v) => Number(v) > 0)
  if (hasInboundPerSize) return rows

  const referenceLabels = ['尾部收货数', '车缝数量', '裁床数量', '订单数量']
  const refRow = rows.find((r) => referenceLabels.includes(r.label))
  if (!refRow || !Array.isArray(refRow.values) || refRow.values.length < expectedLen) return rows

  const base = refRow.values.slice(0, expectedLen - 1).map((v) => Math.max(0, Number(v) || 0))
  const baseTotal = base.reduce((sum, n) => sum + n, 0)
  if (baseTotal <= 0) return rows

  const exact = base.map((n) => (n * inboundTotal) / baseTotal)
  const floors = exact.map((n) => Math.floor(n))
  let remain = inboundTotal - floors.reduce((sum, n) => sum + n, 0)
  const orderFr = exact
    .map((n, idx) => ({ idx, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac)
  for (const x of orderFr) {
    if (remain <= 0) break
    floors[x.idx] += 1
    remain -= 1
  }

  inbound.values = [...floors, inboundTotal]
  return rows
}

/** 接口原始数据 → 与订单列表相同的缓存形态（含按颜色分块） */
export function normalizeSizeBreakdown(data: OrderSizeBreakdownRes): OrderSizeBreakdownRes {
  const headers = Array.isArray(data.headers) ? data.headers : []
  const rows = normalizeBlockRows(headers, data.rows ?? [])
  const byColor =
    Array.isArray(data.byColor) && data.byColor.length
      ? data.byColor.map((bc) => ({
          colorName: bc.colorName,
          rows: normalizeBlockRows(headers, bc.rows ?? []),
        }))
      : rows.length
        ? [{ colorName: '-', rows }]
        : []
  return { headers, rows, byColor }
}

/** 悬停弹窗按颜色分块（无分块数据时退回单行聚合） */
export function orderSizePopoverBlocks(data: OrderSizeBreakdownRes | undefined): OrderSizeBreakdownColorBlock[] {
  if (!data) return []
  if (data.byColor?.length) return data.byColor
  if (data.rows?.length) return [{ colorName: '-', rows: data.rows }]
  return []
}

/** 与订单列表一致的弹窗宽度 */
export function orderSizePopoverWidth(data: OrderSizeBreakdownRes | undefined): number {
  const cols = data?.headers?.length || 1
  return Math.max(320, cols * 72)
}

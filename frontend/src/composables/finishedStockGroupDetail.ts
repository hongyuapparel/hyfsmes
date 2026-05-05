import {
  normalizeColorName,
  remapValuesByHeaders,
  snapshotRowTotal,
  type NormalizedStoredBreakdownSnapshot,
  type StockTableLeafRow,
  type StockTableRow,
} from '@/utils/finishedStockTableUtils'

export function buildFinishedGroupColorSizeSnapshot(
  row: StockTableRow,
  getGroupLeafRows: (row: StockTableRow) => StockTableLeafRow[],
  getGroupSizeHeaders: (row: StockTableRow) => string[],
): NormalizedStoredBreakdownSnapshot | null {
  const headers = getGroupSizeHeaders(row)
  if (!headers.length) return null
  const rowOrder: string[] = []
  const rowMap = new Map<string, number[]>()
  getGroupLeafRows(row).forEach((leaf) => {
    const breakdown = leaf.sizeBreakdown
    if (!breakdown?.headers?.length || !breakdown.rows?.length) return
    breakdown.rows.forEach((item) => {
      const colorName = normalizeColorName(item.colorName)
      const values = remapValuesByHeaders(breakdown.headers, item.values ?? [], headers)
      if (snapshotRowTotal(values) <= 0) return
      let target = rowMap.get(colorName)
      if (!target) {
        target = Array(headers.length).fill(0)
        rowMap.set(colorName, target)
        rowOrder.push(colorName)
      }
      values.forEach((value, index) => {
        target![index] += value
      })
    })
  })
  const rows = rowOrder.map((colorName) => ({ colorName, values: [...(rowMap.get(colorName) ?? [])] }))
  return rows.length ? { headers, rows } : null
}

export function buildFinishedGroupColorImages(
  row: StockTableRow,
  getGroupLeafRows: (row: StockTableRow) => StockTableLeafRow[],
): Array<{ colorName: string; imageUrl: string }> {
  const map = new Map<string, string>()
  getGroupLeafRows(row).forEach((leaf) => {
    const items = Array.isArray(leaf.colorImages) ? leaf.colorImages : []
    items.forEach((entry) => {
      const colorName = normalizeColorName(entry?.colorName)
      const imageUrl = String(entry?.imageUrl ?? '').trim()
      if (!colorName || !imageUrl) return
      if (!map.has(colorName)) map.set(colorName, imageUrl)
    })
  })
  return Array.from(map.entries()).map(([colorName, imageUrl]) => ({ colorName, imageUrl }))
}

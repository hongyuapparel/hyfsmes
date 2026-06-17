import {
  normalizeColorName,
  remapValuesByHeaders,
  snapshotRowTotal,
  type NormalizedStoredBreakdownSnapshot,
  type StockTableLeafRow,
  type StockTableRow,
} from '@/utils/finishedStockTableUtils'

function getLeafImageUrl(leaf: StockTableLeafRow, colorName: string): string {
  const targetColor = normalizeColorName(colorName)
  const colorImage = Array.isArray(leaf.colorImages)
    ? leaf.colorImages.find((item) => normalizeColorName(item.colorName) === targetColor)
    : null
  return (
    String(colorImage?.imageUrl ?? '').trim() ||
    String(leaf._effectiveImageUrl ?? '').trim() ||
    String(leaf.imageUrl ?? '').trim() ||
    String(leaf.productImageUrl ?? '').trim()
  )
}

export function buildFinishedGroupColorSizeSnapshot(
  row: StockTableRow,
  getGroupLeafRows: (row: StockTableRow) => StockTableLeafRow[],
  getGroupSizeHeaders: (row: StockTableRow) => string[],
): NormalizedStoredBreakdownSnapshot | null {
  const headers = getGroupSizeHeaders(row)
  if (!headers.length) return null
  const rows: NormalizedStoredBreakdownSnapshot['rows'] = []
  getGroupLeafRows(row).forEach((leaf) => {
    const breakdown = leaf.sizeBreakdown
    if (!breakdown?.headers?.length || !breakdown.rows?.length) return
    breakdown.rows.forEach((item) => {
      const colorName = normalizeColorName(item.colorName)
      const values = remapValuesByHeaders(breakdown.headers, item.values ?? [], headers)
      if (snapshotRowTotal(values) <= 0) return
      rows.push({
        colorName,
        values,
        imageUrl: getLeafImageUrl(leaf, colorName),
        stockId: leaf.id,
        unitPrice: leaf.unitPrice != null ? String(leaf.unitPrice) : '',
        department: String(leaf.department ?? ''),
        inventoryTypeId: leaf.inventoryTypeId ?? null,
        warehouseId: leaf.warehouseId ?? null,
        location: String(leaf.location ?? ''),
      })
    })
  })
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
    const colorName = normalizeColorName(leaf._selectedColorName || leaf._displayColor)
    const imageUrl = getLeafImageUrl(leaf, colorName)
    if (colorName && imageUrl && !map.has(colorName)) map.set(colorName, imageUrl)
  })
  return Array.from(map.entries()).map(([colorName, imageUrl]) => ({ colorName, imageUrl }))
}

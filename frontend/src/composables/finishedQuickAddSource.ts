import {
  DEFAULT_CREATE_SIZE_HEADERS,
  type FinishedCreateQuickAddSizeRow,
  type FinishedCreateQuickAddSource,
} from '@/composables/finishedCreateFormHelpers'
import {
  mergeSizeHeaders,
  normalizeColorName,
  remapValuesByHeaders,
  type StockTableLeafRow,
} from '@/utils/finishedStockTableUtils'

type SharedImageResolver = (row: StockTableLeafRow) => string
type GroupHeaderResolver = (row: StockTableLeafRow) => string[]

function getRowImageUrl(row: StockTableLeafRow, colorName: string, resolveSharedImage: SharedImageResolver): string {
  const targetColor = normalizeColorName(colorName)
  const colorImage = row.colorImages?.find((item) => normalizeColorName(item.colorName) === targetColor)
  return (
    String(colorImage?.imageUrl ?? '').trim() ||
    String(row._effectiveImageUrl ?? '').trim() ||
    String(row.imageUrl ?? '').trim() ||
    resolveSharedImage(row) ||
    String(row.productImageUrl ?? '').trim()
  )
}

function getSourceRows(row: StockTableLeafRow): Array<{ colorName: string; values?: number[] }> {
  const rows = Array.isArray(row.sizeBreakdown?.rows) ? row.sizeBreakdown.rows : []
  if (rows.length) return rows.map((item) => ({ colorName: item.colorName, values: item.values }))
  return [{ colorName: normalizeColorName(row._selectedColorName || row._displayColor) || '默认', values: [] }]
}

export function buildFinishedQuickAddSourceFromRows(
  rows: StockTableLeafRow[],
  resolveSharedImage: SharedImageResolver,
  resolveGroupHeaders: GroupHeaderResolver,
): FinishedCreateQuickAddSource | null {
  const storedRows = rows.filter((row) => row.type === 'stored')
  const first = storedRows[0]
  if (!first) return null

  const targetSku = String(first.skuCode ?? '').trim().toLowerCase()
  const sameSkuRows = storedRows.filter((row) => String(row.skuCode ?? '').trim().toLowerCase() === targetSku)
  const headers = mergeSizeHeaders(
    resolveGroupHeaders(first),
    ...sameSkuRows.map((row) => row.sizeBreakdown?.headers ?? []),
  )
  const targetHeaders = headers.length ? headers : [...DEFAULT_CREATE_SIZE_HEADERS]
  const colorImages = new Map<string, string>()
  const matrixRows: FinishedCreateQuickAddSizeRow[] = []

  sameSkuRows.forEach((row) => {
    const sourceHeaders = row.sizeBreakdown?.headers ?? []
    getSourceRows(row).forEach((item) => {
      const colorName = normalizeColorName(item.colorName) || '默认'
      const imageUrl = getRowImageUrl(row, colorName, resolveSharedImage)
      if (imageUrl && !colorImages.has(colorName)) colorImages.set(colorName, imageUrl)
      matrixRows.push({
        colorName,
        values: remapValuesByHeaders(sourceHeaders, item.values ?? [], targetHeaders),
        imageUrl,
        department: String(row.department ?? ''),
        inventoryTypeId: row.inventoryTypeId ?? null,
        warehouseId: row.warehouseId ?? null,
        location: String(row.location ?? ''),
      })
    })
  })

  return {
    ...first,
    imageUrl: resolveSharedImage(first) || first.imageUrl || first.productImageUrl || '',
    productImageUrl: resolveSharedImage(first) || first.productImageUrl || first.imageUrl || '',
    sizeBreakdown: { headers: targetHeaders, rows: matrixRows },
    colorImages: Array.from(colorImages.entries()).map(([colorName, imageUrl]) => ({ colorName, imageUrl })),
  }
}

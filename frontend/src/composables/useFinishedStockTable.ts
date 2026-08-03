import { computed, type Ref } from 'vue'
import type { FinishedStockRow } from '@/api/inventory'
import { getSizeHeaderKey } from '@/utils/sizeHeaders'
import {
  normalizeColorName,
  mergeSizeHeaders,
  isStockTableParentRow,
  isStockTableLeafRow,
  normalizeStoredBreakdownSnapshot,
  buildStoredSnapshotDisplayData,
  sumDetailRowQty,
  type StockTableRow,
  type StockTableLeafRow,
  type StockTableParentRow,
} from '@/utils/finishedStockTableUtils'

type PreviewDataset = {
  headers: string[]
  rows: Array<{ colorName: string; values: number[] }>
}

function getRowColorImageUrl(row: FinishedStockRow, colorName: string): string {
  const target = normalizeColorName(colorName)
  if (!target) return ''
  const match = row.colorImages?.find((item) => normalizeColorName(item.colorName) === target)
  return match?.imageUrl || ''
}

function getProductImageUrl(row: FinishedStockRow | StockTableRow | null | undefined): string {
  if (!row) return ''
  return String(row.imageUrl ?? '').trim() || String(row.productImageUrl ?? '').trim()
}

function getPreviewBaseHeaders(headers: string[]): string[] {
  return headers[headers.length - 1] === '合计' ? headers.slice(0, -1) : [...headers]
}

function getSplitColorBreakdown(row: FinishedStockRow): {
  headers: string[]
  rows: Array<{ colorName: string; values: number[] }>
} | null {
  if (row.type !== 'stored') return null
  const snapshot = normalizeStoredBreakdownSnapshot(row.sizeBreakdown)
  if (snapshot?.headers.length && snapshot.rows.length) {
    return {
      headers: [...snapshot.headers],
      rows: snapshot.rows.map((item) => ({
        colorName: normalizeColorName(item.colorName),
        values: [...item.values],
      })),
    }
  }
  return null
}

function buildLeafRowsForStock(row: FinishedStockRow): StockTableLeafRow[] {
  const groupKey = `${row.type}::${String(row.skuCode ?? '').trim().toLowerCase()}`
  const breakdown = getSplitColorBreakdown(row)
  if (breakdown && breakdown.rows.length > 1) {
    return breakdown.rows.map((item, index) => {
      const colorName = normalizeColorName(item.colorName)
      const quantity = sumDetailRowQty(item.values)
      return {
        ...row,
        quantity,
        sizeBreakdown: {
          headers: [...breakdown.headers],
          rows: [{ colorName, values: [...item.values] }],
        },
        _uiKey: `${groupKey}::${row.id}::${colorName || index}`,
        _rowKind: 'leaf',
        _groupKey: groupKey,
        _displayColor: colorName || '-',
        _effectiveImageUrl: getRowColorImageUrl(row, colorName) || getProductImageUrl(row),
        _selectedColorName: colorName,
      } as StockTableLeafRow
    })
  }
  const colorName = normalizeColorName(breakdown?.rows?.[0]?.colorName)
  return [
    {
      ...row,
      sizeBreakdown: breakdown
        ? {
            headers: [...breakdown.headers],
            rows: breakdown.rows.map((item) => ({
              colorName: normalizeColorName(item.colorName),
              values: [...item.values],
            })),
          }
        : row.sizeBreakdown,
      _uiKey: `${groupKey}::${row.id}`,
      _rowKind: 'leaf',
      _groupKey: groupKey,
      _displayColor: colorName || '-',
      _effectiveImageUrl: getRowColorImageUrl(row, colorName) || getProductImageUrl(row),
      _selectedColorName: colorName,
    } as StockTableLeafRow,
  ]
}

function buildParentRow(groupKey: string, rows: StockTableLeafRow[]): StockTableParentRow {
  const first = rows[0]
  const uniqueStrings = (values: unknown[]) => Array.from(new Set(values.map((item) => String(item ?? '').trim())))
  const uniqueNullableNumbers = (values: unknown[]) =>
    Array.from(
      new Set(
        values.map((item) => {
          const n = Number(item)
          return Number.isInteger(n) && n > 0 ? n : null
        }),
      ),
    )
  const colorLabels = Array.from(
    new Set(rows.map((item) => item._displayColor).filter((item) => item && item !== '-')),
  )
  const stockImages = Array.from(
    new Set(rows.map((item) => String(item.imageUrl ?? '').trim()).filter(Boolean)),
  )
  const productImages = Array.from(
    new Set(rows.map((item) => String(item.productImageUrl ?? '').trim()).filter(Boolean)),
  )
  const effectiveImages = Array.from(
    new Set(rows.map((item) => item._effectiveImageUrl || getProductImageUrl(item)).filter(Boolean)),
  )
  const unitPrices = Array.from(new Set(rows.map((item) => String(item.unitPrice ?? '0'))))
  const inventoryTypeIds = uniqueNullableNumbers(rows.map((item) => item.inventoryTypeId))
  const warehouseIds = uniqueNullableNumbers(rows.map((item) => item.warehouseId))
  const departments = uniqueStrings(rows.map((item) => item.department))
  const customerNames = uniqueStrings(rows.map((item) => item.customerName))
  const locations = uniqueStrings(rows.map((item) => item.location))
  const orderNos = uniqueStrings(rows.map((item) => item.orderNo))
  return {
    ...first,
    quantity: rows.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    unitPrice: unitPrices.length === 1 ? unitPrices[0] : '',
    inventoryTypeId: inventoryTypeIds.length === 1 ? inventoryTypeIds[0] : null,
    warehouseId: warehouseIds.length === 1 ? warehouseIds[0] : null,
    department: departments.length === 1 ? departments[0] : '多个',
    customerName: customerNames.length === 1 ? customerNames[0] : '多个',
    location: locations.length === 1 ? locations[0] : '多个',
    orderNo: orderNos.length === 1 ? orderNos[0] : '多个',
    sizeBreakdown: null,
    _uiKey: `${groupKey}::parent`,
    _rowKind: 'parent',
    _groupKey: groupKey,
    _displayColor: colorLabels.length > 1 ? '多个' : colorLabels[0] || '-',
    _effectiveImageUrl: stockImages[0] || effectiveImages[0] || productImages[0] || '',
    _children: rows,
    _mixedUnitPrice: unitPrices.length > 1,
    _mixedInventoryType: inventoryTypeIds.length > 1,
    _mixedWarehouse: warehouseIds.length > 1,
    _mixedDepartment: departments.length > 1,
    _mixedLocation: locations.length > 1,
    _mixedOrderNo: orderNos.length > 1,
  } as StockTableParentRow
}

function qtyTooltipEnabled(row: StockTableRow): boolean {
  if (isStockTableParentRow(row)) return row._children.some((child) => qtyTooltipEnabled(child))
  return row.type === 'stored'
}

function getLeafPreviewData(row: StockTableLeafRow): PreviewDataset | null {
  const snap = buildStoredSnapshotDisplayData(row.sizeBreakdown, row.quantity, true)
  if (snap?.headers.length && snap.rows.length) {
    return {
      headers: [...snap.headers, '合计'],
      rows: snap.rows.map((item) => {
        const values = item.values.map((value) => Math.max(0, Math.trunc(Number(value) || 0)))
        return {
          colorName: item.colorName,
          values: [...values, values.reduce((sum, value) => sum + value, 0)],
        }
      }),
    }
  }
  return null
}

function filterEmptyPreviewRows(dataset: PreviewDataset | null): PreviewDataset | null {
  if (!dataset || !dataset.headers.length || !dataset.rows.length) return null
  const baseHeaders = getPreviewBaseHeaders(dataset.headers)
  const totalIndex = dataset.headers.length > baseHeaders.length ? dataset.headers.length - 1 : -1
  const rows = dataset.rows.filter((row) =>
    baseHeaders.some((_, index) => (Number(row.values?.[index]) || 0) > 0),
  )
  if (!rows.length) return null
  return {
    headers: [...dataset.headers],
    rows: rows.map((row) => {
      const values = baseHeaders.map((_, index) => Number(row.values?.[index]) || 0)
      const rowTotal = values.reduce((sum, item) => sum + item, 0)
      return {
        colorName: row.colorName,
        values: totalIndex >= 0 ? [...values, rowTotal] : values,
      }
    }),
  }
}

function remapPreviewValues(sourceHeaders: string[], values: number[], targetHeaders: string[]): number[] {
  const sourceBaseHeaders = getPreviewBaseHeaders(sourceHeaders)
  const targetBaseHeaders = getPreviewBaseHeaders(targetHeaders)
  const sourceIndex = new Map(sourceBaseHeaders.map((header, index) => [getSizeHeaderKey(header), index]))
  const remapped = targetBaseHeaders.map((header) => {
    const index = sourceIndex.get(getSizeHeaderKey(header))
    return index != null ? Number(values[index]) || 0 : 0
  })
  return targetHeaders[targetHeaders.length - 1] === '合计'
    ? [...remapped, remapped.reduce((sum, item) => sum + item, 0)]
    : remapped
}

export function useFinishedStockTable(list: Ref<FinishedStockRow[]>) {
  const stockTableData = computed<StockTableRow[]>(() => {
    const leafGroups = new Map<string, StockTableLeafRow[]>()
    list.value.forEach((row) => {
      buildLeafRowsForStock(row).forEach((leaf) => {
        const group = leafGroups.get(leaf._groupKey)
        if (group) group.push(leaf)
        else leafGroups.set(leaf._groupKey, [leaf])
      })
    })
    const result: StockTableRow[] = []
    leafGroups.forEach((rows, groupKey) => {
      if (rows.length <= 1) {
        result.push(...rows)
        return
      }
      result.push(buildParentRow(groupKey, rows))
    })
    return result
  })

  function getGroupLeafRows(row: StockTableRow): StockTableLeafRow[] {
    if (isStockTableParentRow(row)) return row._children
    const parentRow = stockTableData.value.find(
      (item): item is StockTableParentRow =>
        item._groupKey === row._groupKey && isStockTableParentRow(item),
    )
    return parentRow?._children?.length ? parentRow._children : [row as StockTableLeafRow]
  }

  function getGroupSizeHeaders(row: StockTableRow): string[] {
    const headerSources = getGroupLeafRows(row)
      .map((child) => getSplitColorBreakdown(child)?.headers ?? [])
      .filter((headers) => headers.length > 0)
    return mergeSizeHeaders(...headerSources)
  }

  function buildPreviewData(row: StockTableRow): PreviewDataset | null {
    if (!isStockTableParentRow(row)) {
      const preview = getLeafPreviewData(row)
      if (!preview) return null
      const baseHeaders = mergeSizeHeaders(getGroupSizeHeaders(row), getPreviewBaseHeaders(preview.headers))
      const fullHeaders = [...baseHeaders, '合计']
      const rows = preview.rows.map((item) => ({
        colorName: item.colorName,
        values: remapPreviewValues(preview.headers, item.values, fullHeaders),
      }))
      return filterEmptyPreviewRows({ headers: fullHeaders, rows })
    }
    const headerSources: string[][] = []
    const childPreviews = row._children
      .map((child) => getLeafPreviewData(child))
      .filter((preview): preview is PreviewDataset => !!preview)
    childPreviews.forEach((preview) => {
      headerSources.push(getPreviewBaseHeaders(preview.headers))
    })
    const baseHeaders = mergeSizeHeaders(...headerSources)
    if (!baseHeaders.length) return null
    const fullHeaders = [...baseHeaders, '合计']
    const rowOrder: string[] = []
    const rowMap = new Map<string, number[]>()
    childPreviews.forEach((preview) => {
      preview.rows.forEach((item) => {
        const colorName = normalizeColorName(item.colorName)
        const values = remapPreviewValues(preview.headers, item.values, fullHeaders)
        let target = rowMap.get(colorName)
        if (!target) {
          target = Array(fullHeaders.length).fill(0)
          rowMap.set(colorName, target)
          rowOrder.push(colorName)
        }
        values.forEach((value, index) => {
          target![index] += Number(value) || 0
        })
      })
    })
    const rows = rowOrder.map((colorName) => ({
      colorName,
      values: [...(rowMap.get(colorName) ?? [])],
    }))
    return filterEmptyPreviewRows({ headers: fullHeaders, rows })
  }

  function getGroupProductImageUrl(groupKey: string): string {
    const parentRow = stockTableData.value.find(
      (item): item is StockTableParentRow =>
        item._groupKey === groupKey && isStockTableParentRow(item),
    )
    if (parentRow?._effectiveImageUrl) return parentRow._effectiveImageUrl
    const leafRow = stockTableData.value.find(
      (item): item is StockTableLeafRow =>
        item._groupKey === groupKey && isStockTableLeafRow(item),
    )
    return leafRow?._effectiveImageUrl || getProductImageUrl(leafRow)
  }

  function getSharedProductImageUrl(row: StockTableRow): string {
    if (isStockTableParentRow(row)) return row._effectiveImageUrl || getProductImageUrl(row)
    return getGroupProductImageUrl(row._groupKey) || row._effectiveImageUrl || getProductImageUrl(row)
  }

  return {
    stockTableData,
    getGroupLeafRows,
    getGroupSizeHeaders,
    buildPreviewData,
    getGroupProductImageUrl,
    getSharedProductImageUrl,
    getProductImageUrl,
    getSplitColorBreakdown,
    qtyTooltipEnabled,
    getLeafPreviewData,
    filterEmptyPreviewRows,
    getPreviewBaseHeaders,
  }
}

export function getPreviewHeadersFromRow(
  row: StockTableRow,
  buildPreviewData: (r: StockTableRow) => PreviewDataset | null,
): string[] {
  return buildPreviewData(row)?.headers ?? []
}

export function getPreviewRowsFromRow(
  row: StockTableRow,
  buildPreviewData: (r: StockTableRow) => PreviewDataset | null,
) {
  return buildPreviewData(row)?.rows ?? []
}

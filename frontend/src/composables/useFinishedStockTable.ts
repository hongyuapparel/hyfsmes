import { computed, reactive, type Ref } from 'vue'
import type { FinishedStockRow } from '@/api/inventory'
import { getOrderColorSizeBreakdown, type OrderColorSizeBreakdownRes } from '@/api/orders'
import {
  normalizeColorName,
  normalizeBreakdownHeaders,
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

type ColorSizeCacheEntry = {
  loading: boolean
  error: boolean
  headers: string[]
  rows: Array<{ colorName: string; values: number[] }>
}

type PreviewDataset = {
  headers: string[]
  rows: Array<{ colorName: string; values: number[] }>
}

const colorSizeCache = reactive<Record<number, ColorSizeCacheEntry>>({})

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

async function ensureColorSizeBreakdown(orderId: number) {
  if (!orderId) return
  const existing = colorSizeCache[orderId]
  if (existing && (existing.loading || existing.headers.length > 0 || existing.error)) return
  colorSizeCache[orderId] = { loading: true, error: false, headers: [], rows: [] }
  try {
    const res = await getOrderColorSizeBreakdown(orderId)
    const data = (res.data ?? { headers: [], rows: [] }) as OrderColorSizeBreakdownRes
    colorSizeCache[orderId] = {
      loading: false,
      error: false,
      headers: Array.isArray(data.headers) ? data.headers : [],
      rows: Array.isArray(data.rows) ? data.rows : [],
    }
  } catch {
    colorSizeCache[orderId] = { loading: false, error: true, headers: [], rows: [] }
  }
}

async function prefetchStoredRowBreakdowns(rows: FinishedStockRow[]) {
  const orderIds = Array.from(
    new Set(
      rows
        .filter(
          (item) =>
            item.type === 'stored' &&
            item.orderId &&
            !(item.sizeBreakdown?.headers?.length && item.sizeBreakdown.rows?.length),
        )
        .map((item) => item.orderId as number),
    ),
  )
  if (!orderIds.length) return
  await Promise.all(orderIds.map((orderId) => ensureColorSizeBreakdown(orderId)))
}

function allocateByWeight(weights: number[], total: number): number[] {
  const safeTotal = Math.max(0, Math.trunc(Number(total) || 0))
  if (!weights.length) return []
  const sumWeight = weights.reduce((s, w) => s + Math.max(0, Number(w) || 0), 0)
  if (safeTotal <= 0) return weights.map(() => 0)
  if (sumWeight <= 0) {
    const arr = weights.map(() => 0)
    arr[0] = safeTotal
    return arr
  }
  const exact = weights.map((w) => (Math.max(0, Number(w) || 0) * safeTotal) / sumWeight)
  const base = exact.map((v) => Math.floor(v))
  let remain = safeTotal - base.reduce((s, n) => s + n, 0)
  const order = exact
    .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
  let i = 0
  while (remain > 0 && order.length > 0) {
    base[order[i % order.length].idx] += 1
    remain -= 1
    i += 1
  }
  return base
}

function scaleColorSizeRowsToQuantity(
  headers: string[],
  rows: Array<{ colorName?: string; values?: number[] }>,
  targetQty: number,
): Array<{ colorName: string; values: number[] }> {
  if (!headers.length || !rows.length) return []
  const hasTotalCol = headers[headers.length - 1] === '合计'
  const sizeColCount = hasTotalCol ? Math.max(0, headers.length - 1) : headers.length
  if (sizeColCount <= 0) return []
  const weights: number[] = []
  rows.forEach((r) => {
    for (let i = 0; i < sizeColCount; i += 1) {
      weights.push(Math.max(0, Number(r.values?.[i]) || 0))
    }
  })
  const weightSum = weights.reduce((s, n) => s + n, 0)
  const safeTarget = Math.max(0, Math.trunc(Number(targetQty) || 0))
  if (weightSum <= 0) {
    return rows.map((r) => ({
      colorName: String(r.colorName ?? ''),
      values: hasTotalCol ? [...Array(sizeColCount).fill(0), 0] : Array(sizeColCount).fill(0),
    }))
  }
  const allocated = weightSum === safeTarget ? [...weights] : allocateByWeight(weights, safeTarget)
  let cursor = 0
  return rows.map((r) => {
    const sizeValues: number[] = []
    for (let i = 0; i < sizeColCount; i += 1) {
      sizeValues.push(allocated[cursor] ?? 0)
      cursor += 1
    }
    const rowTotal = sizeValues.reduce((s, n) => s + n, 0)
    return {
      colorName: String(r.colorName ?? ''),
      values: hasTotalCol ? [...sizeValues, rowTotal] : sizeValues,
    }
  })
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
  if (!row.orderId) return null
  const cache = colorSizeCache[row.orderId]
  if (!cache || cache.loading || cache.error || !cache.headers.length || !cache.rows.length) return null
  const headers = normalizeBreakdownHeaders(cache.headers)
  if (!headers.length) return null
  const scaled = scaleColorSizeRowsToQuantity(cache.headers, cache.rows, row.quantity)
  return {
    headers,
    rows: scaled.map((item) => ({
      colorName: normalizeColorName(item.colorName),
      values: headers.map((_, index) => Number(item.values?.[index]) || 0),
    })),
  }
}

function buildLeafRowsForStock(row: FinishedStockRow): StockTableLeafRow[] {
  const groupKey = `${row.type}::${String(row.skuCode ?? '').trim().toLowerCase()}::${String(row.customerName ?? '').trim().toLowerCase()}`
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
  const departments = Array.from(
    new Set(rows.map((item) => String(item.department ?? '').trim()).filter(Boolean)),
  )
  const locations = Array.from(
    new Set(rows.map((item) => String(item.location ?? '').trim()).filter(Boolean)),
  )
  const orderNos = Array.from(
    new Set(rows.map((item) => String(item.orderNo ?? '').trim()).filter(Boolean)),
  )
  return {
    ...first,
    quantity: rows.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    unitPrice: unitPrices.length === 1 ? unitPrices[0] : '',
    department: departments.length === 1 ? departments[0] : '',
    location: locations.length === 1 ? locations[0] : '',
    orderNo: orderNos.length === 1 ? orderNos[0] : '',
    sizeBreakdown: null,
    _uiKey: `${groupKey}::parent`,
    _rowKind: 'parent',
    _groupKey: groupKey,
    _displayColor: colorLabels.length > 1 ? '多个' : colorLabels[0] || '-',
    _effectiveImageUrl: stockImages[0] || effectiveImages[0] || productImages[0] || '',
    _children: rows,
    _mixedUnitPrice: unitPrices.length > 1,
    _mixedDepartment: departments.length > 1,
    _mixedLocation: locations.length > 1,
    _mixedOrderNo: orderNos.length > 1,
  } as StockTableParentRow
}

function isQtyTooltipLoading(row: StockTableRow): boolean {
  if (isStockTableParentRow(row)) return row._children.some((child) => isQtyTooltipLoading(child))
  return !!(row.orderId && !row.sizeBreakdown?.headers?.length && colorSizeCache[row.orderId]?.loading)
}

function isQtyTooltipError(row: StockTableRow): boolean {
  if (isStockTableParentRow(row)) return row._children.some((child) => isQtyTooltipError(child))
  return !!(row.orderId && !row.sizeBreakdown?.headers?.length && colorSizeCache[row.orderId]?.error)
}

function qtyTooltipEnabled(row: StockTableRow): boolean {
  if (isStockTableParentRow(row)) return row._children.some((child) => qtyTooltipEnabled(child))
  if (row.sizeBreakdown?.headers?.length && row.sizeBreakdown.rows?.length) return true
  return !!row.orderId
}

function onQtyTooltipShow(row: StockTableRow) {
  if (isStockTableParentRow(row)) {
    const orderIds = Array.from(
      new Set(
        row._children
          .filter((child) => !child.sizeBreakdown?.headers?.length && child.orderId)
          .map((child) => Number(child.orderId)),
      ),
    )
    orderIds.forEach((orderId) => {
      void ensureColorSizeBreakdown(orderId)
    })
    return
  }
  if (row.sizeBreakdown?.headers?.length && row.sizeBreakdown.rows?.length) return
  if (row.orderId) void ensureColorSizeBreakdown(row.orderId)
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
  if (!row.orderId) return null
  const cache = colorSizeCache[row.orderId]
  if (!cache || cache.loading || cache.error || !cache.headers.length || !cache.rows.length) return null
  return {
    headers: [...cache.headers],
    rows: scaleColorSizeRowsToQuantity(
      cache.headers,
      cache.rows,
      Math.max(0, Math.trunc(Number(row.quantity) || 0)),
    ),
  }
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
  const remapped = targetBaseHeaders.map((header) => {
    const sourceIndex = sourceBaseHeaders.indexOf(header)
    return sourceIndex >= 0 ? Number(values[sourceIndex]) || 0 : 0
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
    const baseHeaders: string[] = []
    const childPreviews = row._children
      .map((child) => getLeafPreviewData(child))
      .filter((preview): preview is PreviewDataset => !!preview)
    childPreviews.forEach((preview) => {
      getPreviewBaseHeaders(preview.headers).forEach((header) => {
        if (!baseHeaders.includes(header)) baseHeaders.push(header)
      })
    })
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
    colorSizeCache,
    stockTableData,
    getGroupLeafRows,
    getGroupSizeHeaders,
    buildPreviewData,
    getGroupProductImageUrl,
    getSharedProductImageUrl,
    getProductImageUrl,
    getSplitColorBreakdown,
    ensureColorSizeBreakdown,
    prefetchStoredRowBreakdowns,
    scaleColorSizeRowsToQuantity,
    isQtyTooltipLoading,
    isQtyTooltipError,
    qtyTooltipEnabled,
    onQtyTooltipShow,
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

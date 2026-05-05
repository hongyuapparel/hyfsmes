import type { FinishedStockRow } from '@/api/inventory'
import { getSizeHeaderKey, normalizeSizeHeader, sortSizeHeaders } from '@/utils/sizeHeaders'

export type StockTableLeafRow = FinishedStockRow & {
  _uiKey: string
  _rowKind: 'leaf'
  _groupKey: string
  _displayColor: string
  _effectiveImageUrl: string
  _selectedColorName?: string
}

export type StockTableParentRow = FinishedStockRow & {
  _uiKey: string
  _rowKind: 'parent'
  _groupKey: string
  _displayColor: string
  _effectiveImageUrl: string
  _children: StockTableLeafRow[]
  _mixedUnitPrice: boolean
  _mixedInventoryType: boolean
  _mixedWarehouse: boolean
  _mixedDepartment: boolean
  _mixedLocation: boolean
  _mixedOrderNo: boolean
}

export type StockTableRow = StockTableLeafRow | StockTableParentRow

export type NormalizedStoredBreakdownSnapshot = {
  headers: string[]
  rows: Array<{ colorName: string; values: number[] }>
}

export function normalizeColorName(value: unknown): string {
  return String(value ?? '').trim()
}

export function isStockTableParentRow(row: StockTableRow | FinishedStockRow | null | undefined): row is StockTableParentRow {
  return !!row && (row as StockTableParentRow)._rowKind === 'parent'
}

export function isStockTableLeafRow(row: StockTableRow | FinishedStockRow | null | undefined): row is StockTableLeafRow {
  return !!row && (row as StockTableLeafRow)._rowKind === 'leaf'
}

export function normalizeBreakdownHeaders(headers: string[]): string[] {
  if (!headers.length) return []
  return headers.map(normalizeSizeHeader).filter(Boolean)
}

export const INTERNAL_UNASSIGNED_SIZE_HEADER = '__UNASSIGNED__'
export const INTERNAL_UNASSIGNED_COLOR_NAME = '__UNASSIGNED__'

export function isInternalUnassignedSizeHeader(value: unknown): boolean {
  return String(value ?? '').trim() === INTERNAL_UNASSIGNED_SIZE_HEADER
}

export function isInternalUnassignedColorName(value: unknown): boolean {
  return String(value ?? '').trim() === INTERNAL_UNASSIGNED_COLOR_NAME
}

export function mergeSizeHeaders(...sources: Array<string[] | null | undefined>): string[] {
  const result: string[] = []
  sources.forEach((source) => {
    normalizeBreakdownHeaders(Array.isArray(source) ? source : []).forEach((header) => {
      const normalized = normalizeSizeHeader(header)
      if (!normalized || isInternalUnassignedSizeHeader(normalized)) return
      if (!result.some((item) => getSizeHeaderKey(item) === getSizeHeaderKey(normalized))) result.push(normalized)
    })
  })
  return sortSizeHeaders(result)
}

export function remapValuesByHeaders(sourceHeaders: string[], values: unknown[], targetHeaders: string[]): number[] {
  const sourceBaseHeaders = normalizeBreakdownHeaders(sourceHeaders)
  const sourceIndex = new Map(sourceBaseHeaders.map((header, index) => [getSizeHeaderKey(header), index]))
  return targetHeaders.map((header) => {
    const index = sourceIndex.get(getSizeHeaderKey(header))
    return index == null ? 0 : Math.max(0, Math.trunc(Number(values?.[index]) || 0))
  })
}

export function sameSnapshotValues(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

export function snapshotRowTotal(values: unknown[]): number {
  return values.reduce<number>((sum, value) => sum + Math.max(0, Math.trunc(Number(value) || 0)), 0)
}

export function normalizeStoredBreakdownSnapshot(
  snapshot: NonNullable<FinishedStockRow['sizeBreakdown']> | null | undefined,
): NormalizedStoredBreakdownSnapshot | null {
  if (!snapshot?.headers?.length || !snapshot.rows?.length) return null
  const normalizedHeaders = normalizeBreakdownHeaders(snapshot.headers)
  const visibleHeaderIndexes = normalizedHeaders
    .map((header, index) => ({ header: String(header ?? '').trim(), index }))
    .filter((item) => item.header && !isInternalUnassignedSizeHeader(item.header))
  const sourceHeaders = visibleHeaderIndexes.map((item) => item.header)
  const headers = sortSizeHeaders(sourceHeaders)
  const rowOrder: string[] = []
  const rowMap = new Map<string, number[]>()
  const blankRows: number[][] = []
  const addRow = (colorName: string, values: number[]) => {
    let existing = rowMap.get(colorName)
    if (!existing) {
      existing = Array(headers.length).fill(0)
      rowMap.set(colorName, existing)
      rowOrder.push(colorName)
    }
    values.forEach((value, index) => {
      existing![index] += value
    })
  }
  snapshot.rows.forEach((item) => {
    const sourceValues = Array.isArray(item.values) ? item.values : []
    if (isInternalUnassignedColorName(item.colorName)) {
      blankRows.push(remapValuesByHeaders(sourceHeaders, sourceValues, headers))
      return
    }
    const values = remapValuesByHeaders(sourceHeaders, sourceValues, headers)
    if (snapshotRowTotal(values) <= 0) return
    const colorName = normalizeColorName(item.colorName)
    if (!colorName) blankRows.push(values)
    else addRow(colorName, values)
  })
  blankRows.forEach((values) => {
    if (snapshotRowTotal(values) <= 0) return
    const exactMatches = rowOrder.filter((colorName) => sameSnapshotValues(rowMap.get(colorName) ?? [], values))
    if (exactMatches.length === 1) addRow(exactMatches[0], values)
    else if (rowOrder.length === 1) addRow(rowOrder[0], values)
    else addRow('', values)
  })
  const rows = rowOrder
    .map((colorName) => ({ colorName, values: [...(rowMap.get(colorName) ?? [])] }))
    .filter((row) => snapshotRowTotal(row.values) > 0)
  if (!headers.length || !rows.length) return null
  return { headers, rows }
}

export function buildStoredSnapshotDisplayData(
  snapshot: NonNullable<FinishedStockRow['sizeBreakdown']> | null | undefined,
  _stockQty: number,
  _mergeIntoSingleRow = false,
): {
  headers: string[]
  rows: Array<{ colorName: string; values: number[] }>
} | null {
  const normalized = normalizeStoredBreakdownSnapshot(snapshot)
  if (!normalized) return null
  return {
    headers: [...normalized.headers],
    rows: normalized.rows.map((row) => ({
      colorName: row.colorName,
      values: [...row.values],
    })),
  }
}

export function sumDetailRowQty(quantities: unknown[]): number {
  if (!Array.isArray(quantities)) return 0
  return quantities.reduce<number>((sum, q) => sum + (Number(q) || 0), 0)
}

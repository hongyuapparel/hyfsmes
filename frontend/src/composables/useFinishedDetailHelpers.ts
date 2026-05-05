import { formatDisplayNumber } from '@/utils/display-number'
import { getSizeHeaderKey, normalizeSizeHeader, sortSizeHeaders } from '@/utils/sizeHeaders'

type SnapshotRow = { colorName: string; values: number[] }
type AdjustSnapshotRow = { colorName: string; values: number[] }

export type AdjustLogSummaryInput = {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  remark?: string
  summaries?: string[]
}

export type AdjustSummaryBuilderOptions = {
  findInventoryTypeLabel: (id: number | null | undefined) => string
  findWarehouseLabel: (id: number | null | undefined) => string
}

export function normalizeColorName(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeBreakdownHeaders(headers: string[]): string[] {
  if (!headers.length) return []
  return headers.map(normalizeSizeHeader).filter(Boolean)
}

export function mergeSizeHeaders(...sources: Array<string[] | null | undefined>): string[] {
  const result: string[] = []
  sources.forEach((source) => {
    normalizeBreakdownHeaders(Array.isArray(source) ? source : []).forEach((header) => {
      const normalizedHeader = normalizeSizeHeader(header)
      if (normalizedHeader && normalizedHeader !== '__UNASSIGNED__' && !result.includes(normalizedHeader)) {
        result.push(normalizedHeader)
      }
    })
  })
  return sortSizeHeaders(result)
}

export function remapValuesByHeaders(
  sourceHeaders: string[],
  values: unknown[],
  targetHeaders: string[],
): number[] {
  const baseHeaders = normalizeBreakdownHeaders(sourceHeaders)
  const indexMap = new Map(baseHeaders.map((header, index) => [getSizeHeaderKey(header), index]))
  return targetHeaders.map((header) => {
    const index = indexMap.get(getSizeHeaderKey(header))
    return index == null ? 0 : Math.max(0, Math.trunc(Number(values?.[index]) || 0))
  })
}

export function snapshotRowTotal(values: unknown[]): number {
  return (Array.isArray(values) ? values : []).reduce<number>((sum, value) => {
    return sum + Math.max(0, Math.trunc(Number(value) || 0))
  }, 0)
}

export function sumRowQty(quantities: unknown[]): number {
  return snapshotRowTotal(Array.isArray(quantities) ? quantities : [])
}

export function allocateByWeight(weights: number[], total: number): number[] {
  const safeTotal = Math.max(0, Math.trunc(Number(total) || 0))
  if (!weights.length) return []
  const safeWeightSum = weights.reduce((sum, weight) => sum + Math.max(0, Number(weight) || 0), 0)
  if (safeTotal <= 0) return weights.map(() => 0)
  if (safeWeightSum <= 0) {
    const allocated = weights.map(() => 0)
    allocated[0] = safeTotal
    return allocated
  }

  const exactAllocation = weights.map(
    (weight) => (Math.max(0, Number(weight) || 0) * safeTotal) / safeWeightSum,
  )
  const floorAllocation = exactAllocation.map((value) => Math.floor(value))
  let remaining = safeTotal - floorAllocation.reduce((sum, value) => sum + value, 0)
  const fractionOrder = exactAllocation
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction)

  let orderIndex = 0
  while (remaining > 0 && fractionOrder.length > 0) {
    floorAllocation[fractionOrder[orderIndex % fractionOrder.length].index] += 1
    remaining -= 1
    orderIndex += 1
  }
  return floorAllocation
}

export function normalizeStoredSnapshot(
  snapshot: unknown,
): { headers: string[]; rows: SnapshotRow[] } | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const source = snapshot as { headers?: unknown[]; rows?: Array<{ colorName?: unknown; values?: unknown[] }> }
  if (!Array.isArray(source.headers) || !Array.isArray(source.rows)) return null
  if (!source.headers.length || !source.rows.length) return null

  const normalizedHeaders = normalizeBreakdownHeaders(source.headers.map((header) => String(header ?? '')))
  const visibleIndexes = normalizedHeaders
    .map((header, index) => ({ header: String(header ?? '').trim(), index }))
    .filter((item) => item.header && item.header !== '__UNASSIGNED__')
  const sourceHeaders = visibleIndexes.map((item) => item.header)
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

  source.rows.forEach((row) => {
    const sourceValues = Array.isArray(row.values) ? row.values : []
    const values = remapValuesByHeaders(sourceHeaders, sourceValues, headers)
    if (String(row.colorName ?? '').trim() === '__UNASSIGNED__') {
      blankRows.push(values)
      return
    }
    const colorName = normalizeColorName(row.colorName)
    if (!colorName) {
      blankRows.push(values)
    } else {
      addRow(colorName, values)
    }
  })

  blankRows.forEach((values) => {
    if (snapshotRowTotal(values) <= 0) return
    const matchedNames = rowOrder.filter((colorName) => {
      const existing = rowMap.get(colorName) ?? []
      return existing.length === values.length && existing.every((value, index) => value === values[index])
    })
    if (matchedNames.length === 1) addRow(matchedNames[0], values)
    else if (rowOrder.length === 1) addRow(rowOrder[0], values)
    else addRow('', values)
  })

  const rows = rowOrder
    .map((colorName) => ({ colorName, values: [...(rowMap.get(colorName) ?? [])] }))
    .filter((row) => snapshotRowTotal(row.values) > 0)
  return headers.length && rows.length ? { headers, rows } : null
}

export function formatPrice(unitPrice: string | undefined): string {
  if (unitPrice == null || unitPrice === '') return '￥0'
  const value = Number(unitPrice)
  return Number.isFinite(value) ? `￥${formatDisplayNumber(value)}` : '￥0'
}

export function formatTotalPrice(quantity: number, unitPrice: string | undefined): string {
  const value = Number(unitPrice)
  return Number.isFinite(value) && Number.isFinite(quantity)
    ? `￥${formatDisplayNumber(quantity * value)}`
    : '￥0'
}

function normalizeAdjustSnapshot(snapshot: unknown): { headers: string[]; rows: AdjustSnapshotRow[] } | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const source = snapshot as { headers?: unknown[]; rows?: Array<{ colorName?: unknown; quantities?: unknown[]; values?: unknown[] }> }
  const headers = (Array.isArray(source.headers) ? source.headers : [])
    .map(normalizeSizeHeader)
    .filter(Boolean)
  const sortedHeaders = sortSizeHeaders(headers)
  const rowsRaw = Array.isArray(source.rows) ? source.rows : []
  if (!headers.length || !rowsRaw.length) return null

  const rows = rowsRaw
    .map((row) => {
      const sourceValues = Array.isArray(row?.quantities)
        ? row.quantities
        : Array.isArray(row?.values)
          ? row.values
          : []
      return {
        colorName: String(row?.colorName ?? '').trim(),
        values: remapValuesByHeaders(headers, sourceValues, sortedHeaders),
      }
    })
    .filter((row) => row.values.some((value) => value > 0))
  return rows.length ? { headers: sortedHeaders, rows } : null
}

function remapAdjustValues(
  snapshot: { headers: string[]; rows: AdjustSnapshotRow[] } | null,
  colorName: string,
  headers: string[],
): number[] {
  if (!snapshot) return headers.map(() => 0)
  const row = snapshot.rows.find((item) => item.colorName === colorName)
  const indexMap = new Map(snapshot.headers.map((header, index) => [getSizeHeaderKey(header), index]))
  return headers.map((header) => {
    const index = indexMap.get(getSizeHeaderKey(header))
    return index == null ? 0 : Math.max(0, Math.trunc(Number(row?.values?.[index]) || 0))
  })
}

function getAdjustActionLabel(
  remark: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string {
  if (remark.includes('合并入库')) return '合并入库'
  const beforeQuantity = Number(before?.quantity)
  const afterQuantity = Number(after?.quantity)
  if (Number.isFinite(beforeQuantity) && Number.isFinite(afterQuantity)) {
    if (afterQuantity > beforeQuantity) return '入库调整'
    if (afterQuantity < beforeQuantity) return '库存扣减'
  }
  return '尺码明细调整'
}

export function createAdjustLogSummaryBuilder(options: AdjustSummaryBuilderOptions) {
  return (log: AdjustLogSummaryInput): string => {
    if (Array.isArray(log?.summaries) && log.summaries.length) {
      return log.summaries.join('；')
    }

    const before = (log?.before ?? {}) as Record<string, unknown>
    const after = (log?.after ?? {}) as Record<string, unknown>
    const remark = String(log?.remark ?? '').trim()
    const summaries: string[] = []
    const beforeSnapshot = normalizeAdjustSnapshot(before?.colorSizeSnapshot)
    const afterSnapshot = normalizeAdjustSnapshot(after?.colorSizeSnapshot)

    if (beforeSnapshot || afterSnapshot) {
      const headers = mergeSizeHeaders(beforeSnapshot?.headers, afterSnapshot?.headers)
      const colorNames = [
        ...(beforeSnapshot?.rows.map((row) => row.colorName) ?? []),
        ...(afterSnapshot?.rows.map((row) => row.colorName) ?? []),
      ].filter((colorName, index, array) => array.indexOf(colorName) === index)

      const sizeSummaries = colorNames
        .map((colorName) => {
          const beforeValues = remapAdjustValues(beforeSnapshot, colorName, headers)
          const afterValues = remapAdjustValues(afterSnapshot, colorName, headers)
          const deltas = headers
            .map((header, index) => ({ header, delta: afterValues[index] - beforeValues[index] }))
            .filter((item) => item.delta !== 0)
            .map(
              (item) =>
                `${item.header} ${item.delta > 0 ? '+' : ''}${formatDisplayNumber(item.delta)}件`,
            )
          if (!deltas.length) return ''
          const label = colorName && colorName !== '__UNASSIGNED__' ? `${colorName}：` : ''
          return `${label}${deltas.join('、')}`
        })
        .filter(Boolean)

      if (sizeSummaries.length) {
        const actionLabel = getAdjustActionLabel(remark, before, after)
        summaries.push(`${actionLabel}：${sizeSummaries.join('；')}`)
      } else if (remark) {
        summaries.push(remark)
      }
    } else if (remark) {
      summaries.push(remark)
    }

    const beforeUnitPrice =
      before?.unitPrice != null && before.unitPrice !== '' ? String(before.unitPrice) : ''
    const afterUnitPrice = after?.unitPrice != null && after.unitPrice !== '' ? String(after.unitPrice) : ''
    if (afterUnitPrice && beforeUnitPrice !== afterUnitPrice) {
      summaries.push(`出厂价改为${formatPrice(afterUnitPrice)}`)
    }

    const metaChanged =
      (before?.department ?? '') !== (after?.department ?? '') ||
      (before?.inventoryTypeId ?? null) !== (after?.inventoryTypeId ?? null) ||
      (before?.warehouseId ?? null) !== (after?.warehouseId ?? null) ||
      (before?.location ?? '') !== (after?.location ?? '')
    if (metaChanged) {
      summaries.push(
        `基础信息改为 ${[
          String(after?.department ?? '') || '-',
          options.findInventoryTypeLabel(
            (after?.inventoryTypeId == null ? null : Number(after.inventoryTypeId)) as
              | number
              | null,
          ) || '-',
          options.findWarehouseLabel(
            (after?.warehouseId == null ? null : Number(after.warehouseId)) as number | null,
          ) || '-',
          String(after?.location ?? '') || '-',
        ].join(' / ')}`,
      )
    }

    const beforeQuantity = Number(before?.quantity)
    const afterQuantity = Number(after?.quantity)
    if (
      Number.isFinite(beforeQuantity) &&
      Number.isFinite(afterQuantity) &&
      beforeQuantity !== afterQuantity &&
      !remark &&
      !(beforeSnapshot || afterSnapshot)
    ) {
      const delta = afterQuantity - beforeQuantity
      summaries.push(
        delta > 0
          ? `新增库存 +${formatDisplayNumber(delta)} 件`
          : `库存数量改为${formatDisplayNumber(afterQuantity)}`,
      )
    }
    return summaries.join('，') || '更新库存信息'
  }
}

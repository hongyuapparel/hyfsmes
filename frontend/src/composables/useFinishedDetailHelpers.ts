import { formatDisplayNumber } from '@/utils/display-number'
import { getSizeHeaderKey, normalizeSizeHeader, sortSizeHeaders } from '@/utils/sizeHeaders'

export { normalizeStoredBreakdownSnapshot as normalizeStoredSnapshot } from '@/utils/finishedStockTableUtils'
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

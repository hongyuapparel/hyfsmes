import { computed, type Ref } from 'vue'
import {
  allocateByWeight,
  formatPrice,
  formatTotalPrice,
  mergeSizeHeaders,
  normalizeColorName,
  normalizeStoredSnapshot,
  remapValuesByHeaders,
  snapshotRowTotal,
  sumRowQty,
} from '@/composables/useFinishedDetailHelpers'
import type { NormalizedStoredBreakdownSnapshot } from '@/utils/finishedStockTableUtils'

type DetailLike = {
  stock?: { quantity?: number; unitPrice?: string | number | null }
  colorSize?: { headers?: string[]; rows?: Array<{ colorName?: string; quantities?: number[] }> }
}

export function useFinishedDetailDisplayData(params: {
  data: Ref<DetailLike | null>
  groupSizeHeaders: Ref<string[]>
  groupSnapshot: Ref<NormalizedStoredBreakdownSnapshot | null>
  selectedColorName: Ref<string | null>
  selectedQuantity: Ref<number | null>
  metaEditing: Ref<boolean>
  editUnitPrice: () => string
}) {
  const displayColorSizeData = computed(() => {
    const detail = params.data.value
    const colorSize = detail?.colorSize
    const headers = Array.isArray(colorSize?.headers) ? colorSize.headers : []
    const rows = Array.isArray(colorSize?.rows) ? colorSize.rows : []
    const targetHeaders = mergeSizeHeaders(params.groupSizeHeaders.value, headers)
    const hasSelectedColor = params.selectedColorName.value !== null
    const selectedName = hasSelectedColor ? normalizeColorName(params.selectedColorName.value) : ''
    const groupSnapshot = params.groupSnapshot.value

    if (groupSnapshot?.headers.length && groupSnapshot.rows.length) {
      const visibleRows = hasSelectedColor
        ? groupSnapshot.rows.filter((row) => normalizeColorName(row.colorName) === selectedName)
        : groupSnapshot.rows
      const displayHeaders = mergeSizeHeaders(targetHeaders, groupSnapshot.headers)
      const displayRows = visibleRows
        .map((row) => ({
          colorName: row.colorName,
          quantities: remapValuesByHeaders(groupSnapshot.headers, row.values, displayHeaders),
        }))
        .filter((row) => snapshotRowTotal(row.quantities) > 0)
      return displayRows.length ? { headers: displayHeaders, rows: displayRows } : { headers: [], rows: [] }
    }

    if (!targetHeaders.length || !rows.length) return { headers: [], rows: [] }
    const normalizedSnapshot = normalizeStoredSnapshot({
      headers,
      rows: rows.map((row) => ({ colorName: row.colorName, values: Array.isArray(row.quantities) ? [...row.quantities] : [] })),
    })
    if (normalizedSnapshot) {
      const visibleRows = hasSelectedColor
        ? normalizedSnapshot.rows.filter((row) => normalizeColorName(row.colorName) === selectedName)
        : normalizedSnapshot.rows
      const displayHeaders = mergeSizeHeaders(targetHeaders, normalizedSnapshot.headers)
      const displayRows = visibleRows
        .map((row) => ({ colorName: row.colorName, quantities: remapValuesByHeaders(normalizedSnapshot.headers, row.values, displayHeaders) }))
        .filter((row) => snapshotRowTotal(row.quantities) > 0)
      return displayRows.length ? { headers: displayHeaders, rows: displayRows } : { headers: [], rows: [] }
    }

    const filteredRows = hasSelectedColor ? rows.filter((row) => normalizeColorName(row.colorName) === selectedName) : rows
    if (!filteredRows.length) return { headers: [], rows: [] }
    const stockQuantity = Math.max(0, Math.trunc(Number(params.selectedQuantity.value ?? detail?.stock?.quantity) || 0))
    const orderTotal = filteredRows.reduce((sum, row) => sum + sumRowQty(row.quantities ?? []), 0)
    if (orderTotal === stockQuantity) {
      return {
        headers: [...targetHeaders],
        rows: filteredRows
          .map((row) => ({ colorName: String(row.colorName ?? ''), quantities: remapValuesByHeaders(headers, row.quantities ?? [], targetHeaders) }))
          .filter((row) => snapshotRowTotal(row.quantities) > 0),
      }
    }

    const weights = filteredRows.flatMap((row) => headers.map((_, index) => Math.max(0, Number(row.quantities?.[index]) || 0)))
    const allocated = allocateByWeight(weights, stockQuantity)
    let cursor = 0
    return {
      headers: [...targetHeaders],
      rows: filteredRows
        .map((row) => ({
          colorName: String(row.colorName ?? ''),
          quantities: headers.map(() => allocated[cursor++] ?? 0),
        }))
        .map((row) => ({ colorName: row.colorName, quantities: remapValuesByHeaders(headers, row.quantities, targetHeaders) }))
        .filter((row) => snapshotRowTotal(row.quantities) > 0),
    }
  })

  const displaySizeHeaders = computed(() => displayColorSizeData.value.headers)
  const displayColorSizeRows = computed(() => displayColorSizeData.value.rows)
  const totalQty = computed(() => displayColorSizeRows.value.reduce((sum, row) => sum + sumRowQty(row.quantities), 0))
  const unitPriceValue = computed(() =>
    params.metaEditing.value ? params.editUnitPrice() : String(params.data.value?.stock?.unitPrice ?? ''),
  )
  const tableUnitPrice = computed(() => formatPrice(unitPriceValue.value))
  const tableTotalPrice = computed(() => formatTotalPrice(totalQty.value, unitPriceValue.value))

  function rowTotalPrice(quantities: unknown[]): string {
    return formatTotalPrice(sumRowQty(quantities), unitPriceValue.value)
  }

  function getColorSizeSummary({ columns }: { columns: Array<{ label?: string }> }) {
    const headerLength = displaySizeHeaders.value.length
    return columns.map((_, index) => {
      if (index === 0) return '汇总'
      if (index === 2 + headerLength) return String(totalQty.value)
      if (index === 3 + headerLength) return tableUnitPrice.value
      if (index === 4 + headerLength) return tableTotalPrice.value
      return ''
    })
  }

  return { displaySizeHeaders, displayColorSizeRows, tableUnitPrice, rowTotalPrice, getColorSizeSummary }
}

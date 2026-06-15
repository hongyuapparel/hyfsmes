import type { TableColumnCtx } from 'element-plus'
import { formatDisplayNumber } from '@/utils/display-number'
import type { PackingFlatRow } from './usePackingGridRows'

interface GridTotals {
  boxCount: number
  totalQty: number
  totalWeight: number
  bySize: Record<string, number>
}

/** 装箱单表格的 rowspan 合并与合计行计算（列序与 PackingGrid 模板一一对应） */
export function usePackingGridLayout(getSizeHeaders: () => string[], getTotals: () => GridTotals) {
  /** 箱级列（箱号/重量/箱规/箱备注）在箱首行 rowspan 合并 */
  function spanMethod({
    row,
    columnIndex,
  }: {
    row: PackingFlatRow
    column: TableColumnCtx<PackingFlatRow>
    rowIndex: number
    columnIndex: number
  }): [number, number] {
    const sizeCount = getSizeHeaders().length
    const boxLevelColumns = new Set([0, 5 + sizeCount, 6 + sizeCount, 7 + sizeCount])
    if (!boxLevelColumns.has(columnIndex)) return [1, 1]
    return row.isFirstRow ? [row.rowspan, 1] : [0, 0]
  }

  function summaryMethod({ columns }: { columns: Array<TableColumnCtx<PackingFlatRow>>; data: PackingFlatRow[] }): string[] {
    const sizeHeaders = getSizeHeaders()
    const totals = getTotals()
    const sizeCount = sizeHeaders.length
    return columns.map((_, index) => {
      if (index === 0) return `${totals.boxCount} 箱`
      if (index >= 4 && index < 4 + sizeCount) {
        const size = sizeHeaders[index - 4]
        const sum = totals.bySize[size] ?? 0
        return sum > 0 ? formatDisplayNumber(sum) : ''
      }
      if (index === 4 + sizeCount) return formatDisplayNumber(totals.totalQty)
      if (index === 5 + sizeCount) return totals.totalWeight > 0 ? `${Math.round(totals.totalWeight * 100) / 100}` : ''
      return ''
    })
  }

  return { spanMethod, summaryMethod }
}

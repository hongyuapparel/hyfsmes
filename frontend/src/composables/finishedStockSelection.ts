import {
  isStockTableLeafRow,
  isStockTableParentRow,
  type StockTableLeafRow,
  type StockTableRow,
} from '@/utils/finishedStockTableUtils'

/**
 * Element Plus 树表在取消子行时可能仍把父行保留在 selection 中。
 * 导出和批量操作必须以显式勾选的叶子行优先；只有首次单独勾选父行时，
 * 才将它展开为全部子行。
 */
export function resolveFinishedStockLeafSelection(
  rows: StockTableRow[],
  previousRows: StockTableLeafRow[] = [],
): StockTableLeafRow[] {
  const explicitLeaves = rows.filter(isStockTableLeafRow)
  const explicitLeafKeys = new Set(explicitLeaves.map((row) => row._uiKey))
  const previousLeafKeys = new Set(previousRows.map((row) => row._uiKey))
  const seen = new Set<string>()
  const result: StockTableLeafRow[] = []

  const append = (row: StockTableLeafRow) => {
    if (seen.has(row._uiKey)) return
    seen.add(row._uiKey)
    result.push(row)
  }

  explicitLeaves.forEach(append)
  rows.filter(isStockTableParentRow).forEach((parent) => {
    const explicitlySelectedChildren = parent._children.filter((child) => explicitLeafKeys.has(child._uiKey))
    if (explicitlySelectedChildren.length > 0) {
      explicitlySelectedChildren.forEach(append)
      return
    }

    const hadSelectedChild = parent._children.some((child) => previousLeafKeys.has(child._uiKey))
    if (!hadSelectedChild) parent._children.forEach(append)
  })

  return result
}

/**
 * 将逻辑上的叶子行选择转换成表格应该展示的勾选行。
 * 父行仅在全部子行都被选择时保留勾选；部分选择时只勾选对应子行，
 * 避免父行仍显示“全选”却只导出部分颜色。
 */
export function buildFinishedStockTableSelection(
  tableRows: StockTableRow[],
  selectedLeaves: StockTableLeafRow[],
): StockTableRow[] {
  const selectedLeafKeys = new Set(selectedLeaves.map((row) => row._uiKey))
  const result: StockTableRow[] = []

  tableRows.forEach((row) => {
    if (isStockTableParentRow(row)) {
      const selectedChildren = row._children.filter((child) => selectedLeafKeys.has(child._uiKey))
      if (selectedChildren.length > 0 && selectedChildren.length === row._children.length) result.push(row)
      result.push(...selectedChildren)
      return
    }
    if (selectedLeafKeys.has(row._uiKey)) result.push(row)
  })

  return result
}

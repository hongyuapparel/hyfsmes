/**
 * 聚合入口：useOrderFormTables
 *
 * 内部由两个子 composable 组成：
 *   - useOrderColorSizeTable  — B 区（颜色/数量/尺码列）
 *   - useOrderSizeInfoTable   — D 区（尺码规格信息表格）
 *
 * 对外保持与原接口完全一致，调用方 import 路径无需修改。
 */

export type { InputComponentInstance, BEditCol, ColorRow } from './useOrderColorSizeTable'
export type { SizeInfoRow } from './useOrderSizeInfoTable'

import { useOrderColorSizeTable } from './useOrderColorSizeTable'
import { useOrderSizeInfoTable } from './useOrderSizeInfoTable'

export function useOrderFormTables() {
  const bTable = useOrderColorSizeTable()
  const dTable = useOrderSizeInfoTable(
    () => bTable.sizeHeaders.value,
    bTable.parseClipboardText,
  )

  // B 区增删尺码列时同步更新 D 区
  function addSizeColumn() {
    bTable.addSizeColumn(() => dTable.normalizeSizeInfoRows())
  }

  function insertSizeColumnBefore(sIndex: number) {
    bTable.insertSizeColumnBefore(sIndex, () => dTable.normalizeSizeInfoRows())
  }

  function removeSizeColumn(sIndex: number) {
    bTable.removeSizeColumn(sIndex, () => dTable.normalizeSizeInfoRows())
  }

  return {
    // B 区
    defaultSizeHeaders: bTable.defaultSizeHeaders,
    sizeHeaders: bTable.sizeHeaders,
    colorRows: bTable.colorRows,
    editingCell: bTable.editingCell,
    bTableRef: bTable.bTableRef,
    colorCellRefs: bTable.colorCellRefs,
    activeColorCell: bTable.activeColorCell,
    colorNameInputRef: bTable.colorNameInputRef,
    remarkInputRef: bTable.remarkInputRef,
    sizeTotals: bTable.sizeTotals,
    grandTotal: bTable.grandTotal,
    setColorCellRef: bTable.setColorCellRef,
    setActiveColorCell: bTable.setActiveColorCell,
    focusColorCell: bTable.focusColorCell,
    startEditBCell: bTable.startEditBCell,
    onBCellBlur: bTable.onBCellBlur,
    onColorCellKeydown: bTable.onColorCellKeydown,
    parseClipboardText: bTable.parseClipboardText,
    onColorCellPaste: bTable.onColorCellPaste,
    normalizeColorRows: bTable.normalizeColorRows,
    ensureAtLeastOneColorRow: bTable.ensureAtLeastOneColorRow,
    addColorRow: bTable.addColorRow,
    removeColorRow: bTable.removeColorRow,
    addSizeColumn,
    guessSizeLabelBefore: bTable.guessSizeLabelBefore,
    insertSizeColumnBefore,
    removeSizeColumn,
    calcRowTotal: bTable.calcRowTotal,
    bSummaryMethod: bTable.bSummaryMethod,
    // D 区
    defaultSizeMetaHeaders: dTable.defaultSizeMetaHeaders,
    sizeMetaHeaders: dTable.sizeMetaHeaders,
    sizeInfoRows: dTable.sizeInfoRows,
    sizeInfoTableRef: dTable.sizeInfoTableRef,
    sizeGridRefs: dTable.sizeGridRefs,
    nextSizeInfoRowKey: dTable.nextSizeInfoRowKey,
    normalizeSizeInfoRows: dTable.normalizeSizeInfoRows,
    setSizeGridCellRef: dTable.setSizeGridCellRef,
    focusSizeGridCell: dTable.focusSizeGridCell,
    onSizeGridKeydown: dTable.onSizeGridKeydown,
    onSizeGridPaste: dTable.onSizeGridPaste,
    addSizeInfoRow: dTable.addSizeInfoRow,
    removeSizeInfoRow: dTable.removeSizeInfoRow,
    initSizeInfoSortable: dTable.initSizeInfoSortable,
    destroySizeInfoSortable: dTable.destroySizeInfoSortable,
    addSizeMetaColumn: dTable.addSizeMetaColumn,
    removeSizeMetaColumn: dTable.removeSizeMetaColumn,
    copySizeInfoToClipboard: dTable.copySizeInfoToClipboard,
  }
}

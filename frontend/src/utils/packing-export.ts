import * as XLSX from 'xlsx'
import type { PackingListDetail } from '@/api/packing-lists'

/**
 * 装箱单中英双语 Excel 导出（贴近公盘模板）。
 * 已知限制：SheetJS 社区版不支持嵌入图片，颜色列导出文字。
 */
export function exportPackingListExcel(detail: PackingListDetail): void {
  const sizeHeaders = detail.sizeHeaders
  const header = [
    '箱号 Carton No.',
    '款号 Style No.',
    '颜色 Color',
    ...sizeHeaders,
    '合计 Qty',
    '重量 Weight(kg)',
    '箱规 Carton Size(cm)',
    '备注 Remark',
  ]
  const totalCols = header.length

  const aoa: Array<Array<string | number>> = []
  aoa.push([`装箱日期 Pack Date: ${detail.packDate ?? ''}`, '', '', `Total: ${detail.boxes.length} 箱`])
  aoa.push([
    `客户 Client: ${detail.customerName}`,
    '',
    `业务员 Service manager: ${detail.serviceManager}`,
    `PO#: ${detail.poNo}`,
    `备注 Remark: ${detail.remark}`,
  ])
  aoa.push(header)

  const merges: XLSX.Range[] = []
  let rowIndex = 3
  let totalQty = 0
  let totalWeight = 0
  const sizeTotals: Record<string, number> = {}

  for (const box of detail.boxes) {
    const startRow = rowIndex
    totalWeight += box.weightKg ?? 0
    const items = box.items.length ? box.items : []
    for (const item of items) {
      const sizeCells = sizeHeaders.map((size) => {
        const qty = item.sizeQuantities[size] ?? 0
        if (qty > 0) sizeTotals[size] = (sizeTotals[size] ?? 0) + qty
        return qty > 0 ? qty : ''
      })
      totalQty += item.totalQty
      aoa.push([
        box.boxSeq,
        item.styleNo,
        item.colorName,
        ...sizeCells,
        item.totalQty || '',
        box.weightKg ?? '',
        box.cartonSize,
        box.remark,
      ])
      rowIndex++
    }
    if (!items.length) {
      aoa.push([box.boxSeq, '', '', ...sizeHeaders.map(() => ''), '', box.weightKg ?? '', box.cartonSize, box.remark])
      rowIndex++
    }
    const endRow = rowIndex - 1
    if (endRow > startRow) {
      // 多款箱：合并箱号/重量/箱规/备注
      const boxLevelCols = [0, totalCols - 3, totalCols - 2, totalCols - 1]
      for (const col of boxLevelCols) {
        merges.push({ s: { r: startRow, c: col }, e: { r: endRow, c: col } })
      }
    }
  }

  aoa.push([
    `合计 Total: ${detail.boxes.length} 箱`,
    '',
    '',
    ...sizeHeaders.map((size) => sizeTotals[size] ?? ''),
    totalQty,
    totalWeight > 0 ? Math.round(totalWeight * 100) / 100 : '',
    '',
    '',
  ])

  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = merges
  ws['!cols'] = [
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    ...sizeHeaders.map(() => ({ wch: 7 })),
    { wch: 10 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '装箱单')
  XLSX.writeFile(wb, `装箱单_${detail.code}_${detail.customerName}.xlsx`)
}

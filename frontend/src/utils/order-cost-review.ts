import type { OrderDetail } from '@/api/orders'
import type { MaterialRow, ProcessItemRow, ProductionRow } from './order-cost'

export function orderCostImages(order: OrderDetail | null): string[] {
  if (!order) return []
  return [...new Set([order.imageUrl, ...(order.attachments ?? []), ...(order.colorSizeRows ?? []).map(row => row.imageUrl)]
    .map(url => String(url ?? '').trim()).filter(Boolean))]
}

export const materialHasContent = (row: Partial<MaterialRow>) => Boolean(
  row.materialName || row.materialTypeId || row.materialType || row.supplierName || row.color || row.remark || row.unitPrice || row.usagePerPiece,
)
export const processHasContent = (row: Partial<ProcessItemRow>) => Boolean(row.processName || row.part || row.supplierName || row.remark || row.unitPrice)

export function reviewCostRows(materials: MaterialRow[], processes: ProcessItemRow[], production: ProductionRow[], multiplier: number): string[] {
  const issues: string[] = []
  const positive = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0
  materials.forEach((row) => {
    if (!materialHasContent(row) || row.includeInCost === false) return
    const missing = [!row.materialName?.trim() && '物料名称', !positive(row.unitPrice) && '有效单价', !positive(row.usagePerPiece) && '单件用量'].filter(Boolean)
    if (missing.length) issues.push(`物料“${row.materialName || '未命名'}${row.color ? ` / ${row.color}` : ''}”：请核对${missing.join('、')}`)
  })
  processes.forEach((row) => {
    if (!processHasContent(row)) return
    const missing = [!row.processName?.trim() && '工艺名称', !positive(row.unitPrice) && '有效单价', !positive(row.quantity) && '数量', !row.supplierName?.trim() && '供应商'].filter(Boolean)
    if (missing.length) issues.push(`工艺“${row.processName || '未命名'}${row.part ? ` / ${row.part}` : ''}”：请核对${missing.join('、')}`)
  })
  production.forEach((row) => {
    if (!row.processName && !row.processId && !row.unitPrice && !row.remark) return
    if (!row.processName?.trim() || !positive(row.unitPrice) || !positive(row.quantity ?? 1)) {
      issues.push(`生产工序“${row.processName || '未命名'}”：请核对工序、单价及数量`)
    }
  })
  if (!positive(multiplier)) issues.push('工序倍率为 0 或无效，生产工序成本将不计入总成本')
  return issues
}

const text = (value: unknown) => String(value ?? '').trim()
const number = (value: unknown) => Number(value) || 0
const materialStructure = (rows: Partial<MaterialRow>[]) => rows.filter(materialHasContent).map(row => JSON.stringify([
  row.materialTypeId ?? null, text(row.materialName), text(row.supplierName), text(row.color), text(row.fabricWidth),
  number(row.usagePerPiece), number(row.lossPercent), text(row.remark),
])).sort()
const processStructure = (rows: Partial<ProcessItemRow>[]) => rows.filter(processHasContent).map(row => JSON.stringify([
  text(row.processName), text(row.supplierName), text(row.part), text(row.remark),
])).sort()

/** A difference may be intentional cost-page editing; never interpret it as permission to overwrite. */
export function orderCostStructureDifferences(order: OrderDetail | null, materials: MaterialRow[], processes: ProcessItemRow[]): string[] {
  if (!order) return []
  const result: string[] = []
  if (JSON.stringify(materialStructure(order.materials ?? [])) !== JSON.stringify(materialStructure(materials))) result.push('物料')
  if (JSON.stringify(processStructure(order.processItems ?? [])) !== JSON.stringify(processStructure(processes))) result.push('工艺项目')
  return result
}

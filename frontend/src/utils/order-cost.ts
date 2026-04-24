export interface MaterialRow {
  materialTypeId?: number | null
  materialType?: string
  supplierName?: string
  materialName?: string
  color?: string
  fabricWidth?: string
  usagePerPiece?: number | null
  lossPercent?: number | null
  orderPieces?: number | null
  purchaseQuantity?: number | null
  cuttingQuantity?: number | null
  remark?: string
  unitPrice: number
  includeInCost?: boolean
}

export interface ProcessItemRow {
  processName?: string
  supplierName?: string
  part?: string
  remark?: string
  unitPrice: number
  quantity: number
}

export interface ProductionRow {
  processId?: number | null
  department?: string
  jobType?: string
  processName?: string
  remark?: string
  unitPrice: number
  quantity?: number | null
}

export const DEFAULT_PROCESS_ITEM_QTY = 1
export const DEFAULT_PRODUCTION_PROCESS_QTY = 1
export const DEFAULT_PROFIT_MARGIN = 0.1
export const DEFAULT_PRODUCTION_MULTIPLIER = 2
export const DEPARTMENT_ORDER = ['裁床', '车缝', '尾部']

export function isMaterialIncluded(row: MaterialRow): boolean {
  return row.includeInCost !== false
}

export function materialAmount(row: MaterialRow): number {
  if (!isMaterialIncluded(row)) return 0
  const usage = Number(row.usagePerPiece) || 0
  const lossPercent = Number(row.lossPercent) || 0
  const price = Number(row.unitPrice) || 0
  const lossRate = lossPercent / 100
  return usage * (1 + lossRate) * price
}

export function processItemAmount(row: ProcessItemRow): number {
  const qty = Number(row.quantity) || 0
  const price = Number(row.unitPrice) || 0
  return qty * price
}

export function productionLineQuantity(row: ProductionRow): number {
  const quantity = row.quantity
  if (quantity == null) return DEFAULT_PRODUCTION_PROCESS_QTY
  const num = Number(quantity)
  if (!Number.isFinite(num) || num < 0) return DEFAULT_PRODUCTION_PROCESS_QTY
  return num
}

export function productionAmount(row: ProductionRow): number {
  const price = Number(row.unitPrice) || 0
  return price * productionLineQuantity(row)
}

export function normalizeSupplierName(value: unknown): string {
  return String(value ?? '').trim()
}

export function getMaterialTypeMergeKey(row: MaterialRow): string {
  if (typeof row.materialTypeId === 'number' && Number.isFinite(row.materialTypeId)) {
    return `id:${row.materialTypeId}`
  }
  const label = String(row.materialType ?? '').trim()
  return label ? `label:${label}` : ''
}

export function normalizeProfitMargin(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || num < 0) return DEFAULT_PROFIT_MARGIN
  if (Math.abs(num - 0.15) < 1e-9) return DEFAULT_PROFIT_MARGIN
  return num
}

export function normalizeProductionCostMultiplier(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || num < 0) return DEFAULT_PRODUCTION_MULTIPLIER
  return num
}

export function getJobTypeLabel(value: string): string {
  if (!value) return ''
  const parts = value.split('>').map((item) => item.trim()).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : value
}

export function formatProductionProcessSelectLabel(name: string): string {
  const display = (name || '').trim()
  return display || '未命名工序'
}

export function sortMaterialRows(
  rows: MaterialRow[],
  materialTypeOptions: Array<{ id: number; label: string }>,
): MaterialRow[] {
  const getTypeText = (row: MaterialRow): string => {
    if (typeof row.materialTypeId === 'number' && Number.isFinite(row.materialTypeId)) {
      const found = materialTypeOptions.find((item) => item.id === row.materialTypeId)
      if (found?.label) return found.label
    }
    return String(row.materialType ?? '').trim()
  }
  return [...rows].sort((a, b) => {
    const typeA = getTypeText(a)
    const typeB = getTypeText(b)
    if (typeA !== typeB) return typeA.localeCompare(typeB)
    const supplierA = normalizeSupplierName(a.supplierName)
    const supplierB = normalizeSupplierName(b.supplierName)
    if (supplierA !== supplierB) return supplierA.localeCompare(supplierB)
    const nameA = String(a.materialName ?? '').trim()
    const nameB = String(b.materialName ?? '').trim()
    return nameA.localeCompare(nameB)
  })
}

export function sortProductionRows(rows: ProductionRow[]): ProductionRow[] {
  const orderMap = new Map(DEPARTMENT_ORDER.map((item, index) => [item, index]))
  const depIndex = (dept: string) => orderMap.get(dept ?? '') ?? DEPARTMENT_ORDER.length
  return [...rows].sort((a, b) => {
    const depA = depIndex(a.department ?? '')
    const depB = depIndex(b.department ?? '')
    if (depA !== depB) return depA - depB
    const jobA = (a.jobType ?? '').toString()
    const jobB = (b.jobType ?? '').toString()
    if (jobA !== jobB) return jobA.localeCompare(jobB)
    const nameA = (a.processName ?? '').toString()
    const nameB = (b.processName ?? '').toString()
    return nameA.localeCompare(nameB)
  })
}

export function ensureBaseCostRows(materialRows: MaterialRow[], processRows: ProcessItemRow[]) {
  const nextMaterials = materialRows.length
    ? materialRows
    : [{ unitPrice: 0, includeInCost: true } as MaterialRow]
  const nextProcessItems = processRows.length
    ? processRows
    : [{ unitPrice: 0, quantity: DEFAULT_PROCESS_ITEM_QTY } as ProcessItemRow]
  return { materialRows: nextMaterials, processItemRows: nextProcessItems }
}

export function buildSnapshotPayload(params: {
  materialRows: MaterialRow[]
  processItemRows: ProcessItemRow[]
  productionRows: ProductionRow[]
  productionCostMultiplier: number
  profitMargin: number
}) {
  return {
    materialRows: params.materialRows.map((row) => ({
      materialTypeId: row.materialTypeId ?? null,
      supplierName: row.supplierName ?? '',
      materialName: row.materialName ?? '',
      color: row.color ?? '',
      fabricWidth: row.fabricWidth ?? '',
      usagePerPiece: row.usagePerPiece ?? null,
      lossPercent: row.lossPercent ?? null,
      orderPieces: row.orderPieces ?? null,
      purchaseQuantity: row.purchaseQuantity ?? null,
      cuttingQuantity: row.cuttingQuantity ?? null,
      remark: row.remark ?? '',
      unitPrice: row.unitPrice,
      includeInCost: isMaterialIncluded(row),
    })),
    processItemRows: params.processItemRows.map((row) => ({
      processName: row.processName ?? '',
      supplierName: row.supplierName ?? '',
      part: row.part ?? '',
      remark: row.remark ?? '',
      unitPrice: row.unitPrice,
      quantity: row.quantity ?? 0,
    })),
    productionRows: params.productionRows.map((row) => ({
      processId: row.processId ?? null,
      department: row.department ?? '',
      jobType: row.jobType ?? '',
      processName: row.processName ?? '',
      unitPrice: row.unitPrice,
      quantity: productionLineQuantity(row),
      remark: row.remark ?? '',
    })),
    productionCostMultiplier: params.productionCostMultiplier,
    profitMargin: params.profitMargin,
  }
}

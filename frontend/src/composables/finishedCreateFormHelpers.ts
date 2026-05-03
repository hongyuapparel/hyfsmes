import type { FormRules } from 'element-plus'
import type { ProductItem } from '@/api/products'
import { getOrderDetail, getOrders, type OrderListItem } from '@/api/orders'
import { formatDisplayNumber } from '@/utils/display-number'
import { getSizeHeaderKey, normalizeSizeHeader, sortSizeHeaders } from '@/utils/sizeHeaders'

export const DEFAULT_CREATE_SIZE_HEADERS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL'] as const

export type FinishedCreateSizeRow = {
  _key: string
  colorName: string
  imageUrl: string
  quantities: Array<number | null>
}

export type FinishedCreateQuickAddSource = {
  orderNo?: string
  skuCode?: string
  unitPrice?: string | number
  warehouseId?: number | null
  inventoryTypeId?: number | null
  department?: string
  location?: string
  imageUrl?: string
  productImageUrl?: string
  colorImages?: Array<{ colorName: string; imageUrl: string }>
  sizeBreakdown?: {
    headers: string[]
    rows: Array<{ colorName: string; values?: number[]; quantities?: number[] }>
  } | null
  _selectedColorName?: string | null
  _displayColor?: string
}

let _rowKeyCounter = 0
function nextRowKey(): string {
  return `cr-${Date.now()}-${++_rowKeyCounter}`
}

export const createDefaultSizeRow = (): FinishedCreateSizeRow => ({
  _key: nextRowKey(),
  colorName: '默认',
  imageUrl: '',
  quantities: Array(DEFAULT_CREATE_SIZE_HEADERS.length).fill(0),
})

export function sumCreateSizeQuantities(quantities: unknown[]): number {
  return quantities.reduce<number>((sum, quantity) => sum + Math.max(0, Math.trunc(Number(quantity) || 0)), 0)
}

export function formatCreateUnitPrice(unitPrice: string | undefined): string {
  if (unitPrice == null || unitPrice === '') return '¥0'
  const n = Number(unitPrice)
  return Number.isFinite(n) ? `¥${formatDisplayNumber(n)}` : '¥0'
}

export function formatCreateTotalPrice(quantity: number, unitPrice: string | undefined): string {
  const n = Number(unitPrice)
  if (!Number.isFinite(n) || !Number.isFinite(quantity)) return '¥0'
  return `¥${formatDisplayNumber(quantity * n)}`
}

export function remapCreateQuantities(sourceHeaders: string[], values: unknown[], targetHeaders: string[]): Array<number | null> {
  const indexMap = new Map(sourceHeaders.map((header, index) => [getSizeHeaderKey(header), index]))
  return targetHeaders.map((header) => {
    const sourceIndex = indexMap.get(getSizeHeaderKey(header))
    if (sourceIndex == null) return null
    const quantity = Number(values[sourceIndex])
    return Number.isFinite(quantity) && quantity >= 0 ? Math.trunc(quantity) : null
  })
}

export function buildQuickAddSizeMatrix(source: FinishedCreateQuickAddSource): {
  headers: string[]
  rows: FinishedCreateSizeRow[]
} {
  const snapshot = source.sizeBreakdown
  const headers = Array.isArray(snapshot?.headers)
    ? snapshot.headers.map(normalizeSizeHeader).filter(Boolean)
    : []
  const sortedHeaders = sortSizeHeaders(headers)
  const rows = Array.isArray(snapshot?.rows) ? snapshot.rows : []

  // Build colorImages lookup map for image URL population
  const colorImageLookup = new Map<string, string>()
  if (Array.isArray(source.colorImages)) {
    source.colorImages.forEach((ci) => {
      const colorName = String(ci?.colorName ?? '').trim()
      if (colorName && ci?.imageUrl) colorImageLookup.set(colorName, ci.imageUrl)
    })
  }

  if (sortedHeaders.length > 0 && rows.length > 0) {
    return {
      headers: sortedHeaders,
      rows: rows.map((row) => {
        const colorName = String(row.colorName ?? '').trim() || '默认'
        return {
          _key: nextRowKey(),
          colorName,
          imageUrl: colorImageLookup.get(colorName) || '',
          // Use 0 (not null) so el-input-number renders as empty input cleanly
          quantities: sortedHeaders.map(() => 0),
        }
      }),
    }
  }

  const colorName = String(source._selectedColorName || source._displayColor || '默认').trim() || '默认'
  return {
    headers: [...DEFAULT_CREATE_SIZE_HEADERS],
    rows: [{ _key: nextRowKey(), colorName, imageUrl: colorImageLookup.get(colorName) || '', quantities: Array(DEFAULT_CREATE_SIZE_HEADERS.length).fill(0) }],
  }
}

export function createFinishedCreateRules(): FormRules {
  return {
    skuCode: [{ required: true, message: '请选择SKU', trigger: 'change' }],
    quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
    warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
    department: [{ required: true, message: '请选择部门', trigger: 'change' }],
    location: [{ required: true, message: '请输入存放地址', trigger: 'blur' }],
  }
}

export function filterFinishedCreateSkuProducts(products: ProductItem[], keyword: string): ProductItem[] {
  const kw = keyword.trim().toLowerCase()
  if (!kw) return products
  return products.filter((item) => {
    const sku = String(item.skuCode ?? '').toLowerCase()
    const customer = String(item.customer?.companyName ?? '').toLowerCase()
    return sku.includes(kw) || customer.includes(kw)
  })
}

export async function resolveFinishedCreateOrder(value: string): Promise<OrderListItem | null> {
  const listRes = await getOrders({ orderNo: value, page: 1, pageSize: 5 })
  const rows = listRes.data?.list ?? []
  const exact = rows.find((row) => String(row.orderNo ?? '').trim() === value)
  if (exact) return exact
  if (rows.length === 1) return rows[0]
  const orderId = Number(value)
  if (!Number.isInteger(orderId) || orderId <= 0) return null
  return (await getOrderDetail(orderId)).data ?? null
}

import { formatMaterialUsageQtyDisplay } from '@/utils/material-usage-qty'

export interface MaterialQuantityDisplaySource {
  materialType?: string | null
  materialName?: string | null
}

const FABRIC_TYPE_KEYWORDS = ['主布', '里布', '衬布', '配布', '面料']
const FABRIC_NAME_KEYWORDS = ['布', '面料', '蕾丝', '花边', '网', '橡筋', '丈根', '织带']

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim()
}

export function getMaterialQuantityUnit(row: MaterialQuantityDisplaySource): string {
  const materialType = normalizeText(row.materialType)
  const materialName = normalizeText(row.materialName)
  if (materialType.includes('辅料')) return '个'
  if (materialType.includes('成品')) return '件'
  if (FABRIC_TYPE_KEYWORDS.some((keyword) => materialType.includes(keyword))) return '米'
  if (FABRIC_NAME_KEYWORDS.some((keyword) => materialName.includes(keyword))) return '米'
  return ''
}

/**
 * 物料数量只读展示（采购计划用量、领料数量等）。
 * 数值部分与单件用量一致：最多 3 位小数，去掉无意义尾随 0。
 */
export function formatMaterialQuantity(
  quantity: number | string | null | undefined,
  row: MaterialQuantityDisplaySource,
): string {
  if (quantity == null || quantity === '') return '-'
  const value = formatMaterialUsageQtyDisplay(quantity)
  if (value === '') return '-'
  const unit = getMaterialQuantityUnit(row)
  return unit ? `${value} ${unit}` : value
}

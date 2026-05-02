import { formatDisplayNumber } from '@/utils/display-number'

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

export function formatMaterialQuantity(
  quantity: number | string | null | undefined,
  row: MaterialQuantityDisplaySource,
): string {
  if (quantity == null || quantity === '') return '-'
  const value = formatDisplayNumber(quantity)
  const unit = getMaterialQuantityUnit(row)
  return unit ? `${value} ${unit}` : value
}

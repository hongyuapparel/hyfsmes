import { normalizeSizeHeader } from '@/utils/sizeHeaders'

/** 辅料分码默认尺码梯 */
export const DEFAULT_ACCESSORY_SIZE_HEADERS = ['S', 'M', 'L']

const LETTER_SIZE_LADDER = [
  'XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL',
]

/** 根据已有尺码推荐下一个字母码（无法推断时返回空串，交用户手填） */
export function nextAccessorySizeLabel(headers: Array<string | null | undefined>): string {
  const present = new Set(
    (headers ?? [])
      .map((h) => normalizeSizeHeader(h).toUpperCase())
      .filter((h) => !!h),
  )
  let maxIndex = -1
  LETTER_SIZE_LADDER.forEach((size, index) => {
    if (present.has(size)) maxIndex = Math.max(maxIndex, index)
  })
  if (maxIndex < 0) return present.size ? '' : 'S'
  return LETTER_SIZE_LADDER[maxIndex + 1] ?? ''
}

/** 提交前清洗：去掉空表头列、数量对齐成数字（保留正负） */
export function cleanAccessoryMatrix(
  headers: Array<string | null | undefined>,
  quantities: Array<number | null | undefined>,
): { headers: string[]; quantities: number[] } {
  const outHeaders: string[] = []
  const outQuantities: number[] = []
  ;(headers ?? []).forEach((header, index) => {
    const label = String(header ?? '').trim()
    if (!label) return
    outHeaders.push(label)
    outQuantities.push(Number(quantities?.[index]) || 0)
  })
  return { headers: outHeaders, quantities: outQuantities }
}

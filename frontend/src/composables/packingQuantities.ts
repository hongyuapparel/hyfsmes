import type { PackingItemDraft } from './usePackingGridRows'
import type { PackingListDetail } from '@/api/packing-lists'

/** 规范尺码键和数量；无名数据不属于任何尺码列。 */
export function sanitizePackingSizeQuantities(raw: unknown): Record<string, number> {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result: Record<string, number> = {}
  for (const [rawSize, rawQty] of Object.entries(raw as Record<string, unknown>)) {
    const size = rawSize.trim()
    const qty = Number(rawQty)
    if (!size || !Number.isFinite(qty) || qty <= 0) continue
    result[size] = (result[size] ?? 0) + qty
  }
  return result
}

/** 只保留当前表头可见的尺码数量，避免隐藏旧键参与合计或保存。 */
export function normalizePackingSizeQuantities(
  sizeHeaders: readonly string[],
  raw: unknown,
): Record<string, number> {
  const sanitized = sanitizePackingSizeQuantities(raw)
  const result: Record<string, number> = {}
  for (const rawHeader of sizeHeaders) {
    const header = rawHeader.trim()
    if (!header || header in result) continue
    const qty = sanitized[header]
    if (qty > 0) result[header] = qty
  }
  return result
}

export function packingItemHasSizeQuantity(item: PackingItemDraft): boolean {
  return Object.keys(item.sizeQuantities).length > 0
}

export function setPackingSizeQuantity(
  item: PackingItemDraft,
  size: string,
  value: number | undefined | null,
): void {
  if (!size.trim()) return
  // 一旦进入分码录入，旧的无分码合计不再是事实；清空最后一个尺码时也不能让旧合计复活。
  item.totalQty = 0
  if (value == null || !Number.isFinite(value) || value <= 0) delete item.sizeQuantities[size]
  else item.sizeQuantities[size] = value
}

export function packingItemTotal(item: Pick<PackingItemDraft, 'sizeQuantities' | 'totalQty'>, sizeHeaders = Object.keys(item.sizeQuantities)): number {
  const sanitized = sanitizePackingSizeQuantities(item.sizeQuantities)
  const sizeTotal = Object.values(normalizePackingSizeQuantities(sizeHeaders, sanitized))
    .reduce((sum, n) => sum + n, 0)
  if (sizeTotal > 0) return sizeTotal
  // 原始行有分码数据时，即使全部尺码已删除，也不能回退到旧 totalQty。
  return Object.keys(item.sizeQuantities).length ? 0 : Math.max(0, Number(item.totalQty) || 0)
}

/** 编辑、客户单与导出共用的历史数据读取口径，不修改传入的已保存快照。 */
export function normalizePackingDetail(data: PackingListDetail): PackingListDetail {
  const sizeHeaders = Array.from(new Set(data.sizeHeaders.map((header) => header.trim()).filter(Boolean)))
  return {
    ...data,
    sizeHeaders,
    boxes: data.boxes.map((box) => ({ ...box, items: box.items.map((item) => {
      const sizeQuantities = normalizePackingSizeQuantities(sizeHeaders, item.sizeQuantities)
      const totalQty = packingItemTotal(item, sizeHeaders)
      return { ...item, sizeQuantities, totalQty }
    }) })),
  }
}

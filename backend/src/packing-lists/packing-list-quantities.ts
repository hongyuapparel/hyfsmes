export interface PackingQuantityItemLike {
  styleNo?: string | null;
  colorName?: string | null;
  sizeQuantities?: unknown;
}

export interface PackingQuantityBoxLike {
  items?: PackingQuantityItemLike[] | null;
}

export interface UnexpectedPackingSizeQuantity {
  boxIndex: number;
  itemIndex: number;
  styleNo: string;
  colorName: string;
  sizeName: string;
  quantity: number;
}

export function normalizePackingSizeHeaders(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map((header) => String(header ?? '').trim()).filter(Boolean)));
}

/** 规范尺码数量；无名数据不属于任何尺码列。 */
export function normalizePackingSizeQuantities(raw: unknown): Record<string, number> {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [rawSize, rawValue] of Object.entries(raw as Record<string, unknown>)) {
    const size = rawSize.trim();
    const quantity = Number(rawValue);
    if (!size || !Number.isFinite(quantity) || quantity <= 0) continue;
    out[size] = (out[size] ?? 0) + quantity;
  }
  return out;
}

/** 保存口径：只保留装箱单当前表头中的尺码。 */
export function normalizePackingSizeQuantitiesForHeaders(
  raw: unknown,
  sizeHeaders: readonly string[],
): Record<string, number> {
  const normalized = normalizePackingSizeQuantities(raw);
  const out: Record<string, number> = {};
  for (const header of normalizePackingSizeHeaders(sizeHeaders)) {
    const quantity = normalized[header];
    if (quantity > 0) out[header] = quantity;
  }
  return out;
}

export function sumPackingSizeQuantities(sizeQuantities: Record<string, number>): number {
  return Object.values(sizeQuantities).reduce((sum, quantity) => sum + quantity, 0);
}

/** totalQty 仅在完全无分码时手填；分码合计包括显式全零，不回退历史缓存。 */
export function packingQuantityTotal(raw: unknown, totalQty: unknown, sizeHeaders: readonly string[]): number {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length) {
    return sumPackingSizeQuantities(normalizePackingSizeQuantitiesForHeaders(raw, sizeHeaders));
  }
  const total = Number(totalQty);
  return Number.isFinite(total) ? Math.max(0, total) : 0;
}

/** 发货前检查内部数量一致性；正常读取和保存已清除表头外数据。 */
export function findUnexpectedPackingSizeQuantity(
  sizeHeaders: unknown,
  boxes: PackingQuantityBoxLike[] | null | undefined,
): UnexpectedPackingSizeQuantity | null {
  const allowed = new Set(normalizePackingSizeHeaders(sizeHeaders));
  for (let boxIndex = 0; boxIndex < (boxes ?? []).length; boxIndex++) {
    const box = boxes?.[boxIndex];
    for (let itemIndex = 0; itemIndex < (box?.items ?? []).length; itemIndex++) {
      const item = box?.items?.[itemIndex];
      for (const [sizeName, quantity] of Object.entries(normalizePackingSizeQuantities(item?.sizeQuantities))) {
        if (allowed.has(sizeName)) continue;
        return {
          boxIndex,
          itemIndex,
          styleNo: String(item?.styleNo ?? '').trim(),
          colorName: String(item?.colorName ?? '').trim(),
          sizeName,
          quantity,
        };
      }
    }
  }
  return null;
}

export function formatUnexpectedPackingSizeQuantity(error: UnexpectedPackingSizeQuantity): string {
  const itemLabel = error.styleNo || error.colorName || `第${error.itemIndex + 1}行`;
  return `第${error.boxIndex + 1}箱「${itemLabel}」存在未显示尺码「${error.sizeName}」${error.quantity}件，请刷新页面确认后再保存`;
}

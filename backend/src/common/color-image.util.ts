import type { ColorSizeSnapshot } from '../finished-goods-stock/finished-goods-stock.types';

/** Match pictures by exact color, never by row position, SKU or quantity. */
export function colorImageMap(raw: unknown): Map<string, string> {
  let rows = raw;
  if (typeof rows === 'string') {
    try { rows = JSON.parse(rows) as unknown; } catch { return new Map(); }
  }
  const result = new Map<string, string>();
  const conflicts = new Set<string>();
  if (!Array.isArray(rows)) return result;
  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const color = String(row.colorName ?? '').trim();
    if (!color || !Object.prototype.hasOwnProperty.call(row, 'imageUrl')) continue;
    const image = String(row.imageUrl ?? '').trim();
    if (result.has(color) && result.get(color) !== image) conflicts.add(color);
    result.set(color, image);
  }
  for (const color of conflicts) result.set(color, '');
  return result;
}

/** Decorate factual quantities only; an existing image snapshot (even blank) wins. */
export function withColorImages(snapshot: ColorSizeSnapshot | null, sourceRows: unknown): ColorSizeSnapshot | null {
  if (!snapshot) return null;
  const images = colorImageMap(sourceRows);
  return {
    headers: [...snapshot.headers],
    rows: snapshot.rows.map(row => {
      const color = String(row.colorName ?? '').trim();
      return { ...row, quantities: [...row.quantities],
        ...(row.imageUrl === undefined && images.has(color) ? { imageUrl: images.get(color)! } : {}),
      };
    }),
  };
}

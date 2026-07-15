import type { EntityManager } from 'typeorm';
import type { ColorSizeSnapshot } from '../finished-goods-stock/finished-goods-stock.types';
import { parseStoredColorSizeSnapshot } from '../finished-goods-stock/finished-goods-stock-query.utils';

type FinishingFallbackBundle = {
  headers: string[];
  normalByColor: Array<{ colorName: string; quantities: number[] }> | null;
  defectByColor: Array<{ colorName: string; quantities: number[] }> | null;
  normalRow: number[] | null;
  defectRow: number[] | null;
};

function parseJsonArr(raw: unknown): unknown[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j : null;
    } catch {
      return null;
    }
  }
  return null;
}

function parseByColorList(raw: unknown): Array<{ colorName: string; quantities: number[] }> | null {
  const arr = parseJsonArr(raw);
  if (!arr || arr.length === 0) return null;
  const out: Array<{ colorName: string; quantities: number[] }> = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const it = item as { colorName?: unknown; quantities?: unknown };
    const name = String(it.colorName ?? '').trim();
    const qs = Array.isArray(it.quantities) ? it.quantities : [];
    out.push({ colorName: name, quantities: qs.map((n) => Math.max(0, Math.trunc(Number(n) || 0))) });
  }
  return out.length > 0 ? out : null;
}

function parseNumberRow(raw: unknown): number[] | null {
  const arr = parseJsonArr(raw);
  if (!arr || arr.length === 0) return null;
  return arr.map((n) => Math.max(0, Math.trunc(Number(n) || 0)));
}

function parseHeaders(raw: unknown): string[] {
  const arr = parseJsonArr(raw);
  if (!arr) return [];
  return arr.map((h) => String(h ?? ''));
}

/** 从尾部累计明细构造「本批」快照（仅单条同 sourceType pending 时可靠）。 */
export function buildFinishingFallbackSnapshot(
  bundle: FinishingFallbackBundle | null | undefined,
  sourceType: string,
  quantity: number,
  pendingCountForOrderType: number,
): ColorSizeSnapshot | null {
  if (!bundle) return null;
  if (pendingCountForOrderType !== 1) return null;
  const headers = bundle.headers.filter((h) => h && h !== '合计');
  if (headers.length === 0) return null;
  const sizeLen = headers.length;
  const safeQty = Math.max(0, Math.trunc(Number(quantity) || 0));
  const byColor = sourceType === 'defect' ? bundle.defectByColor : bundle.normalByColor;
  if (byColor && byColor.length > 0) {
    const rows = byColor.map((r) => {
      const q = Array.from({ length: sizeLen }, (_, i) => Math.max(0, Math.trunc(Number(r.quantities[i]) || 0)));
      return { colorName: r.colorName || '-', quantities: q };
    });
    const grand = rows.reduce((s, r) => s + r.quantities.reduce((a, b) => a + b, 0), 0);
    if (grand === safeQty) return { headers, rows };
  }
  const oneRow = sourceType === 'defect' ? bundle.defectRow : bundle.normalRow;
  if (oneRow && oneRow.length > 0) {
    const perSize = Array.from({ length: sizeLen }, (_, i) => Math.max(0, Math.trunc(Number(oneRow[i]) || 0)));
    const total = perSize.reduce((a, b) => a + b, 0);
    if (total === safeQty) {
      return { headers, rows: [{ colorName: '-', quantities: perSize }] };
    }
  }
  return null;
}

export async function loadFinishingFallbackBundles(
  manager: EntityManager,
  orderIds: number[],
): Promise<{
  byOrder: Map<number, FinishingFallbackBundle>;
  pendingCountByOrderType: Map<string, number>;
}> {
  const byOrder = new Map<number, FinishingFallbackBundle>();
  const pendingCountByOrderType = new Map<string, number>();
  const unique = Array.from(new Set(orderIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (!unique.length) return { byOrder, pendingCountByOrderType };

  const countRows = (await manager.query(
    `SELECT order_id AS orderId, source_type AS sourceType, COUNT(*) AS cnt
     FROM inbound_pending WHERE order_id IN (${unique.map(() => '?').join(',')}) AND status = 'pending'
     GROUP BY order_id, source_type`,
    unique,
  )) as Array<{ orderId: number | string; sourceType: string; cnt: number | string }>;
  for (const c of countRows) {
    pendingCountByOrderType.set(`${Number(c.orderId)}|${c.sourceType}`, Number(c.cnt));
  }

  const finRows = (await manager.query(
    `SELECT f.order_id AS orderId,
            f.tail_inbound_quantities_by_color AS inboundByColor,
            f.defect_quantities_by_color AS defectByColor,
            f.tail_inbound_qty_row AS inboundRow,
            f.defect_quantity_row AS defectRow,
            e.color_size_headers AS headers
     FROM order_finishing f
     LEFT JOIN order_ext e ON e.order_id = f.order_id
     WHERE f.order_id IN (${unique.map(() => '?').join(',')})`,
    unique,
  )) as Array<{
    orderId: number | string;
    inboundByColor: unknown;
    defectByColor: unknown;
    inboundRow: unknown;
    defectRow: unknown;
    headers: unknown;
  }>;
  for (const f of finRows) {
    byOrder.set(Number(f.orderId), {
      headers: parseHeaders(f.headers),
      normalByColor: parseByColorList(f.inboundByColor),
      defectByColor: parseByColorList(f.defectByColor),
      normalRow: parseNumberRow(f.inboundRow),
      defectRow: parseNumberRow(f.defectRow),
    });
  }
  return { byOrder, pendingCountByOrderType };
}

/**
 * 解析待仓「当前尺码真值」：DB snapshot 优先；为空时与列表同源的尾部累计兜底。
 */
export function resolvePendingCurrentSnapshot(params: {
  dbSnapshotRaw: unknown;
  orderId: number;
  sourceType: string;
  quantity: number;
  finishingByOrder: Map<number, FinishingFallbackBundle>;
  pendingCountByOrderType: Map<string, number>;
}): { snapshot: ColorSizeSnapshot | null; source: 'db' | 'finishing-fallback' | 'none' } {
  const db = parseStoredColorSizeSnapshot(params.dbSnapshotRaw);
  if (db) return { snapshot: db, source: 'db' };
  const st = String(params.sourceType ?? 'normal');
  const count = params.pendingCountByOrderType.get(`${params.orderId}|${st}`) ?? 0;
  const fallback = buildFinishingFallbackSnapshot(
    params.finishingByOrder.get(params.orderId),
    st,
    params.quantity,
    count,
  );
  if (fallback) return { snapshot: fallback, source: 'finishing-fallback' };
  return { snapshot: null, source: 'none' };
}

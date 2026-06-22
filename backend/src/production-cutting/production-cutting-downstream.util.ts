import { Repository } from 'typeorm';
import { OrderSewing } from '../entities/order-sewing.entity';
import type { ColorSizeQuantityRow } from '../common/color-size-row.util';
import type { ActualCutRow } from '../entities/order-cutting.entity';

/**
 * 下游车缝是否已登记数量：用于编辑裁床数据前的风险判定。
 * 判定口径：存在车缝记录且（已完成 或 完成数量>0）。
 */
export async function detectSewingStarted(
  sewingRepo: Repository<OrderSewing>,
  orderId: number,
): Promise<{ sewingStarted: boolean; sewingQuantity: number }> {
  const sewing = await sewingRepo.findOne({ where: { orderId } });
  if (!sewing) return { sewingStarted: false, sewingQuantity: 0 };
  const qty = Number(sewing.sewingQuantity) || 0;
  const started = String(sewing.status ?? '').toLowerCase() === 'completed' || qty > 0;
  return { sewingStarted: started, sewingQuantity: qty };
}

export interface SewnDetail {
  started: boolean;
  sewingQuantity: number;
  /** 按颜色×尺码的已车缝数；老数据可能为空，此时仅能按合计兜底比对 */
  byColor: ColorSizeQuantityRow[];
}

/**
 * 读取车缝已登记明细（含按颜色×尺码）。sewing_quantities_by_color 为 select:false，
 * 需原生查询；列不存在或解析失败时退化为空明细。
 */
export async function getSewnDetail(
  sewingRepo: Repository<OrderSewing>,
  orderId: number,
): Promise<SewnDetail> {
  const sewing = await sewingRepo.findOne({ where: { orderId } });
  if (!sewing) return { started: false, sewingQuantity: 0, byColor: [] };
  const qty = Number(sewing.sewingQuantity) || 0;
  const started = String(sewing.status ?? '').toLowerCase() === 'completed' || qty > 0;
  let byColor: ColorSizeQuantityRow[] = [];
  try {
    const rows = await sewingRepo.query(
      'SELECT sewing_quantities_by_color AS c FROM `order_sewing` WHERE order_id = ? LIMIT 1',
      [orderId],
    );
    const raw = Array.isArray(rows) && rows[0] ? (rows[0] as { c?: unknown }).c : null;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      byColor = parsed
        .filter((r): r is { colorName?: unknown; quantities?: unknown } => !!r && typeof r === 'object')
        .map((r) => ({
          colorName: String(r.colorName ?? '').trim(),
          quantities: Array.isArray(r.quantities) ? r.quantities.map((v) => Number(v) || 0) : [],
        }));
    }
  } catch {
    byColor = [];
  }
  return { started, sewingQuantity: qty, byColor };
}

/**
 * 校验"裁床数量不得少于已车缝数量"（车缝数永不可能大于裁床数）。
 * 有按色明细则逐格比对，返回首个违规格；否则退化为按合计比对。
 * 无违规返回 null。
 */
export function findCutBelowSewn(
  headers: string[],
  newCutRows: ActualCutRow[],
  sewn: SewnDetail,
): { colorName: string; sizeLabel: string; sewnQty: number; cutQty: number } | null {
  const norm = (s: unknown) => String(s ?? '').trim();
  const cutMap = new Map<string, number[]>();
  for (const r of newCutRows) {
    const name = norm(r.colorName);
    const q = Array.isArray(r.quantities) ? r.quantities : [];
    const prev = cutMap.get(name);
    if (prev) {
      for (let i = 0; i < q.length; i++) prev[i] = (prev[i] || 0) + (Number(q[i]) || 0);
    } else {
      cutMap.set(name, q.map((v) => Number(v) || 0));
    }
  }

  if (sewn.byColor.length > 0) {
    for (const sr of sewn.byColor) {
      const name = norm(sr.colorName);
      const sq = Array.isArray(sr.quantities) ? sr.quantities : [];
      const cq = cutMap.get(name) ?? [];
      for (let i = 0; i < sq.length; i++) {
        const s = Number(sq[i]) || 0;
        const c = Number(cq[i]) || 0;
        if (s > c) {
          return { colorName: name || '-', sizeLabel: headers[i] ?? `第${i + 1}列`, sewnQty: s, cutQty: c };
        }
      }
    }
    return null;
  }

  // 兜底：无按色明细，按合计判断
  let totalCut = 0;
  cutMap.forEach((q) => q.forEach((v) => (totalCut += Number(v) || 0)));
  if (sewn.sewingQuantity > totalCut) {
    return { colorName: '', sizeLabel: '', sewnQty: sewn.sewingQuantity, cutQty: totalCut };
  }
  return null;
}

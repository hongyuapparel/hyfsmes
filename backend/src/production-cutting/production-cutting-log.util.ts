import type { ActualCutRow } from '../entities/order-cutting.entity';

export interface CuttingEditMeta {
  unitPrice: string | null;
  department: string | null;
  cutter: string | null;
}

/** 裁床登记日志：按颜色合计 */
export function buildCuttingLogDetail(rows: ActualCutRow[], label = '裁床登记'): string {
  if (!rows.length) return `${label}：已完成`;
  const segments = rows.map((row) => {
    const color = (row.colorName ?? '-').trim() || '-';
    const qtys = Array.isArray(row.quantities) ? row.quantities : [];
    const sum = qtys.reduce((acc, q) => acc + (Number.isFinite(Number(q)) ? Number(q) : 0), 0);
    return `${color} ${sum} 件`;
  });
  return `${label}：${segments.join(' / ')}`;
}

/** 裁床编辑日志：逐格新旧对照 + 关键字段变更，便于追溯"从多少改成多少" */
export function buildCuttingEditLogDetail(
  headers: string[],
  oldRows: ActualCutRow[] | null,
  newRows: ActualCutRow[],
  oldMeta: CuttingEditMeta,
  newMeta: CuttingEditMeta,
): string {
  const norm = (s: unknown) => String(s ?? '').trim();
  const sizeLabel = (i: number) => headers[i] ?? `第${i + 1}列`;
  const money = (s: string | null) => {
    const t = norm(s);
    if (t === '') return '0';
    const n = Number(t);
    return Number.isFinite(n) ? String(n) : t;
  };
  const oldMap = new Map<string, number[]>();
  for (const r of oldRows ?? []) oldMap.set(norm(r.colorName), Array.isArray(r.quantities) ? r.quantities : []);
  const segs: string[] = [];
  for (const r of newRows) {
    const key = norm(r.colorName);
    const name = key || '-';
    const nq = Array.isArray(r.quantities) ? r.quantities : [];
    const oq = oldMap.get(key) ?? [];
    const len = Math.max(nq.length, oq.length);
    for (let i = 0; i < len; i++) {
      const o = Number(oq[i]) || 0;
      const n = Number(nq[i]) || 0;
      if (o !== n) segs.push(`${name} ${sizeLabel(i)} ${o}→${n}`);
    }
  }
  for (const [key, oq] of oldMap) {
    if (newRows.some((r) => norm(r.colorName) === key)) continue;
    const sum = oq.reduce((s, v) => s + (Number(v) || 0), 0);
    if (sum > 0) segs.push(`${key || '-'} 整行删除(原合计${sum})`);
  }
  if (money(oldMeta.unitPrice) !== money(newMeta.unitPrice)) {
    segs.push(`裁剪单价 ${money(oldMeta.unitPrice)}→${money(newMeta.unitPrice)}`);
  }
  if (norm(oldMeta.department) !== norm(newMeta.department)) {
    segs.push(`裁剪部门 ${norm(oldMeta.department) || '-'}→${norm(newMeta.department) || '-'}`);
  }
  if (norm(oldMeta.cutter) !== norm(newMeta.cutter)) {
    segs.push(`裁剪人 ${norm(oldMeta.cutter) || '-'}→${norm(newMeta.cutter) || '-'}`);
  }
  if (segs.length === 0) return '裁床数据编辑：无字段变化';
  return `裁床数据编辑：${segs.join('；')}`;
}

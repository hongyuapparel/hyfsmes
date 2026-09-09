import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { PatternMaterialRow } from './production-pattern.service';

/** 完全空白的占位行不参与完成检查；已填写的行必须有名称和实际用量。 */
export function validatePatternMaterials(materials: PatternMaterialRow[] | null | undefined): void {
  const active = (materials ?? []).map((row, index) => ({ row, index })).filter(({ row }) =>
    row.materialTypeId != null || row.usagePerPiece != null || row.cuttingQuantity != null ||
    [row.materialName, row.fabricWidth, row.remark].some((value) => String(value ?? '').trim()),
  );
  if (!active.length) throw new BadRequestException('请先填写并保存至少一条物料及单件用量');
  const errors: string[] = [];
  for (const { row, index } of active) {
    const missing: string[] = [];
    if (!String(row.materialName ?? '').trim()) missing.push('物料名称');
    if (row.usagePerPiece == null || !Number.isFinite(Number(row.usagePerPiece)) || Number(row.usagePerPiece) <= 0) {
      missing.push('大于 0 的单件用量');
    }
    if (missing.length) errors.push(`第 ${index + 1} 行请填写${missing.join('、')}`);
  }
  if (errors.length) throw new BadRequestException(errors.join('；'));
}

/** 对已保存的内容生成版本标识，不受 MySQL JSON 属性排序影响。 */
export function patternMaterialsVersion(materials: unknown, remark: string | null | undefined): string {
  const rows = Array.isArray(materials) ? materials.map(row => Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)))) : null;
  return createHash('sha256').update(JSON.stringify([rows, remark || null])).digest('hex');
}

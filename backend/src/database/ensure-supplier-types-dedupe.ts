import { DataSource } from 'typeorm';

/**
 * 合并 system_options 表里 option_type='supplier_types' 的重复条目，并把
 * 引用方（suppliers.business_scope_id 单值 + business_scope_ids JSON 数组）
 * 的外键迁到保留的最小 id 上。
 *
 * 起因：多次「同步 / 导入」按钮往 加工供应商 下塞了 A/B/C/D/E 加工方式各 3-4 份，
 * 同一 (parent_id, value) 出现多条记录，导致下拉里同一项重复出现。
 *
 * 处理：
 *   1. 按 (parent_id, value) 聚合 COUNT>1 的组
 *   2. 保留最小 id（keep_id），其余 id 视为重复
 *   3. UPDATE suppliers.business_scope_id：dup_id → keep_id
 *   4. UPDATE suppliers.business_scope_ids（JSON 数组）：map 替换 + 去重
 *   5. DELETE 多余的 system_options 行
 *
 * 幂等：跑完后 SELECT 不再返回任何重复组；下次启动空跑。
 *
 * 注：必须在 ensureSupplierTypesMaxDepth 之后调用，避免把已经标记成 level>=3
 * 即将被深度 ensure 删掉的节点的 keep_id 当成正常项保留。
 */
export async function ensureSupplierTypesDedupe(dataSource: DataSource): Promise<void> {
  // 注意：阿里云 RDS MySQL 8 默认开 ONLY_FULL_GROUP_BY 严格模式，
  // SELECT 里出现的非聚合列必须严格等于 GROUP BY 里的列（包括函数包装）。
  // 直接 GROUP BY parent_id，NULL 本身就会被聚成同一组，不需要 COALESCE 兜底。
  const groups: Array<{ parent_id: number | null; value: string; ids: string; keep_id: number }> =
    await dataSource.query(`
      SELECT
        parent_id,
        value,
        GROUP_CONCAT(id ORDER BY id) AS ids,
        MIN(id) AS keep_id
      FROM system_options
      WHERE option_type = 'supplier_types'
      GROUP BY parent_id, value
      HAVING COUNT(*) > 1
    `);

  if (!groups.length) return;

  const idMap = new Map<number, number>();
  const allDupIds: number[] = [];
  for (const g of groups) {
    const ids = String(g.ids)
      .split(',')
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));
    const keep = Number(g.keep_id);
    for (const id of ids) {
      if (id !== keep) {
        idMap.set(id, keep);
        allDupIds.push(id);
      }
    }
  }

  if (!idMap.size) return;

  for (const [dup, keep] of idMap) {
    await dataSource.query(
      `UPDATE suppliers SET business_scope_id = ? WHERE business_scope_id = ?`,
      [keep, dup],
    );
  }

  const suppliers: Array<{ id: number; business_scope_ids: string | null }> =
    await dataSource.query(
      `SELECT id, business_scope_ids
       FROM suppliers
       WHERE business_scope_ids IS NOT NULL AND business_scope_ids <> ''`,
    );
  for (const s of suppliers) {
    const raw = s.business_scope_ids;
    if (!raw) continue;
    let arr: number[];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      arr = parsed.map((v) => Number(v)).filter((n) => Number.isFinite(n));
    } catch {
      continue;
    }
    const mapped = arr.map((id) => idMap.get(id) ?? id);
    const deduped: number[] = [];
    const seen = new Set<number>();
    for (const id of mapped) {
      if (seen.has(id)) continue;
      seen.add(id);
      deduped.push(id);
    }
    const changed =
      deduped.length !== arr.length || deduped.some((v, i) => v !== arr[i]);
    if (changed) {
      await dataSource.query(`UPDATE suppliers SET business_scope_ids = ? WHERE id = ?`, [
        JSON.stringify(deduped),
        s.id,
      ]);
    }
  }

  await dataSource.query(
    `DELETE FROM system_options WHERE id IN (${allDupIds.map(() => '?').join(',')})`,
    allDupIds,
  );

  console.log(
    `[Ensure] supplier_types 重复条目已合并：删除 ${allDupIds.length} 个重复 id，合并组：${groups
      .map((g) => `"${g.value}" keep=${g.keep_id} 原 ids=[${g.ids}]`)
      .join('、')}`,
  );
}

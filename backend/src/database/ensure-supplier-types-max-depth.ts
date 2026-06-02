import { DataSource } from 'typeorm';

/**
 * 清理 system_options 表里 option_type='supplier_types' 的层级越界数据。
 *
 * 业务约定：supplier_types 只允许 3 层（root 供应商类型 / 业务范围父分组 / 业务范围子分组）。
 * 即任何节点的 parent 要么是 NULL（root），要么 parent.parent 必须是 NULL。
 *
 * 历史 / 异常写入可能产生第 4 层及更深的节点（例：直喷 parent=普洗 parent=洗水 parent=工艺供应商），
 * 这种节点在「供应商设置」表格里因为前缀都用 `└` 看着像同级，但在订单编辑的 tree-select 下拉里会按真实层级嵌一层，
 * 造成两边显示不一致。这里在启动时一次性把这种越界节点连同它们的整棵子树删除。
 */
export async function ensureSupplierTypesMaxDepth(dataSource: DataSource): Promise<void> {
  // 找出所有 type='supplier_types' 且 parent 自身有 parent 的节点（深度 >= 3，按 root=0 起算 >= level 3）
  const violating: Array<{ id: number; value: string; parent_id: number; grandparent_id: number }> =
    await dataSource.query(`
      SELECT child.id, child.value, child.parent_id, parent.parent_id AS grandparent_id
      FROM system_options child
      INNER JOIN system_options parent ON parent.id = child.parent_id
      WHERE child.option_type = 'supplier_types'
        AND parent.parent_id IS NOT NULL
    `);

  if (!violating.length) return;

  // 递归收集每个越界节点的整棵子树 id 集合（含自己），统一删除
  const allIdsToDelete = new Set<number>();
  for (const row of violating) {
    const queue: number[] = [row.id];
    while (queue.length) {
      const cur = queue.shift()!;
      if (allIdsToDelete.has(cur)) continue;
      allIdsToDelete.add(cur);
      const children: Array<{ id: number }> = await dataSource.query(
        `SELECT id FROM system_options WHERE option_type = 'supplier_types' AND parent_id = ?`,
        [cur],
      );
      for (const c of children) queue.push(c.id);
    }
  }

  if (!allIdsToDelete.size) return;

  const ids = [...allIdsToDelete];
  await dataSource.query(
    `DELETE FROM system_options WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
  console.log(
    `[Ensure] supplier_types 越界层级已清理：删除 ${ids.length} 个节点（含子树），id=${ids.join(',')}；越界源记录：${violating
      .map((r) => `${r.value}#${r.id}(parent=${r.parent_id})`)
      .join('、')}`,
  );
}

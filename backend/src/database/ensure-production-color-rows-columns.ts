import { DataSource } from 'typeorm';

/**
 * 确保生产环节颜色×尺码二维列存在：
 *   - order_sewing.sewing_quantities_by_color
 *   - order_finishing.tail_received_quantities_by_color
 *   - order_finishing.tail_inbound_quantities_by_color
 *   - order_finishing.defect_quantities_by_color
 *   - inbound_pending.color_size_snapshot
 *
 * 项目未启用 TypeORM migrations，且 synchronize 行为对 JSON + select=false 字段
 * 偶尔不稳定（曾经把这些列悄悄抹掉过）。此函数在启动阶段幂等地补回所有缺失列，
 * 保证"做好的功能不会被自动同步弄丢"。
 */
export async function ensureProductionColorRowsColumns(dataSource: DataSource): Promise<void> {
  const checks: Array<{ table: string; column: string; ddl: string }> = [
    {
      table: 'order_sewing',
      column: 'sewing_quantities_by_color',
      ddl: "ALTER TABLE `order_sewing` ADD COLUMN `sewing_quantities_by_color` JSON NULL COMMENT '车缝数量按颜色×尺码 [{colorName,quantities[]}]' AFTER `sewing_quantity_row`",
    },
    {
      table: 'order_finishing',
      column: 'tail_received_quantities_by_color',
      ddl: "ALTER TABLE `order_finishing` ADD COLUMN `tail_received_quantities_by_color` JSON NULL COMMENT '尾部收货按颜色×尺码' AFTER `tail_received_qty_row`",
    },
    {
      table: 'order_finishing',
      column: 'tail_inbound_quantities_by_color',
      ddl: "ALTER TABLE `order_finishing` ADD COLUMN `tail_inbound_quantities_by_color` JSON NULL COMMENT '尾部入库按颜色×尺码' AFTER `tail_inbound_qty_row`",
    },
    {
      table: 'order_finishing',
      column: 'defect_quantities_by_color',
      ddl: "ALTER TABLE `order_finishing` ADD COLUMN `defect_quantities_by_color` JSON NULL COMMENT '次品按颜色×尺码' AFTER `defect_quantity_row`",
    },
    {
      table: 'inbound_pending',
      column: 'color_size_snapshot',
      ddl: "ALTER TABLE `inbound_pending` ADD COLUMN `color_size_snapshot` JSON NULL COMMENT '本批入库的颜色×尺码 snapshot {headers,rows}' AFTER `quantity`",
    },
  ];

  // 一次性查询当前所有相关表的现有列
  const tables = Array.from(new Set(checks.map((c) => c.table)));
  const tableList = tables.map((t) => `'${t}'`).join(',');
  const rows = (await dataSource.query(`
    SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${tableList})
  `)) as Array<{ TABLE_NAME: string; COLUMN_NAME: string }>;

  const existing = new Set(rows.map((r) => `${r.TABLE_NAME}.${r.COLUMN_NAME}`));
  for (const c of checks) {
    const key = `${c.table}.${c.column}`;
    if (existing.has(key)) continue;
    try {
      await dataSource.query(c.ddl);
      console.log(`[Ensure] ${key} added.`);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === 'ER_DUP_FIELDNAME') continue;
      console.error(`[Ensure] add ${key} failed:`, e?.message ?? err);
      throw err;
    }
  }
}

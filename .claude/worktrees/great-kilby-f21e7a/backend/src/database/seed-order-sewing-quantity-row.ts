import { DataSource } from 'typeorm';

/**
 * 确保 order_sewing 表存在 sewing_quantity_row 列（按尺码车缝数量 JSON）。
 */
export async function seedOrderSewingQuantityRow(dataSource: DataSource): Promise<void> {
  let dbName = (dataSource.options as { database?: string }).database;
  if (!dbName) {
    const rows = await dataSource.query<{ db: string }[]>('SELECT DATABASE() AS db');
    dbName = rows?.[0]?.db;
  }
  if (!dbName) return;

  const rows = await dataSource.query<{ cnt: number }[]>(
    `SELECT COUNT(1) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'order_sewing' AND COLUMN_NAME = 'sewing_quantity_row'`,
    [dbName],
  );
  const hasColumn = (rows?.[0]?.cnt ?? 0) > 0;
  if (hasColumn) return;

  await dataSource.query(`
    ALTER TABLE order_sewing ADD COLUMN sewing_quantity_row JSON NULL AFTER defect_reason
  `);
  console.log('[Seed] order_sewing.sewing_quantity_row column added.');
}

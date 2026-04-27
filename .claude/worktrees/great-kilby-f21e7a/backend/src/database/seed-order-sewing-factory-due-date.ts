import { DataSource } from 'typeorm';

/**
 * 确保 order_sewing 表存在 factory_due_date 列（与 OrderSewing 实体一致）。
 * 缺列会导致订单列表等接口查询 order_sewing 时报 Unknown column，前端显示「无法连接服务器」。
 */
export async function seedOrderSewingFactoryDueDate(dataSource: DataSource): Promise<void> {
  let dbName = (dataSource.options as { database?: string }).database;
  if (!dbName) {
    const rows = await dataSource.query<{ db: string }[]>('SELECT DATABASE() AS db');
    dbName = rows?.[0]?.db;
  }
  if (!dbName) return;

  const rows = await dataSource.query<{ cnt: number }[]>(
    `SELECT COUNT(1) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'order_sewing' AND COLUMN_NAME = 'factory_due_date'`,
    [dbName],
  );
  const hasColumn = (rows?.[0]?.cnt ?? 0) > 0;
  if (hasColumn) return;

  await dataSource.query(`
    ALTER TABLE order_sewing ADD COLUMN factory_due_date DATE NULL AFTER distributed_at
  `);
  console.log('[Seed] order_sewing.factory_due_date column added.');
}

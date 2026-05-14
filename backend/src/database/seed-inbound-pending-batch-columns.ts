import { DataSource } from 'typeorm';

/**
 * 确保 inbound_pending 存在 operator_username / batch_no 列，用于尾部分批登记的操作人留痕与批次序号展示。
 */
export async function seedInboundPendingBatchColumns(dataSource: DataSource): Promise<void> {
  let dbName = (dataSource.options as { database?: string }).database;
  if (!dbName) {
    const rows = await dataSource.query<{ db: string }[]>('SELECT DATABASE() AS db');
    dbName = rows?.[0]?.db;
  }
  if (!dbName) return;

  const hasColumn = async (col: string): Promise<boolean> => {
    const rows = await dataSource.query<{ cnt: number }[]>(
      `SELECT COUNT(1) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'inbound_pending' AND COLUMN_NAME = ?`,
      [dbName, col],
    );
    return (rows?.[0]?.cnt ?? 0) > 0;
  };

  if (!(await hasColumn('operator_username'))) {
    await dataSource.query(
      `ALTER TABLE inbound_pending ADD COLUMN operator_username VARCHAR(128) NOT NULL DEFAULT ''`,
    );
    console.log('[Seed] inbound_pending.operator_username column added.');
  }
  if (!(await hasColumn('batch_no'))) {
    await dataSource.query(`ALTER TABLE inbound_pending ADD COLUMN batch_no INT NULL`);
    console.log('[Seed] inbound_pending.batch_no column added.');
  }
}

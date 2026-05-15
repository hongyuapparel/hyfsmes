import { DataSource } from 'typeorm';

/**
 * 给 order_operation_logs 增加 target_type / target_ref 可空列。
 * 说明：项目当前未启用 migrations，生产环境可能关闭 synchronize，因此在启动阶段确保列存在。
 */
export async function ensureOrderOperationLogTargetColumns(dataSource: DataSource): Promise<void> {
  const cols = await dataSource.query(`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_operation_logs'
      AND COLUMN_NAME IN ('target_type', 'target_ref')
  `);
  const existing = new Set((cols as Array<{ COLUMN_NAME: string }>).map((r) => r.COLUMN_NAME));
  if (!existing.has('target_type')) {
    await dataSource.query(`ALTER TABLE order_operation_logs ADD COLUMN target_type VARCHAR(32) NULL`);
    console.log('[Ensure] order_operation_logs.target_type added.');
  }
  if (!existing.has('target_ref')) {
    await dataSource.query(`ALTER TABLE order_operation_logs ADD COLUMN target_ref VARCHAR(64) NULL`);
    console.log('[Ensure] order_operation_logs.target_ref added.');
  }
}

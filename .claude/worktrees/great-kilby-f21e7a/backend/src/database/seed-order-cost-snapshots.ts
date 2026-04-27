import { DataSource } from 'typeorm';

/**
 * 初始化订单成本快照表（缺表会导致成本页 GET/PUT /orders/:id/cost 报错）
 * 说明：项目当前未启用 migrations，且生产环境可能关闭 synchronize，因此在 seed 阶段确保表存在。
 */
export async function seedOrderCostSnapshotsTable(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS order_cost_snapshots (
      id INT NOT NULL AUTO_INCREMENT,
      order_id INT NOT NULL,
      snapshot JSON NULL,
      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      UNIQUE KEY uk_order_cost_snapshots_order_id (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  console.log('[Seed] order_cost_snapshots table ensured.');
}


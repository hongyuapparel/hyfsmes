import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as express from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { seedPermissions } from './database/seed-permissions';
import { seedAdmin } from './database/seed-admin';
import { seedFieldDefinitions } from './database/seed-field-definitions';
import { seedOrderCostSnapshotsTable } from './database/seed-order-cost-snapshots';
import { seedOrderSewingFactoryDueDate } from './database/seed-order-sewing-factory-due-date';
import { seedOrderSewingQuantityRow } from './database/seed-order-sewing-quantity-row';
import { seedInboundPendingBatchColumns } from './database/seed-inbound-pending-batch-columns';
import { ensureOrderOperationLogTargetColumns } from './database/ensure-order-operation-log-target-columns';
import { ensureProductionColorRowsColumns } from './database/ensure-production-color-rows-columns';
import { ensureEmployeeRostersTables } from './database/ensure-employee-rosters-tables';
import { ensureSupplierTypesMaxDepth } from './database/ensure-supplier-types-max-depth';
import { ensureSupplierTypesDedupe } from './database/ensure-supplier-types-dedupe';
import { reconcileEmployeeDeptJobIds } from './database/reconcile-employee-dept-job-ids';
import { seedOrgDictionary } from './database/seed-org-dictionary';
import { cleanupDirtyOrgDictionary } from './database/cleanup-dirty-org-dictionary';
// HrService 仅在重新启用启动自动导入钩子时需要（见下方注释）
// import { HrService } from './hr/hr.service';

async function ensureSupplierMultiScopeColumn(dataSource: DataSource) {
  const rows: Array<{ cnt: number }> = await dataSource.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'suppliers'
       AND COLUMN_NAME = 'business_scope_ids'`,
  );
  const cnt = Number(rows?.[0]?.cnt ?? 0);
  if (cnt > 0) return;
  await dataSource.query(
    `ALTER TABLE suppliers
     ADD COLUMN business_scope_ids LONGTEXT NULL AFTER business_scope_id`,
  );
  console.log('[Schema] Added suppliers.business_scope_ids');
}

async function ensureSupplierLastActiveColumn(dataSource: DataSource) {
  const rows: Array<{ cnt: number }> = await dataSource.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'suppliers'
       AND COLUMN_NAME = 'last_active_at'`,
  );
  const cnt = Number(rows?.[0]?.cnt ?? 0);
  if (cnt > 0) return;
  await dataSource.query(
    `ALTER TABLE suppliers
     ADD COLUMN last_active_at DATETIME NULL AFTER business_scope_ids`,
  );
  console.log('[Schema] Added suppliers.last_active_at');
}

async function ensureUserLastActiveColumn(dataSource: DataSource) {
  const rows: Array<{ cnt: number }> = await dataSource.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'users'
       AND COLUMN_NAME = 'last_active_at'`,
  );
  const cnt = Number(rows?.[0]?.cnt ?? 0);
  if (cnt > 0) return;
  await dataSource.query(
    `ALTER TABLE users
     ADD COLUMN last_active_at DATETIME NULL AFTER last_login_at`,
  );
  console.log('[Schema] Added users.last_active_at');
}

async function ensureUserLoginLockoutColumns(dataSource: DataSource) {
  const cols: Array<{ name: string; ddl: string }> = [
    { name: 'failed_login_count', ddl: 'INT NOT NULL DEFAULT 0 AFTER last_active_at' },
    { name: 'locked_until', ddl: 'DATETIME NULL AFTER failed_login_count' },
  ];
  for (const col of cols) {
    const rows: Array<{ cnt: number }> = await dataSource.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME = ?`,
      [col.name],
    );
    if (Number(rows?.[0]?.cnt ?? 0) > 0) continue;
    await dataSource.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.ddl}`);
    console.log(`[Schema] Added users.${col.name}`);
  }
}

async function dropSupplierCooperationDateColumn(dataSource: DataSource) {
  const rows: Array<{ cnt: number }> = await dataSource.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'suppliers'
       AND COLUMN_NAME = 'cooperation_date'`,
  );
  const cnt = Number(rows?.[0]?.cnt ?? 0);
  if (cnt <= 0) return;
  await dataSource.query(`ALTER TABLE suppliers DROP COLUMN cooperation_date`);
  console.log('[Schema] Dropped suppliers.cooperation_date');
}

async function ensureSupplierRemarkColumn(dataSource: DataSource) {
  const rows: Array<{ cnt: number }> = await dataSource.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'suppliers'
       AND COLUMN_NAME = 'remark'`,
  );
  const cnt = Number(rows?.[0]?.cnt ?? 0);
  if (cnt > 0) return;
  await dataSource.query(
    `ALTER TABLE suppliers
     ADD COLUMN remark VARCHAR(500) NOT NULL DEFAULT '' AFTER settlement_time`,
  );
  console.log('[Schema] Added suppliers.remark');
}

/**
 * 确保 order_finishing 三个尺码明细列存在。
 * 这些列存的是「尾部登记入库时按尺码分配的数量」，是反推成品库存尺码分布
 * 的最权威数据源。缺列会导致前端填的尺码 silently 丢失，反推时只能按订单
 * 计划比例（不准），引发 XXL=27 vs 实际 55 这类 bug。
 */
async function ensureOrderFinishingQtyRowColumns(dataSource: DataSource) {
  const cols: Array<{ name: string; ddl: string }> = [
    { name: 'tail_received_qty_row', ddl: 'JSON NULL AFTER tail_received_qty' },
    { name: 'tail_inbound_qty_row', ddl: 'JSON NULL AFTER tail_inbound_qty' },
    { name: 'defect_quantity_row', ddl: 'JSON NULL AFTER defect_quantity' },
  ];
  for (const col of cols) {
    const rows: Array<{ cnt: number }> = await dataSource.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'order_finishing'
         AND COLUMN_NAME = ?`,
      [col.name],
    );
    if (Number(rows?.[0]?.cnt ?? 0) > 0) continue;
    await dataSource.query(`ALTER TABLE order_finishing ADD COLUMN ${col.name} ${col.ddl}`);
    console.log(`[Schema] Added order_finishing.${col.name}`);
  }
}

async function ensureInventoryOperationLogTables(dataSource: DataSource) {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS inventory_accessory_operation_log (
      id INT NOT NULL AUTO_INCREMENT,
      accessory_id INT NOT NULL,
      operator_username VARCHAR(128) NOT NULL DEFAULT '',
      action VARCHAR(32) NOT NULL DEFAULT '',
      before_snapshot JSON NULL,
      after_snapshot JSON NULL,
      remark VARCHAR(500) NOT NULL DEFAULT '',
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      INDEX IDX_inventory_accessory_operation_log_accessory_id (accessory_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS fabric_stock_operation_log (
      id INT NOT NULL AUTO_INCREMENT,
      fabric_stock_id INT NOT NULL,
      operator_username VARCHAR(128) NOT NULL DEFAULT '',
      action VARCHAR(32) NOT NULL DEFAULT '',
      before_snapshot JSON NULL,
      after_snapshot JSON NULL,
      remark VARCHAR(500) NOT NULL DEFAULT '',
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY (id),
      INDEX IDX_fabric_stock_operation_log_fabric_stock_id (fabric_stock_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[Schema] Ensured inventory operation log tables');
}

async function ensureInventoryAccessorySizedColumns(dataSource: DataSource) {
  const accessoryCols: Array<{ name: string; ddl: string }> = [
    { name: 'is_sized', ddl: 'TINYINT(1) NOT NULL DEFAULT 0 AFTER quantity' },
    { name: 'size_headers', ddl: 'JSON NULL AFTER is_sized' },
    { name: 'size_quantities', ddl: 'JSON NULL AFTER size_headers' },
  ];
  for (const col of accessoryCols) {
    const rows: Array<{ cnt: number }> = await dataSource.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'inventory_accessory'
         AND COLUMN_NAME = ?`,
      [col.name],
    );
    if (Number(rows?.[0]?.cnt ?? 0) > 0) continue;
    await dataSource.query(`ALTER TABLE inventory_accessory ADD COLUMN ${col.name} ${col.ddl}`);
    console.log(`[Schema] Added inventory_accessory.${col.name}`);
  }

  const outboundRows: Array<{ cnt: number }> = await dataSource.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'inventory_accessory_outbound'
       AND COLUMN_NAME = 'size_outbound'`,
  );
  if (Number(outboundRows?.[0]?.cnt ?? 0) <= 0) {
    await dataSource.query(
      `ALTER TABLE inventory_accessory_outbound ADD COLUMN size_outbound JSON NULL AFTER quantity`,
    );
    console.log('[Schema] Added inventory_accessory_outbound.size_outbound');
  }
}

async function ensureOrderSoftDeleteColumns(dataSource: DataSource) {
  const columns: Array<{ name: string; ddl: string }> = [
    { name: 'deleted_at', ddl: 'DATETIME NULL AFTER image_url' },
    { name: 'deleted_by', ddl: 'VARCHAR(64) NULL AFTER deleted_at' },
    { name: 'delete_reason', ddl: 'VARCHAR(255) NULL AFTER deleted_by' },
  ];
  for (const column of columns) {
    const rows: Array<{ cnt: number }> = await dataSource.query(
      `SELECT COUNT(*) AS cnt
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'orders'
         AND COLUMN_NAME = ?`,
      [column.name],
    );
    if (Number(rows?.[0]?.cnt ?? 0) > 0) continue;
    await dataSource.query(`ALTER TABLE orders ADD COLUMN ${column.name} ${column.ddl}`);
    console.log(`[Schema] Added orders.${column.name}`);
  }

  const indexRows: Array<{ cnt: number }> = await dataSource.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'orders'
       AND INDEX_NAME = 'IDX_orders_deleted_at'`,
  );
  if (Number(indexRows?.[0]?.cnt ?? 0) <= 0) {
    await dataSource.query('CREATE INDEX IDX_orders_deleted_at ON orders (deleted_at)');
    console.log('[Schema] Added index IDX_orders_deleted_at');
  }
}

async function ensureOrderExtRevisionNotesColumn(dataSource: DataSource) {
  const rows: Array<{ cnt: number }> = await dataSource.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'order_ext'
       AND COLUMN_NAME = 'revision_notes'`,
  );
  if (Number(rows?.[0]?.cnt ?? 0) > 0) return;
  await dataSource.query(
    `ALTER TABLE order_ext
     ADD COLUMN revision_notes TEXT NULL AFTER process_items`,
  );
  console.log('[Schema] Added order_ext.revision_notes');
}

async function ensurePackingListTables(dataSource: DataSource) {
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS packing_lists (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(32) NOT NULL DEFAULT '',
      customer_id INT NULL,
      customer_name VARCHAR(255) NOT NULL DEFAULT '',
      service_manager VARCHAR(128) NOT NULL DEFAULT '',
      po_no VARCHAR(255) NOT NULL DEFAULT '',
      xiaoman_order_no VARCHAR(64) NOT NULL DEFAULT '',
      pack_date DATE NULL,
      remark VARCHAR(1000) NOT NULL DEFAULT '',
      show_company TINYINT NOT NULL DEFAULT 1,
      size_headers JSON NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'draft',
      shipped_at DATETIME NULL,
      operator_username VARCHAR(255) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_packing_lists_status (status),
      KEY idx_packing_lists_customer_name (customer_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS packing_list_boxes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      packing_list_id INT NOT NULL,
      box_seq INT NOT NULL,
      weight_kg DECIMAL(10,2) NULL,
      carton_size VARCHAR(64) NOT NULL DEFAULT '',
      remark VARCHAR(255) NOT NULL DEFAULT '',
      KEY idx_plb_list (packing_list_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS packing_list_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      packing_list_id INT NOT NULL,
      box_id INT NOT NULL,
      style_no VARCHAR(128) NOT NULL DEFAULT '',
      style_name VARCHAR(255) NOT NULL DEFAULT '',
      color_name VARCHAR(128) NOT NULL DEFAULT '',
      image_url VARCHAR(512) NOT NULL DEFAULT '',
      size_quantities JSON NULL,
      total_qty INT NOT NULL DEFAULT 0,
      source_type VARCHAR(16) NOT NULL DEFAULT 'manual',
      source_id INT NULL,
      KEY idx_pli_list (packing_list_id),
      KEY idx_pli_box (box_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // packing_lists.code 唯一索引（并发/异常下重复单号的最终防线）。幂等：已存在则跳过；
  // 若老表存在重复单号导致加索引失败，仅告警不中断启动（服务端已用 MAX+1 生成避免撞号）。
  const codeIndexRows: Array<{ cnt: number }> = await dataSource.query(`
    SELECT COUNT(*) AS cnt FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'packing_lists' AND index_name = 'uniq_packing_lists_code'
  `);
  if (Number(codeIndexRows?.[0]?.cnt) === 0) {
    try {
      await dataSource.query('ALTER TABLE packing_lists ADD UNIQUE INDEX uniq_packing_lists_code (code)');
    } catch (e) {
      console.warn('[Schema] 跳过 packing_lists.code 唯一索引（可能存在重复单号）：', (e as Error).message);
    }
  }

  // 老表补 xiaoman_order_no 列（小满单号，业务员手填供财务审核）
  const xiaomanColRows: Array<{ cnt: number }> = await dataSource.query(`
    SELECT COUNT(*) AS cnt FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'packing_lists' AND column_name = 'xiaoman_order_no'
  `);
  if (Number(xiaomanColRows?.[0]?.cnt) === 0) {
    await dataSource.query(`ALTER TABLE packing_lists ADD COLUMN xiaoman_order_no VARCHAR(64) NOT NULL DEFAULT '' AFTER po_no`);
  }

  console.log('[Schema] Ensured packing list tables');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors();

  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  const uploadStaticOptions = {
    maxAge: '30d',
    immutable: true,
  };

  // Support both direct `/uploads/*` access and proxied `/api/uploads/*` access.
  app.use('/uploads', express.static(uploadsDir, uploadStaticOptions));
  app.use('/api/uploads', express.static(uploadsDir, uploadStaticOptions));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');

  const dataSource = app.get(DataSource);
  try {
    await ensureSupplierMultiScopeColumn(dataSource);
    await ensureSupplierLastActiveColumn(dataSource);
    await ensureUserLastActiveColumn(dataSource);
    await ensureUserLoginLockoutColumns(dataSource);
    await dropSupplierCooperationDateColumn(dataSource);
    await ensureSupplierRemarkColumn(dataSource);
    await ensureInventoryOperationLogTables(dataSource);
    await ensureOrderOperationLogTargetColumns(dataSource);
    await ensureOrderFinishingQtyRowColumns(dataSource);
    await ensureProductionColorRowsColumns(dataSource);
    await ensureEmployeeRostersTables(dataSource);
    await ensureInventoryAccessorySizedColumns(dataSource);
    await ensureOrderSoftDeleteColumns(dataSource);
    await ensureOrderExtRevisionNotesColumn(dataSource);
    await ensurePackingListTables(dataSource);
    await ensureSupplierTypesMaxDepth(dataSource);
    await ensureSupplierTypesDedupe(dataSource);
    await seedPermissions(dataSource);
    await seedAdmin(dataSource);
    await seedFieldDefinitions(dataSource);
    await seedOrderCostSnapshotsTable(dataSource);
    await seedOrderSewingFactoryDueDate(dataSource);
    await seedOrderSewingQuantityRow(dataSource);
    await seedInboundPendingBatchColumns(dataSource);
    await seedOrgDictionary(dataSource);
    await reconcileEmployeeDeptJobIds(dataSource);
    await cleanupDirtyOrgDictionary(dataSource);
  } catch (err) {
    console.error('[Seed] Failed:', err);
  }

  // 启动自动导入花名册：已禁用。
  // 历史花名册（689 人）已经一次性导入完成，之后日常增删改走系统 UI。
  // 如需重新批量导入，可手动调用 POST /hr/import-rosters，或在此处放开钩子。
  // try {
  //   const hrService = app.get(HrService);
  //   await hrService.importRostersIfNeeded();
  // } catch (err) {
  //   console.error('[ImportRosters] startup auto import failed:', err);
  // }

  console.log(`Backend running at http://localhost:${port}`);
}

bootstrap();

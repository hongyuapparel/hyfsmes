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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors();

  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

  // Support both direct `/uploads/*` access and proxied `/api/uploads/*` access.
  app.use('/uploads', express.static(uploadsDir));
  app.use('/api/uploads', express.static(uploadsDir));

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
    await dropSupplierCooperationDateColumn(dataSource);
    await ensureSupplierRemarkColumn(dataSource);
    await seedPermissions(dataSource);
    await seedAdmin(dataSource);
    await seedFieldDefinitions(dataSource);
    await seedOrderCostSnapshotsTable(dataSource);
    await seedOrderSewingFactoryDueDate(dataSource);
    await seedOrderSewingQuantityRow(dataSource);
  } catch (err) {
    console.error('[Seed] Failed:', err);
  }

  console.log(`Backend running at http://localhost:${port}`);
}

bootstrap();

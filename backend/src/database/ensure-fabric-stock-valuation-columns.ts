import { DataSource } from 'typeorm';

type ColumnRow = { TABLE_NAME: string; COLUMN_NAME: string };

const COLUMN_SQL: Array<{ table: string; column: string; sql: string }> = [
  {
    table: 'fabric_stock',
    column: 'unit_price',
    sql: 'ALTER TABLE fabric_stock ADD COLUMN unit_price DECIMAL(14,4) NULL COMMENT \'实际入库成本单价；NULL表示未计价\' AFTER quantity',
  },
  {
    table: 'fabric_outbound',
    column: 'name_snapshot',
    sql: 'ALTER TABLE fabric_outbound ADD COLUMN name_snapshot VARCHAR(128) NULL AFTER fabric_stock_id',
  },
  {
    table: 'fabric_outbound',
    column: 'customer_name_snapshot',
    sql: 'ALTER TABLE fabric_outbound ADD COLUMN customer_name_snapshot VARCHAR(255) NULL AFTER name_snapshot',
  },
  {
    table: 'fabric_outbound',
    column: 'unit_snapshot',
    sql: 'ALTER TABLE fabric_outbound ADD COLUMN unit_snapshot VARCHAR(32) NULL AFTER customer_name_snapshot',
  },
  {
    table: 'fabric_outbound',
    column: 'inventory_type_id',
    sql: 'ALTER TABLE fabric_outbound ADD COLUMN inventory_type_id INT NULL AFTER unit_snapshot',
  },
  {
    table: 'fabric_outbound',
    column: 'inventory_type_label',
    sql: 'ALTER TABLE fabric_outbound ADD COLUMN inventory_type_label VARCHAR(255) NULL AFTER inventory_type_id',
  },
  {
    table: 'fabric_outbound',
    column: 'unit_price',
    sql: 'ALTER TABLE fabric_outbound ADD COLUMN unit_price DECIMAL(14,4) NULL AFTER quantity',
  },
  {
    table: 'fabric_outbound',
    column: 'amount',
    sql: 'ALTER TABLE fabric_outbound ADD COLUMN amount DECIMAL(16,2) NULL AFTER unit_price',
  },
];

export async function ensureFabricStockValuationColumns(dataSource: DataSource): Promise<void> {
  const rows = await dataSource.query(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('fabric_stock', 'fabric_outbound')
  `) as ColumnRow[];
  const existing = new Set(rows.map((row) => `${row.TABLE_NAME}.${row.COLUMN_NAME}`));
  for (const definition of COLUMN_SQL) {
    if (existing.has(`${definition.table}.${definition.column}`)) continue;
    await dataSource.query(definition.sql);
    console.log(`[Ensure] ${definition.table}.${definition.column} added.`);
  }
}

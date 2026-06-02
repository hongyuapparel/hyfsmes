import { DataSource } from 'typeorm';

/**
 * 确保员工花名册导入相关的表结构存在：
 *   - employees 增加 birth_year / birth_month / birth_day 列
 *   - employee_history 表（入职履历）
 *   - employee_yearly_record 表（年度记录：春节回家/放假/上班/备注）
 *
 * 幂等：启动时执行，已存在则跳过。
 */
export async function ensureEmployeeRostersTables(dataSource: DataSource): Promise<void> {
  const employeeColumns: Array<{ column: string; ddl: string }> = [
    {
      column: 'birth_year',
      ddl: "ALTER TABLE `employees` ADD COLUMN `birth_year` SMALLINT NULL COMMENT '生日年（身份证解析）' AFTER `status`",
    },
    {
      column: 'birth_month',
      ddl: "ALTER TABLE `employees` ADD COLUMN `birth_month` TINYINT NULL COMMENT '生日月 1-12' AFTER `birth_year`",
    },
    {
      column: 'birth_day',
      ddl: "ALTER TABLE `employees` ADD COLUMN `birth_day` TINYINT NULL COMMENT '生日日 1-31' AFTER `birth_month`",
    },
  ];

  const existingCols = (await dataSource.query(`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees'
  `)) as Array<{ COLUMN_NAME: string }>;
  const has = new Set(existingCols.map((r) => r.COLUMN_NAME));
  for (const c of employeeColumns) {
    if (has.has(c.column)) continue;
    try {
      await dataSource.query(c.ddl);
      console.log(`[Ensure] employees.${c.column} added.`);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e?.code === 'ER_DUP_FIELDNAME') continue;
      console.error(`[Ensure] add employees.${c.column} failed:`, e?.message ?? err);
      throw err;
    }
  }

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS employee_history (
      id INT NOT NULL AUTO_INCREMENT,
      employee_id INT NOT NULL,
      entry_date DATE NULL,
      leave_date DATE NULL,
      leave_reason VARCHAR(500) NOT NULL DEFAULT '',
      remark VARCHAR(500) NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_employee_history_employee_id (employee_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='员工入职履历'
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS employee_yearly_record (
      id INT NOT NULL AUTO_INCREMENT,
      employee_id INT NOT NULL,
      year INT NOT NULL,
      type VARCHAR(32) NOT NULL,
      value VARCHAR(255) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_employee_yearly_record_employee_year (employee_id, year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='员工年度记录（春节回家/放假/上班/备注）'
  `);

  console.log('[Ensure] employee rosters tables ready.');
}

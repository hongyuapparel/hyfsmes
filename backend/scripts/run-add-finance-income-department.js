/**
 * 为 finance_income_records 表添加 department_id 列。
 * 用法：在 backend 目录下执行 node scripts/run-add-finance-income-department.js
 */
const path = require('path');
const fs = require('fs');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
}

loadEnv();

const mysql = require('mysql2/promise');

const sql = `ALTER TABLE finance_income_records
  ADD COLUMN department_id INT NULL COMMENT '部门 ID（system_options.id, org_departments）' AFTER fund_account_id`;

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'erp',
  });
  try {
    await conn.query(sql);
    console.log('finance_income_records.department_id 列已添加。');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('列 department_id 已存在，无需重复添加。');
      return;
    }
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

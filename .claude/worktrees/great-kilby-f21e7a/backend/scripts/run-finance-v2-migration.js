/**
 * 财务模块 v2 迁移脚本。
 * 用法：在 backend 目录下执行 node scripts/run-finance-v2-migration.js
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

function splitSql(sql) {
  const withoutBlock = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  const withoutLine = withoutBlock.replace(/^\s*--.*$/gm, '');
  return withoutLine.split(';').map((s) => s.trim()).filter(Boolean);
}

async function main() {
  const sqlPath = path.join(__dirname, 'finance-v2-migration.sql');
  const sqlText = fs.readFileSync(sqlPath, 'utf8');
  const statements = splitSql(sqlText);

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'erp',
  });

  try {
    for (const s of statements) {
      await conn.query(s);
      const verb = s.trim().split(/\s+/)[0].toUpperCase();
      console.log(`  [OK] ${verb} ...`);
    }
    console.log('\n财务 v2 迁移完成：');
    console.log('  新建表：finance_fund_accounts, finance_income_types, finance_expense_types');
    console.log('  重建表：finance_income_records, finance_expense_records');
    console.log('  已写入默认收入类型（7条）、支出类型（14条）');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

/**
 * 创建财务相关表（收入流水/支出流水）。
 * 用法：在 backend 目录下执行 node scripts/run-create-finance-tables.js
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

function splitSqlStatements(sql) {
  // 先去掉注释再分割：保留脚本中的示例注释块，不执行。
  const withoutBlockComments = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  const withoutLineComments = withoutBlockComments.replace(/^\s*--.*$/gm, '');
  return withoutLineComments
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const sqlPath = path.join(__dirname, 'create-finance-tables.sql');
  const sqlText = fs.readFileSync(sqlPath, 'utf8');
  const statements = splitSqlStatements(sqlText);

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'erp',
    multipleStatements: true,
  });

  try {
    for (const s of statements) {
      await conn.query(s);
    }
    console.log('财务表已创建/已存在：finance_income_records, finance_expense_records');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});


/**
 * 为 order_finishing 表添加 tail_inbound_qty 列（方案 A）。
 * 用法：在 backend 目录下执行 node scripts/run-add-tail-inbound-qty.js
 * 会读取 backend/.env 中的 MYSQL_* 配置（若无 .env 则用默认值）。
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

const sql = `ALTER TABLE order_finishing
  ADD COLUMN tail_inbound_qty INT NOT NULL DEFAULT 0 COMMENT '尾部入库数（可多次累加）' AFTER tail_shipped_qty`;

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
    console.log('order_finishing.tail_inbound_qty 列已添加。');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('列 tail_inbound_qty 已存在，无需重复添加。');
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

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function loadEnv(envPath) {
  const env = {};
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!/^[A-Z0-9_]+=/.test(line)) continue;
    const idx = line.indexOf('=');
    env[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return env;
}

async function main() {
  const backendDir = path.resolve(__dirname, '..');
  const env = loadEnv(path.join(backendDir, '.env'));

  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: parseInt(env.MYSQL_PORT || '3306', 10),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'erp',
    charset: 'utf8mb4',
  });

  try {
    await conn.beginTransaction();

    const [orderRows] = await conn.execute(
      'SELECT id FROM orders WHERE order_no = ? LIMIT 1',
      ['AL50'],
    );
    const orderId = orderRows[0]?.id ?? null;

    if (orderId) {
      await conn.execute('DELETE FROM order_cost_snapshots WHERE order_id = ?', [orderId]);
      await conn.execute('DELETE FROM orders WHERE id = ?', [orderId]);
    }

    await conn.execute('DELETE FROM products WHERE sku_code = ?', ['AL50']);

    await conn.commit();

    console.log(
      JSON.stringify(
        {
          ok: true,
          removedOrderId: orderId,
          removedSkuCode: 'AL50',
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function parseArgs(argv) {
  return {
    listOnly: argv.includes('--list-only'),
    listLocal: argv.includes('--list-local'),
  };
}

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

function parseFilename(imageUrl) {
  const text = String(imageUrl || '').trim();
  if (!text) return '';
  try {
    if (/^https?:\/\//i.test(text)) {
      return path.basename(new URL(text).pathname || '');
    }
  } catch {}
  return path.basename(text);
}

async function main() {
  const args = parseArgs(process.argv);
  const backendDir = path.resolve(__dirname, '..');
  const mirrorDir = path.join(backendDir, 'uploads', 'migration-old');
  if (!fs.existsSync(mirrorDir)) {
    throw new Error(`目录不存在: ${mirrorDir}`);
  }

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
    const localFiles = fs
      .readdirSync(mirrorDir)
      .filter((name) => fs.statSync(path.join(mirrorDir, name)).isFile());
    const localSet = new Set(localFiles.map((x) => x.toLowerCase()));

    const [rows] = await conn.query(
      "SELECT id, sku_code AS skuCode, image_url AS imageUrl FROM products WHERE image_url IS NOT NULL AND image_url <> ''",
    );
    const list = Array.isArray(rows) ? rows : [];

    if (args.listLocal) {
      const localRows = list
        .filter((row) => String(row.imageUrl || '').startsWith('/api/uploads/migration-old/'))
        .map((row) => ({
          id: Number(row.id),
          skuCode: String(row.skuCode || ''),
          imageUrl: String(row.imageUrl || ''),
        }));
      console.log(
        JSON.stringify(
          {
            ok: true,
            listLocal: true,
            count: localRows.length,
            rows: localRows,
          },
          null,
          2,
        ),
      );
      return;
    }

    let alreadyLocal = 0;
    let matched = 0;
    const updates = [];
    const matchedRows = [];

    for (const row of list) {
      const imageUrl = String(row.imageUrl || '').trim();
      if (!imageUrl) continue;
      if (imageUrl.startsWith('/api/uploads/migration-old/')) {
        alreadyLocal += 1;
        continue;
      }
      const filename = parseFilename(imageUrl);
      if (!filename) continue;
      if (!localSet.has(filename.toLowerCase())) continue;

      matched += 1;
      updates.push([`/api/uploads/migration-old/${filename}`, Number(row.id)]);
      matchedRows.push({
        id: Number(row.id),
        skuCode: String(row.skuCode || ''),
        oldImageUrl: imageUrl,
        newImageUrl: `/api/uploads/migration-old/${filename}`,
      });
    }

    if (!args.listOnly && updates.length > 0) {
      await conn.beginTransaction();
      for (const [newUrl, id] of updates) {
        await conn.execute('UPDATE products SET image_url = ? WHERE id = ?', [newUrl, id]);
      }
      await conn.commit();
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          localFiles: localFiles.length,
          totalRows: list.length,
          alreadyLocal,
          matchedAndUpdated: matched,
          listOnly: args.listOnly,
          rows: matchedRows,
        },
        null,
        2,
      ),
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const OLD_ASSET_BASE_URL = process.env.OLD_ASSET_BASE_URL || 'http://47.112.218.75';
const LOCAL_UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads', 'migration-old');

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

function parseArgs(argv) {
  const args = { sampleDir: '', dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--sample-dir') {
      args.sampleDir = argv[i + 1] || '';
      i += 1;
    }
  }
  return args;
}

function toNullableString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text.toUpperCase() === 'NULL') return null;
  return text;
}

function toNumber(value) {
  const text = toNullableString(value);
  if (text == null) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function parseDate(value) {
  const text = toNullableString(value);
  if (!text) return null;
  const d = new Date(text.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function toAbsoluteImageUrl(value) {
  const text = toNullableString(value);
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith('/')) return `${OLD_ASSET_BASE_URL}${text}`;
  return `${OLD_ASSET_BASE_URL}/${text}`;
}

function resolveImportImageUrl(value) {
  const text = toNullableString(value);
  if (!text) return '';
  const filename = path.basename(text);
  if (!filename) return '';

  const localMirrorPath = path.join(LOCAL_UPLOADS_DIR, filename);
  if (fs.existsSync(localMirrorPath)) {
    return `/api/uploads/migration-old/${filename}`;
  }
  return toAbsoluteImageUrl(text);
}

function readTsvLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ''))
    .filter(Boolean);
}

function parseSkuCoreRow(line) {
  const cols = line.split('\t');
  return {
    skuId: toNumber(cols[0]),
    skuNo: toNullableString(cols[1]) || '',
    designNo: toNullableString(cols[2]) || '',
    skuImage: toNullableString(cols[3]) || '',
    oldCustomerId: toNumber(cols[4]),
    oldCustomerName: toNullableString(cols[5]) || '',
    salesmanUserId: toNumber(cols[6]),
    skuPrice: toNumber(cols[7]),
    skuProductionPrice: toNumber(cols[8]),
    processStr: toNullableString(cols[9]) || '',
    beforeRequire: toNullableString(cols[10]) || '',
    cuttingRequire: toNullableString(cols[11]) || '',
    sewingRequire: toNullableString(cols[12]) || '',
    tailRequire: toNullableString(cols[13]) || '',
    createTime: parseDate(cols[14]),
    status: toNumber(cols[15]),
  };
}

function parseUserLookupLine(line) {
  const cols = line.split('\t');
  return {
    userId: toNumber(cols[0]),
    userName: toNullableString(cols[1]) || '',
  };
}

function pickSalespersonText(salesmanUserId, userNameById) {
  const userName = userNameById.get(Number(salesmanUserId));
  if (userName) return userName;
  if (!Number.isFinite(salesmanUserId) || salesmanUserId <= 0) return '';
  return `旧系统业务员ID:${salesmanUserId}`;
}

async function main() {
  const args = parseArgs(process.argv);
  const backendDir = path.resolve(__dirname, '..');
  const env = loadEnv(path.join(backendDir, '.env'));

  const sampleDir = args.sampleDir
    ? path.resolve(backendDir, args.sampleDir)
    : path.resolve(backendDir, '..', 'docs', 'migration-samples', 'SKU_FULL_20260325_211300');
  const skuFile = path.join(sampleDir, '01_sku_core.tsv');
  const userLookupFile = path.join(sampleDir, '05_user_lookup.tsv');
  if (!fs.existsSync(skuFile)) {
    throw new Error(`Missing file: ${skuFile}`);
  }

  const rows = readTsvLines(skuFile).map(parseSkuCoreRow);
  const validRows = rows.filter((r) => r.skuNo && r.status !== -1);

  // sku_no 去重：优先 status=1、create_time 更新、sku_id 更大
  const bySku = new Map();
  for (const row of validRows) {
    const key = row.skuNo;
    const existing = bySku.get(key);
    if (!existing) {
      bySku.set(key, row);
      continue;
    }
    const rank = (x) => {
      const active = x.status === 1 ? 1 : 0;
      const t = x.createTime ? x.createTime.getTime() : 0;
      const id = Number(x.skuId || 0);
      return [active, t, id];
    };
    const [a1, t1, id1] = rank(existing);
    const [a2, t2, id2] = rank(row);
    if (a2 > a1 || (a2 === a1 && t2 > t1) || (a2 === a1 && t2 === t1 && id2 > id1)) {
      bySku.set(key, row);
    }
  }
  const deduped = Array.from(bySku.values());
  const userNameById = new Map();
  if (fs.existsSync(userLookupFile)) {
    const userRows = readTsvLines(userLookupFile).map(parseUserLookupLine);
    for (const row of userRows) {
      if (Number.isFinite(row.userId) && row.userName) {
        userNameById.set(Number(row.userId), row.userName);
      }
    }
  }

  if (args.dryRun) {
    const withImage = deduped.filter((x) => !!x.skuImage).length;
    const withCustomerName = deduped.filter((x) => !!x.oldCustomerName).length;
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          sampleDir,
          sourceRows: rows.length,
          validRows: validRows.length,
          dedupedRows: deduped.length,
          withImage,
          withCustomerName,
          preview: deduped.slice(0, 10).map((x) => ({
            skuId: x.skuId,
            skuNo: x.skuNo,
            productName: x.designNo || x.skuNo,
            imageUrl: resolveImportImageUrl(x.skuImage),
            oldCustomerName: x.oldCustomerName,
            salesperson: pickSalespersonText(x.salesmanUserId, userNameById),
            createdAt: x.createTime ? x.createTime.toISOString() : null,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

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

    const [customerRows] = await conn.query('SELECT id, company_name FROM customers');
    const customerIdByName = new Map();
    for (const row of customerRows) {
      const name = toNullableString(row.company_name);
      if (!name) continue;
      if (!customerIdByName.has(name)) customerIdByName.set(name, Number(row.id));
    }

    let insertedOrUpdated = 0;
    let mappedCustomerCount = 0;
    for (const row of deduped) {
      const productName = row.designNo || row.skuNo;
      const imageUrl = resolveImportImageUrl(row.skuImage);
      const customerId = customerIdByName.get(row.oldCustomerName) ?? null;
      if (customerId != null) mappedCustomerCount += 1;

      await conn.execute(
        `
        INSERT INTO products
          (product_name, sku_code, image_url, product_group_id, applicable_people_id, customer_id, salesperson, created_at, updated_at)
        VALUES
          (?, ?, ?, NULL, NULL, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          product_name = VALUES(product_name),
          image_url = VALUES(image_url),
          customer_id = VALUES(customer_id),
          salesperson = VALUES(salesperson),
          updated_at = NOW()
        `,
        [
          productName,
          row.skuNo,
          imageUrl,
          customerId,
          pickSalespersonText(row.salesmanUserId, userNameById),
          row.createTime || new Date(),
        ],
      );
      insertedOrUpdated += 1;
    }

    await conn.commit();
    console.log(
      JSON.stringify(
        {
          ok: true,
          sampleDir,
          sourceRows: rows.length,
          validRows: validRows.length,
          dedupedRows: deduped.length,
          insertedOrUpdated,
          mappedCustomerCount,
          unmappedCustomerCount: deduped.length - mappedCustomerCount,
          userLookupLoaded: userNameById.size,
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

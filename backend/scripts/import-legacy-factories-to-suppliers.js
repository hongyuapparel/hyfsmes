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

function parseArgs(argv) {
  const out = {
    file: '',
    supplierType: '加工供应商',
    dryRun: false,
  };
  for (const arg of argv) {
    if (arg.startsWith('--file=')) {
      out.file = arg.slice('--file='.length).trim();
      continue;
    }
    if (arg.startsWith('--supplier-type=')) {
      out.supplierType = arg.slice('--supplier-type='.length).trim();
      continue;
    }
    if (arg === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      out.help = true;
      continue;
    }
  }
  return out;
}

function normalizeText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeTextForCompare(value) {
  return normalizeText(value).toLowerCase();
}

function decodeBufferAsText(buf) {
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('\uFFFD')) return utf8;
  return buf.toString('latin1');
}

function parseCsv(text) {
  const rows = [];
  let field = '';
  let row = [];
  let i = 0;
  let inQuote = false;
  const src = text.replace(/^\uFEFF/, '');
  while (i < src.length) {
    const ch = src[i];
    if (inQuote) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuote = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuote = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseTsv(text) {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.split('\t'))
    .filter((row) => row.some((x) => normalizeText(x)));
}

function parseTableText(text) {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
  if (firstLine.includes('\t')) return parseTsv(text);
  return parseCsv(text);
}

function pickValueByAliases(record, aliases) {
  for (const key of aliases) {
    const val = record[key];
    if (normalizeText(val)) return normalizeText(val);
  }
  return '';
}

function splitScopes(raw) {
  const text = normalizeText(raw);
  if (!text) return [];
  const parts = text
    .split(/[,，;；|/、]+/g)
    .map((x) => normalizeText(x))
    .filter(Boolean);
  return Array.from(new Set(parts));
}

function pickMergedRemark(current, incoming) {
  const cur = normalizeText(current);
  const next = normalizeText(incoming);
  if (!cur && next) return next;
  return cur;
}

function makeScopeIdsText(ids) {
  if (!ids.length) return null;
  return JSON.stringify(ids);
}

async function readFactoryRowsFromFile(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`导入文件不存在: ${abs}`);
  }
  const buf = fs.readFileSync(abs);
  const text = decodeBufferAsText(buf);
  const rows = parseTableText(text);
  if (rows.length < 2) {
    throw new Error('导入文件为空或缺少数据行');
  }
  const firstRow = rows[0].map((h) => normalizeText(h));
  const knownHeaderAliases = new Set([
    '加工厂名称',
    'factory_name',
    'factoryName',
    '供应商名称',
    'supplier_name',
    'name',
    '加工厂级别',
    'grade_name',
    'factory_level',
    'business_scope',
    '业务范围',
    '备注',
    'remark',
    'memo',
  ]);
  const hasHeader = firstRow.some((h) => knownHeaderAliases.has(h));
  const headers = hasHeader ? firstRow : ['加工厂名称', '加工厂级别', '备注'];
  const dataRows = (hasHeader ? rows.slice(1) : rows).filter((r) =>
    r.some((v) => normalizeText(v)),
  );

  const result = [];
  for (const row of dataRows) {
    const record = {};
    for (let i = 0; i < headers.length; i += 1) {
      const key = headers[i];
      if (!key) continue;
      record[key] = normalizeText(row[i] || '');
    }
    const factoryName = pickValueByAliases(record, [
      '加工厂名称',
      'factory_name',
      'factoryName',
      '供应商名称',
      'supplier_name',
      'name',
    ]);
    if (!factoryName) continue;
    const factoryLevel = pickValueByAliases(record, [
      '加工厂级别',
      'grade_name',
      'factory_level',
      'business_scope',
      '业务范围',
    ]);
    const remark = pickValueByAliases(record, ['备注', 'remark', 'memo']);

    result.push({
      supplierName: factoryName,
      levelText: factoryLevel,
      remark,
    });
  }
  return result;
}

async function ensureSupplierType(conn, supplierTypeValue) {
  const [rows] = await conn.query(
    `
    SELECT id
    FROM system_options
    WHERE option_type = 'supplier_types'
      AND parent_id IS NULL
      AND value = ?
    ORDER BY id ASC
    LIMIT 1
    `,
    [supplierTypeValue],
  );
  if (rows.length > 0) return Number(rows[0].id);

  const [maxSortRows] = await conn.query(
    `
    SELECT COALESCE(MAX(sort_order), 0) AS maxSort
    FROM system_options
    WHERE option_type = 'supplier_types'
      AND parent_id IS NULL
    `,
  );
  const nextSort = Number(maxSortRows[0]?.maxSort || 0) + 1;
  const [insertRes] = await conn.execute(
    `
    INSERT INTO system_options (option_type, value, sort_order, parent_id)
    VALUES ('supplier_types', ?, ?, NULL)
    `,
    [supplierTypeValue, nextSort],
  );
  return Number(insertRes.insertId);
}

async function loadExistingScopesByType(conn, supplierTypeId) {
  const [rows] = await conn.query(
    `
    SELECT id, value
    FROM system_options
    WHERE option_type = 'supplier_types'
      AND parent_id = ?
    ORDER BY id ASC
    `,
    [supplierTypeId],
  );
  const map = new Map();
  for (const row of rows) {
    const key = normalizeTextForCompare(row.value);
    if (!key || map.has(key)) continue;
    map.set(key, Number(row.id));
  }
  return map;
}

function printHelp() {
  console.log(`
用法:
  node scripts/import-legacy-factories-to-suppliers.js --file=TSV文件路径 [--supplier-type=加工供应商] [--dry-run]

参数:
  --file=xxx                 从 TSV/CSV 文件导入（推荐 TSV）
  --supplier-type=xxx        供应商类型名称，默认「加工供应商」
  --dry-run                  仅预览，不写入数据库
  --help, -h                 显示帮助

导入映射（固定）:
  - 加工厂名称 -> suppliers.name
  - 加工厂级别 -> suppliers.business_scope_id / business_scope_ids（不存在自动创建）
  - 备注 -> suppliers.remark
  - 供应商类型统一 -> 指定类型（默认「加工供应商」）
  - 其他字段不导入
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.file) {
    throw new Error('缺少参数 --file=TSV文件路径');
  }

  const backendDir = path.resolve(__dirname, '..');
  const env = loadEnv(path.join(backendDir, '.env'));
  const targetDb = env.MYSQL_DATABASE || 'erp';
  const supplierTypeValue = normalizeText(args.supplierType) || '加工供应商';

  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: parseInt(env.MYSQL_PORT || '3306', 10),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: targetDb,
    charset: 'utf8mb4',
  });

  try {
    const legacyRows = await readFactoryRowsFromFile(args.file);
    const supplierTypeId = await ensureSupplierType(conn, supplierTypeValue);
    const scopeIdByText = await loadExistingScopesByType(conn, supplierTypeId);

    const mergedByName = new Map();
    for (const row of legacyRows) {
      const name = normalizeText(row.supplierName);
      if (!name) continue;
      if (!mergedByName.has(name)) {
        mergedByName.set(name, {
          name,
          rawScopes: new Set(),
          remark: '',
        });
      }
      const item = mergedByName.get(name);
      item.remark = pickMergedRemark(item.remark, row.remark);
      for (const scope of splitScopes(row.levelText)) {
        item.rawScopes.add(scope);
      }
    }

    if (!args.dryRun) await conn.beginTransaction();

    let createdScopeCount = 0;
    for (const item of mergedByName.values()) {
      for (const scopeText of item.rawScopes) {
        const key = normalizeTextForCompare(scopeText);
        if (!key) continue;
        if (scopeIdByText.has(key)) continue;

        const [maxSortRows] = await conn.query(
          `
          SELECT COALESCE(MAX(sort_order), 0) AS maxSort
          FROM system_options
          WHERE option_type = 'supplier_types' AND parent_id = ?
          `,
          [supplierTypeId],
        );
        const nextSort = Number(maxSortRows[0]?.maxSort || 0) + 1;
        createdScopeCount += 1;
        if (!args.dryRun) {
          const [insertRes] = await conn.execute(
            `
            INSERT INTO system_options (option_type, value, sort_order, parent_id)
            VALUES ('supplier_types', ?, ?, ?)
            `,
            [scopeText, nextSort, supplierTypeId],
          );
          scopeIdByText.set(key, Number(insertRes.insertId));
        }
      }
    }

    const [existingRows] = await conn.query('SELECT id, name FROM suppliers');
    const existingByName = new Map(
      existingRows
        .map((x) => ({ id: Number(x.id), name: normalizeText(x.name) }))
        .filter((x) => x.name)
        .map((x) => [x.name, x.id]),
    );

    const mergedRows = Array.from(mergedByName.values()).map((item) => {
      const scopeIds = Array.from(item.rawScopes)
        .map((scopeText) => scopeIdByText.get(normalizeTextForCompare(scopeText)) || null)
        .filter((id) => Number.isInteger(id) && id > 0)
        .sort((a, b) => a - b);
      return {
        name: item.name,
        supplierTypeId,
        businessScopeId: scopeIds[0] || null,
        businessScopeIds: scopeIds.length ? scopeIds : null,
        remark: normalizeText(item.remark),
        rawScopes: Array.from(item.rawScopes),
      };
    });

    let insertCount = 0;
    let updateCount = 0;
    let unresolvedScopeCount = 0;

    for (const row of mergedRows) {
      if (!row.businessScopeId && row.rawScopes.length) unresolvedScopeCount += 1;
      const businessScopeIdsText = row.businessScopeIds ? makeScopeIdsText(row.businessScopeIds) : null;
      const existingId = existingByName.get(row.name);

      if (existingId) {
        updateCount += 1;
        if (!args.dryRun) {
          await conn.execute(
            `
            UPDATE suppliers
            SET
              supplier_type_id = ?,
              business_scope_id = COALESCE(?, business_scope_id),
              business_scope_ids = COALESCE(?, business_scope_ids),
              remark = CASE WHEN ? <> '' THEN ? ELSE remark END,
              updated_at = NOW()
            WHERE id = ?
            `,
            [
              row.supplierTypeId,
              row.businessScopeId,
              businessScopeIdsText,
              row.remark,
              row.remark,
              existingId,
            ],
          );
        }
        continue;
      }

      insertCount += 1;
      if (!args.dryRun) {
        await conn.execute(
          `
          INSERT INTO suppliers
            (name, supplier_type_id, business_scope_id, business_scope_ids, contact_person, contact_info, factory_address, settlement_time, remark, created_at, updated_at)
          VALUES
            (?, ?, ?, ?, '', '', '', '', ?, NOW(), NOW())
          `,
          [row.name, row.supplierTypeId, row.businessScopeId, businessScopeIdsText, row.remark || ''],
        );
      }
    }

    if (!args.dryRun) await conn.commit();

    const unresolvedScopeSamples = mergedRows
      .filter((x) => !x.businessScopeId && x.rawScopes.length)
      .slice(0, 20)
      .map((x) => ({
        name: x.name,
        levelTexts: x.rawScopes,
      }));

    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: args.dryRun,
          sourceFile: path.resolve(args.file),
          targetDb,
          supplierTypeValue,
          supplierTypeId,
          sourceRows: legacyRows.length,
          mergedSupplierRows: mergedRows.length,
          createdScopeCount,
          insertCount,
          updateCount,
          unresolvedScopeCount,
          unresolvedScopeSamples,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (!args.dryRun) {
      try {
        await conn.rollback();
      } catch (_) {
        // ignore
      }
    }
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

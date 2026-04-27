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
    legacyDb: '',
    file: '',
    dryRun: false,
  };
  for (const arg of argv) {
    if (arg.startsWith('--legacy-db=')) {
      out.legacyDb = arg.slice('--legacy-db='.length).trim();
      continue;
    }
    if (arg.startsWith('--file=')) {
      out.file = arg.slice('--file='.length).trim();
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

function quoteIdentifier(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

function makeScopeIdsText(ids) {
  if (!ids.length) return null;
  return JSON.stringify(ids);
}

function decodeBufferAsText(buf) {
  // UTF-16 LE BOM
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.toString('utf16le');
  }
  // UTF-16 BE BOM -> swap bytes then decode as UTF-16 LE
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.allocUnsafe(buf.length - 2);
    for (let i = 2; i < buf.length; i += 2) {
      const a = buf[i];
      const b = i + 1 < buf.length ? buf[i + 1] : 0x00;
      swapped[i - 2] = b;
      swapped[i - 1] = a;
    }
    return swapped.toString('utf16le');
  }
  // Heuristic: UTF-16 LE without BOM usually has many \0 at odd positions
  if (buf.length >= 8) {
    let zeroCount = 0;
    const sample = Math.min(buf.length, 2000);
    for (let i = 1; i < sample; i += 2) {
      if (buf[i] === 0x00) zeroCount += 1;
    }
    const ratio = zeroCount / Math.max(1, Math.floor(sample / 2));
    if (ratio > 0.25) return buf.toString('utf16le');
  }
  const textUtf8 = buf.toString('utf8');
  const firstLineUtf8 = textUtf8.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
  // Header is readable in UTF-8 -> keep UTF-8 even if body has few invalid bytes.
  if (/(供应商名称|supplier_name|supplierName|name)/i.test(firstLineUtf8)) return textUtf8;
  if (!textUtf8.includes('\uFFFD')) return textUtf8;
  const replacementCount = (textUtf8.match(/\uFFFD/g) || []).length;
  const replacementRatio = replacementCount / Math.max(1, textUtf8.length);
  if (replacementRatio < 0.001) return textUtf8;
  return buf.toString('latin1');
}

function parseDelimited(text, delimiter) {
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
    if (ch === delimiter) {
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
      field = '';
      rows.push(row);
      row = [];
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

function detectDelimiter(text) {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return tabCount >= commaCount ? '\t' : ',';
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

function pickMergedText(current, incoming) {
  const cur = normalizeText(current);
  const next = normalizeText(incoming);
  if (!cur && next) return next;
  return cur;
}

async function readLegacyRowsFromCsv(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`导入文件不存在: ${abs}`);
  }
  const buf = fs.readFileSync(abs);
  const text = decodeBufferAsText(buf);
  const delimiter = detectDelimiter(text);
  const rows = parseDelimited(text, delimiter).filter((r) => r.some((v) => normalizeText(v)));
  if (rows.length < 2) {
    throw new Error('导入文件内容为空或缺少数据行');
  }
  const headers = rows[0].map((h) => normalizeText(h));
  const dataRows = rows.slice(1);
  if (process.env.DEBUG_SUPPLIER_IMPORT === '1') {
    console.log(
      JSON.stringify(
        {
          debug: true,
          delimiter: delimiter === '\t' ? 'tab' : 'comma',
          headerPreview: headers,
          firstDataRowPreview: dataRows[0] || null,
          parsedRows: rows.length,
        },
        null,
        2,
      ),
    );
  }

  const result = [];
  for (const row of dataRows) {
    const record = {};
    for (let i = 0; i < headers.length; i += 1) {
      const key = headers[i];
      if (!key) continue;
      record[key] = normalizeText(row[i] || '');
    }
    const name = pickValueByAliases(record, [
      '供应商名称',
      'supplier_name',
      'supplierName',
      'name',
    ]);
    if (!name) continue;
    const scope = pickValueByAliases(record, ['业务范围', 'supplier_scope', 'supplierScope', 'scope']);
    const contactPerson = pickValueByAliases(record, [
      '联系人',
      'contact_person',
      'contactPerson',
      'supplier_linkman',
      'linkman',
    ]);
    const contactInfo = pickValueByAliases(record, [
      '联系电话',
      'contact_info',
      'contactInfo',
      'supplier_tel',
      'phone',
      'mobile',
    ]);
    const factoryAddress = pickValueByAliases(record, [
      '工厂地址',
      'factory_address',
      'factoryAddress',
      'supplier_address',
      'address',
    ]);
    const settlementTime = pickValueByAliases(record, [
      '结款时间',
      'settlement_time',
      'settlementTime',
      'supplier_paytime',
      'pay_time',
      'payment_time',
    ]);

    result.push({
      supplier_name: name,
      supplier_scope: scope,
      contact_person: contactPerson,
      contact_info: contactInfo,
      factory_address: factoryAddress,
      settlement_time: settlementTime,
    });
  }
  if (process.env.DEBUG_SUPPLIER_IMPORT === '1') {
    console.log(JSON.stringify({ debug: true, mappedRows: result.length }, null, 2));
  }
  return result;
}

async function readLegacyRowsFromDb(conn, legacyDb) {
  const legacyTable = `${quoteIdentifier(legacyDb)}.\`erp_sys_supplier\``;
  const [rows] = await conn.query(
    `
    SELECT
      supplier_id,
      supplier_name,
      supplier_scope,
      contact_person,
      contact_info,
      factory_address,
      settlement_time
    FROM ${legacyTable}
    WHERE TRIM(COALESCE(supplier_name, '')) <> ''
    ORDER BY supplier_id ASC
    `,
  );
  return rows;
}

async function ensureMaterialSupplierType(conn) {
  const [rows] = await conn.query(
    `
    SELECT id
    FROM system_options
    WHERE option_type = 'supplier_types'
      AND parent_id IS NULL
      AND value = '面料供应商'
    ORDER BY id ASC
    LIMIT 1
    `,
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
    VALUES ('supplier_types', '面料供应商', ?, NULL)
    `,
    [nextSort],
  );
  return Number(insertRes.insertId);
}

function buildTreeMaps(optionRows) {
  const byId = new Map();
  const childrenByParent = new Map();
  for (const row of optionRows) {
    const id = Number(row.id);
    const value = normalizeText(row.value);
    const parentId = row.parent_id == null ? null : Number(row.parent_id);
    byId.set(id, { id, value, parentId });
    if (parentId == null) continue;
    const list = childrenByParent.get(parentId) || [];
    list.push(id);
    childrenByParent.set(parentId, list);
  }
  return { byId, childrenByParent };
}

function collectDescendantIds(rootId, childrenByParent) {
  const ids = [];
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    const children = childrenByParent.get(id) || [];
    for (const cid of children) {
      ids.push(cid);
      queue.push(cid);
    }
  }
  return ids;
}

function printHelp() {
  console.log(`
用法:
  node scripts/import-legacy-suppliers.js [--file=TSV或CSV文件路径] [--legacy-db=旧库名] [--dry-run]

参数:
  --file=xxx        从 TSV/CSV 文件导入（优先级高于 --legacy-db，推荐 TSV）
  --legacy-db=xxx   旧系统数据库名，默认读取 LEGACY_MYSQL_DATABASE；若未设置则使用当前库
  --dry-run         仅预览，不写入 suppliers
  --help, -h        显示帮助

说明:
  - 源数据:
    - 优先: TSV 文件（与订单迁移一致，Linux shell 下 mysql -N -B 导出）
    - 兼容: CSV 文件（首行表头）
    - 备选: <legacyDb>.erp_sys_supplier
  - 目标表: 当前库.suppliers + system_options(option_type='supplier_types')
  - 映射:
    - supplier_name -> suppliers.name
    - 所有供应商类型固定为「面料供应商」
    - supplier_scope/业务范围 -> suppliers.business_scope_id / business_scope_ids
      （若配置项不存在，自动在「面料供应商」下创建）
    - 联系人/联系电话/工厂地址/结款时间按同名字段导入
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const backendDir = path.resolve(__dirname, '..');
  const env = loadEnv(path.join(backendDir, '.env'));
  const targetDb = env.MYSQL_DATABASE || 'erp';
  const legacyDb = args.legacyDb || env.LEGACY_MYSQL_DATABASE || targetDb;

  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: parseInt(env.MYSQL_PORT || '3306', 10),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: targetDb,
    charset: 'utf8mb4',
  });

  try {
    const [optionRowsAll] = await conn.query(
      `
      SELECT id, value, parent_id
      FROM system_options
      WHERE option_type = 'supplier_types'
      ORDER BY id ASC
      `,
    );

    const materialSupplierTypeId = await ensureMaterialSupplierType(conn);
    const legacyRows = args.file
      ? await readLegacyRowsFromCsv(args.file)
      : await readLegacyRowsFromDb(conn, legacyDb);

    const [optionRows] = await conn.query(
      `
      SELECT id, value, parent_id
      FROM system_options
      WHERE option_type = 'supplier_types'
      ORDER BY id ASC
      `,
    );
    const { byId, childrenByParent } = buildTreeMaps(optionRows);
    const descendantIds = collectDescendantIds(materialSupplierTypeId, childrenByParent);
    const scopeIdByNormalizedValue = new Map();
    for (const scopeId of descendantIds) {
      const item = byId.get(scopeId);
      if (!item) continue;
      const key = normalizeTextForCompare(item.value);
      if (!key || scopeIdByNormalizedValue.has(key)) continue;
      scopeIdByNormalizedValue.set(key, scopeId);
    }

    const mergedByName = new Map();
    for (const row of legacyRows) {
      const name = normalizeText(row.supplier_name);
      if (!name) continue;

      const scopeTexts = splitScopes(row.supplier_scope);

      if (!mergedByName.has(name)) {
        mergedByName.set(name, {
          name,
          supplierTypeId: materialSupplierTypeId,
          scopeIdSet: new Set(),
          rawScopes: new Set(),
          contactPerson: '',
          contactInfo: '',
          factoryAddress: '',
          settlementTime: '',
        });
      }
      const item = mergedByName.get(name);
      item.contactPerson = pickMergedText(item.contactPerson, row.contact_person);
      item.contactInfo = pickMergedText(item.contactInfo, row.contact_info);
      item.factoryAddress = pickMergedText(item.factoryAddress, row.factory_address);
      item.settlementTime = pickMergedText(item.settlementTime, row.settlement_time);
      for (const scopeText of scopeTexts) {
        item.rawScopes.add(scopeText);
      }
    }

    let createdScopeCount = 0;
    if (!args.dryRun) await conn.beginTransaction();
    for (const item of mergedByName.values()) {
      const rawScopes = Array.from(item.rawScopes);
      for (const scopeText of rawScopes) {
        const key = normalizeTextForCompare(scopeText);
        if (!key) continue;
        let scopeId = scopeIdByNormalizedValue.get(key) || null;
        if (!scopeId) {
          const [maxSortRows] = await conn.query(
            `
            SELECT COALESCE(MAX(sort_order), 0) AS maxSort
            FROM system_options
            WHERE option_type = 'supplier_types' AND parent_id = ?
            `,
            [materialSupplierTypeId],
          );
          const nextSort = Number(maxSortRows[0]?.maxSort || 0) + 1;
          createdScopeCount += 1;
          if (!args.dryRun) {
            const [insertRes] = await conn.execute(
              `
              INSERT INTO system_options (option_type, value, sort_order, parent_id)
              VALUES ('supplier_types', ?, ?, ?)
              `,
              [scopeText, nextSort, materialSupplierTypeId],
            );
            scopeId = Number(insertRes.insertId);
          } else {
            scopeId = -(createdScopeCount);
          }
          scopeIdByNormalizedValue.set(key, scopeId);
        }
        if (scopeId != null) item.scopeIdSet.add(scopeId);
      }
    }

    const mergedRows = Array.from(mergedByName.values()).map((x) => {
      const scopeIds = Array.from(x.scopeIdSet)
        .filter((id) => Number.isInteger(id) && id > 0)
        .sort((a, b) => a - b);
      return {
        name: x.name,
        supplierTypeId: x.supplierTypeId,
        businessScopeId: scopeIds[0] || null,
        businessScopeIds: scopeIds.length ? scopeIds : null,
        rawScopes: Array.from(x.rawScopes),
        contactPerson: x.contactPerson,
        contactInfo: x.contactInfo,
        factoryAddress: x.factoryAddress,
        settlementTime: x.settlementTime,
      };
    });

    const [existingRows] = await conn.query('SELECT id, name FROM suppliers');
    const existingByName = new Map(
      existingRows
        .map((row) => ({
          id: Number(row.id),
          name: normalizeText(row.name),
        }))
        .filter((row) => row.name)
        .map((row) => [row.name, row.id]),
    );

    let insertCount = 0;
    let updateCount = 0;
    let unresolvedScopeCount = 0;

    for (const row of mergedRows) {
      const scopeIdsText = row.businessScopeIds ? makeScopeIdsText(row.businessScopeIds) : null;
      if (!row.businessScopeId && row.rawScopes.length) unresolvedScopeCount += 1;

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
              contact_person = CASE WHEN ? <> '' THEN ? ELSE contact_person END,
              contact_info = CASE WHEN ? <> '' THEN ? ELSE contact_info END,
              factory_address = CASE WHEN ? <> '' THEN ? ELSE factory_address END,
              settlement_time = CASE WHEN ? <> '' THEN ? ELSE settlement_time END,
              updated_at = NOW()
            WHERE id = ?
            `,
            [
              row.supplierTypeId,
              row.businessScopeId,
              scopeIdsText,
              row.contactPerson,
              row.contactPerson,
              row.contactInfo,
              row.contactInfo,
              row.factoryAddress,
              row.factoryAddress,
              row.settlementTime,
              row.settlementTime,
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
            (?, ?, ?, ?, ?, ?, ?, ?, '', NOW(), NOW())
          `,
          [
            row.name,
            row.supplierTypeId,
            row.businessScopeId,
            scopeIdsText,
            row.contactPerson || '',
            row.contactInfo || '',
            row.factoryAddress || '',
            row.settlementTime || '',
          ],
        );
      }
    }

    if (!args.dryRun) await conn.commit();

    const sampleUnresolved = mergedRows
      .filter((row) => !row.businessScopeId && row.rawScopes.length)
      .slice(0, 20)
      .map((row) => ({
        name: row.name,
        rawScopes: row.rawScopes,
      }));

    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: args.dryRun,
          source: args.file ? 'csv' : 'legacy-db',
          sourceFile: args.file ? path.resolve(args.file) : null,
          targetDb,
          legacyDb,
          materialSupplierTypeId,
          createdScopeCount,
          sourceRows: legacyRows.length,
          mergedSupplierRows: mergedRows.length,
          insertCount,
          updateCount,
          unresolvedScopeCount,
          unresolvedScopeSamples: sampleUnresolved,
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
        // ignore rollback failure
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

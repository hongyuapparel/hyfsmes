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

function normalizeText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeKey(value) {
  return normalizeText(value).toUpperCase();
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

function decodeBufferAsText(buf) {
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('\uFFFD')) return utf8;
  return buf.toString('latin1');
}

function parseTsv(text) {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.split('\t'))
    .filter((row) => row.some((x) => normalizeText(x)));
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

function parseTableText(text) {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
  if (firstLine.includes('\t')) return parseTsv(text);
  return parseCsv(text);
}

function pickByAliases(record, aliases) {
  for (const key of aliases) {
    const val = record[key];
    if (normalizeText(val)) return normalizeText(val);
  }
  return '';
}

function buildScopeLabel({ grade, displayText, desc, ctm, fob }) {
  if (displayText) return displayText;
  const details = [];
  if (desc) details.push(desc);
  if (ctm) details.push(`CTM:${ctm}`);
  if (fob) details.push(`FOB:${fob}`);
  if (!details.length) return grade;
  return `${grade} - ${details.join(' | ')}`;
}

async function loadMappingsFromFile(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`映射文件不存在: ${abs}`);
  const text = decodeBufferAsText(fs.readFileSync(abs));
  const rows = parseTableText(text);
  if (rows.length < 2) throw new Error('映射文件为空或缺少数据行');

  const firstRow = rows[0].map((h) => normalizeText(h));
  const knownHeaderAliases = new Set([
    '加工厂级别',
    'grade_name',
    'grade',
    '级别',
    '级别说明',
    'grade_desc',
    '描述',
    '说明',
    'CTM比例',
    'ctm_proportion',
    'ctm',
    'FOB比例',
    'fob_proportion',
    'fob',
    '业务范围显示值',
    'scope_display',
    'display_value',
  ]);
  const hasHeader = firstRow.some((h) => knownHeaderAliases.has(h));
  const headers = hasHeader
    ? firstRow
    : ['加工厂级别', '级别说明', 'CTM比例', 'FOB比例', '业务范围显示值'];
  const dataRows = (hasHeader ? rows.slice(1) : rows).filter((r) =>
    r.some((x) => normalizeText(x)),
  );
  const byGrade = new Map();

  for (const row of dataRows) {
    const record = {};
    for (let i = 0; i < headers.length; i += 1) {
      if (!headers[i]) continue;
      record[headers[i]] = normalizeText(row[i] || '');
    }
    const grade = pickByAliases(record, ['加工厂级别', 'grade_name', 'grade', '级别']);
    if (!grade) continue;
    const desc = pickByAliases(record, ['级别说明', 'grade_desc', '描述', '说明']);
    const displayText = pickByAliases(record, ['业务范围显示值', 'scope_display', 'display_value']);
    const ctm = pickByAliases(record, ['CTM比例', 'ctm_proportion', 'ctm']);
    const fob = pickByAliases(record, ['FOB比例', 'fob_proportion', 'fob']);
    const key = normalizeKey(grade);
    const label = buildScopeLabel({ grade: normalizeText(grade), displayText, desc, ctm, fob });
    byGrade.set(key, label);
  }

  if (byGrade.size === 0) {
    throw new Error('未解析到有效映射，请至少提供“加工厂级别/grade_name”列');
  }
  return byGrade;
}

function printHelp() {
  console.log(`
用法:
  node scripts/sync-processing-scope-labels.js --file=级别映射TSV路径 [--supplier-type=加工供应商] [--dry-run]

参数:
  --file=xxx                 级别映射文件（推荐 TSV）
  --supplier-type=xxx        供应商类型名称，默认「加工供应商」
  --dry-run                  仅预览，不写入数据库
  --help, -h                 显示帮助

映射文件建议列:
  - 加工厂级别 (必填)
  - 级别说明 / CTM比例 / FOB比例（可选）
  - 业务范围显示值（可选，若提供则优先使用）
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.file) throw new Error('缺少参数 --file=级别映射TSV路径');

  const backendDir = path.resolve(__dirname, '..');
  const env = loadEnv(path.join(backendDir, '.env'));
  const supplierTypeValue = normalizeText(args.supplierType) || '加工供应商';
  const mappingByGrade = await loadMappingsFromFile(args.file);

  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: parseInt(env.MYSQL_PORT || '3306', 10),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'erp',
    charset: 'utf8mb4',
  });

  try {
    const [typeRows] = await conn.query(
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
    if (!typeRows.length) throw new Error(`未找到供应商类型: ${supplierTypeValue}`);
    const supplierTypeId = Number(typeRows[0].id);

    const [scopeRows] = await conn.query(
      `
      SELECT id, value
      FROM system_options
      WHERE option_type = 'supplier_types'
        AND parent_id = ?
      ORDER BY sort_order ASC, id ASC
      `,
      [supplierTypeId],
    );

    const updates = [];
    for (const row of scopeRows) {
      const current = normalizeText(row.value);
      if (!current) continue;
      const gradeKey = normalizeKey(current.split(/\s*-\s*/)[0]);
      if (!mappingByGrade.has(gradeKey)) continue;
      const nextValue = mappingByGrade.get(gradeKey);
      if (nextValue === current) continue;
      updates.push({
        id: Number(row.id),
        from: current,
        to: nextValue,
      });
    }

    if (!args.dryRun && updates.length > 0) {
      await conn.beginTransaction();
      for (const item of updates) {
        await conn.execute(
          `
          UPDATE system_options
          SET value = ?
          WHERE id = ?
          `,
          [item.to, item.id],
        );
      }
      await conn.commit();
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: args.dryRun,
          supplierTypeValue,
          supplierTypeId,
          mappingCount: mappingByGrade.size,
          scopeCount: scopeRows.length,
          updateCount: updates.length,
          updateSamples: updates.slice(0, 20),
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

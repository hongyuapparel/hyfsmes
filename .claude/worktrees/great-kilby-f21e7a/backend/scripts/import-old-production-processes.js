const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const {
  buildJobTypePath,
  detectDepartment,
  normalizeJobLeaf,
} = require('./utils/production-process-normalizer');

const SAMPLE_DIR = path.resolve(__dirname, '..', '..', 'docs', 'migration-samples', 'production-processes');
const SAMPLE_FILE = path.join(SAMPLE_DIR, 'erp_work_processes.tsv');

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

function readTsvLines(filename) {
  return fs
    .readFileSync(filename, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ''))
    .filter(Boolean);
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

function normalizeDecimal(value) {
  const n = toNumber(value);
  if (n == null) return '0.00';
  return n.toFixed(2);
}

function parseRows(lines) {
  return lines.map((line) => {
    const cols = line.split('\t');
    return {
      processesId: toNumber(cols[0]),
      processesName: toNullableString(cols[1]) || '',
      unitPrice: normalizeDecimal(cols[2]),
      processesSort: toNumber(cols[3]) ?? 0,
      workName: toNullableString(cols[4]) || '',
      workClass: toNullableString(cols[5]) || '',
      groupName: toNullableString(cols[6]) || '',
    };
  });
}

async function main() {
  if (!fs.existsSync(SAMPLE_FILE)) {
    throw new Error(`Missing sample file: ${SAMPLE_FILE}`);
  }

  const env = loadEnv(path.resolve(__dirname, '..', '.env'));
  const rows = parseRows(readTsvLines(SAMPLE_FILE))
    .filter((row) => row.processesName)
    .map((row) => {
      const department = detectDepartment({
        workClass: row.workClass,
        workName: row.workName,
        groupName: row.groupName,
        processesName: row.processesName,
      });
      const leafJobType = normalizeJobLeaf({
        groupName: row.groupName,
        workName: row.workName,
        department,
      });
      const jobType = buildJobTypePath(department, leafJobType);
      return {
        ...row,
        department,
        jobType,
      };
    });

  const uniqueMap = new Map();
  for (const row of rows) {
    const key = `${row.department}__${row.jobType}__${row.processesName}`;
    const existing = uniqueMap.get(key);
    if (!existing) {
      uniqueMap.set(key, row);
      continue;
    }

    const existingSort = existing.processesSort ?? 0;
    const currentSort = row.processesSort ?? 0;
    if (currentSort < existingSort) {
      uniqueMap.set(key, row);
      continue;
    }

    const existingPrice = Number(existing.unitPrice) || 0;
    const currentPrice = Number(row.unitPrice) || 0;
    if (existingPrice === 0 && currentPrice > 0) {
      uniqueMap.set(key, row);
    }
  }

  const deduped = Array.from(uniqueMap.values()).sort((a, b) => {
    if (a.department !== b.department) return a.department.localeCompare(b.department, 'zh-CN');
    if (a.jobType !== b.jobType) return a.jobType.localeCompare(b.jobType, 'zh-CN');
    if ((a.processesSort ?? 0) !== (b.processesSort ?? 0)) return (a.processesSort ?? 0) - (b.processesSort ?? 0);
    return a.processesName.localeCompare(b.processesName, 'zh-CN');
  });

  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: parseInt(env.MYSQL_PORT || '3306', 10),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'erp',
    charset: 'utf8mb4',
  });

  let inserted = 0;
  let updated = 0;

  try {
    await conn.beginTransaction();

    for (const row of deduped) {
      const [existsRows] = await conn.execute(
        `
        SELECT id, unit_price, sort_order
        FROM production_processes
        WHERE department = ? AND job_type = ? AND name = ?
        LIMIT 1
        `,
        [row.department, row.jobType, row.processesName],
      );

      const existing = existsRows[0];
      if (existing) {
        await conn.execute(
          `
          UPDATE production_processes
          SET unit_price = ?, sort_order = ?, updated_at = NOW()
          WHERE id = ?
          `,
          [row.unitPrice, row.processesSort ?? 0, existing.id],
        );
        updated += 1;
      } else {
        await conn.execute(
          `
          INSERT INTO production_processes
            (department, job_type, name, unit_price, sort_order, created_at, updated_at)
          VALUES
            (?, ?, ?, ?, ?, NOW(), NOW())
          `,
          [row.department, row.jobType, row.processesName, row.unitPrice, row.processesSort ?? 0],
        );
        inserted += 1;
      }
    }

    await conn.commit();

    const summary = {
      ok: true,
      sourceRows: rows.length,
      dedupedRows: deduped.length,
      inserted,
      updated,
      sampleFile: SAMPLE_FILE,
      departments: Array.from(new Set(deduped.map((r) => r.department))),
      samplePreview: deduped.slice(0, 10).map((r) => ({
        department: r.department,
        jobType: r.jobType,
        name: r.processesName,
        unitPrice: r.unitPrice,
        sortOrder: r.processesSort ?? 0,
      })),
    };
    console.log(JSON.stringify(summary, null, 2));
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

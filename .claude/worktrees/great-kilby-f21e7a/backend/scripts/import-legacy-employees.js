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
    dryRun: false,
    createMissingOptions: false,
  };
  for (const arg of argv) {
    if (arg.startsWith('--file=')) {
      out.file = arg.slice('--file='.length).trim();
      continue;
    }
    if (arg === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (arg === '--create-missing-options') {
      out.createMissingOptions = true;
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

function normalizeForKey(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeDeptName(value) {
  return normalizeText(value).replace(/^[,，;；、\s]+|[,，;；、\s]+$/g, '');
}

function normalizeJobTitle(value) {
  const text = normalizeText(value).replace(/^[,，;；、\s]+|[,，;；、\s]+$/g, '');
  if (!text) return '';
  const parts = text
    .split(/[,，;；、|/]+/g)
    .map((x) => normalizeText(x))
    .filter(Boolean);
  return parts[0] || '';
}

function decodeBufferAsText(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le');
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
  return buf.toString('utf8');
}

function detectDelimiter(text) {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return tabCount >= commaCount ? '\t' : ',';
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

function pickValueByAliases(record, aliases) {
  for (const key of aliases) {
    const val = normalizeText(record[key]);
    if (val) return val;
  }
  return '';
}

async function readLegacyRowsFromFile(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`导入文件不存在: ${abs}`);
  const buf = fs.readFileSync(abs);
  const text = decodeBufferAsText(buf);
  const delimiter = detectDelimiter(text);
  const rows = parseDelimited(text, delimiter).filter((r) => r.some((v) => normalizeText(v)));
  if (rows.length < 2) throw new Error('导入文件内容为空或缺少数据行');

  const headers = rows[0].map((h) => normalizeText(h));
  const result = [];
  for (const row of rows.slice(1)) {
    const record = {};
    for (let i = 0; i < headers.length; i += 1) {
      const key = headers[i];
      if (!key) continue;
      record[key] = normalizeText(row[i] || '');
    }
    const name = pickValueByAliases(record, ['姓名', 'name', 'employee_name']);
    if (!name) continue;
    const employeeNo = pickValueByAliases(record, ['工号', 'employee_no', 'employeeNo']);
    const department = pickValueByAliases(record, ['三级部门', '部门', 'department', 'department_name']);
    const jobTitle = pickValueByAliases(record, ['工种', '岗位', 'job_title', 'jobTitle']);
    result.push({ name, employeeNo, department, jobTitle });
  }
  return result;
}

async function getNextSortOrder(conn, optionType, parentId) {
  const [rows] = await conn.query(
    `
    SELECT COALESCE(MAX(sort_order), 0) AS maxSort
    FROM system_options
    WHERE option_type = ?
      AND ${parentId == null ? 'parent_id IS NULL' : 'parent_id = ?'}
    `,
    parentId == null ? [optionType] : [optionType, parentId],
  );
  return Number(rows[0]?.maxSort || 0) + 1;
}

async function loadOptionMaps(conn) {
  const [deptRows] = await conn.query(
    `
    SELECT id, value
    FROM system_options
    WHERE option_type = 'org_departments'
    ORDER BY id ASC
    `,
  );
  const [jobRows] = await conn.query(
    `
    SELECT id, value, parent_id
    FROM system_options
    WHERE option_type = 'org_jobs'
    ORDER BY id ASC
    `,
  );
  const deptIdByName = new Map();
  for (const r of deptRows) {
    const key = normalizeForKey(r.value);
    if (!key || deptIdByName.has(key)) continue;
    deptIdByName.set(key, Number(r.id));
  }

  const jobIdByDeptAndName = new Map();
  for (const r of jobRows) {
    const deptId = r.parent_id == null ? null : Number(r.parent_id);
    if (deptId == null) continue;
    const key = `${deptId}::${normalizeForKey(r.value)}`;
    if (!jobIdByDeptAndName.has(key)) jobIdByDeptAndName.set(key, Number(r.id));
  }
  return { deptIdByName, jobIdByDeptAndName };
}

function printHelp() {
  console.log(`
用法:
  node scripts/import-legacy-employees.js --file=docs/migration-samples/employees.tsv [--dry-run] [--create-missing-options]

参数:
  --file=xxx                  旧系统导出的 TSV/CSV 文件路径（推荐 TSV）
  --dry-run                   仅预览，不写入数据库
  --create-missing-options    遇到缺失部门/岗位时，自动在 system_options 中补齐
  --help, -h                  显示帮助

字段映射（仅这四项）:
  旧系统 姓名 -> employees.name
  旧系统 工号 -> employees.employee_no
  旧系统 三级部门 -> employees.department_id（匹配 system_options.org_departments）
  旧系统 工种 -> employees.job_title_id（匹配 system_options.org_jobs + parent_id=部门）
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.file) {
    printHelp();
    return;
  }

  const backendDir = path.resolve(__dirname, '..');
  const env = loadEnv(path.join(backendDir, '.env'));
  const targetDb = env.MYSQL_DATABASE || 'erp';
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: parseInt(env.MYSQL_PORT || '3306', 10),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: targetDb,
    charset: 'utf8mb4',
  });

  try {
    const sourceRows = await readLegacyRowsFromFile(args.file);
    const mergedByName = new Map();
    for (const r of sourceRows) {
      const key = normalizeText(r.name);
      if (!key) continue;
      if (!mergedByName.has(key)) mergedByName.set(key, { ...r });
      const item = mergedByName.get(key);
      if (!item.employeeNo && r.employeeNo) item.employeeNo = r.employeeNo;
      if (!item.department && r.department) item.department = r.department;
      if (!item.jobTitle && r.jobTitle) item.jobTitle = r.jobTitle;
    }
    const mergedRows = Array.from(mergedByName.values());

    if (!args.dryRun) await conn.beginTransaction();

    let createdDeptCount = 0;
    let createdJobCount = 0;
    let insertCount = 0;
    let updateCount = 0;
    const unresolvedDept = [];
    const unresolvedJob = [];

    const maps = await loadOptionMaps(conn);

    const [existingEmployees] = await conn.query(
      `SELECT id, name FROM employees ORDER BY id ASC`,
    );
    const employeeIdByName = new Map();
    for (const r of existingEmployees) {
      const key = normalizeForKey(r.name);
      if (!key || employeeIdByName.has(key)) continue;
      employeeIdByName.set(key, Number(r.id));
    }

    for (const row of mergedRows) {
      const name = normalizeText(row.name);
      if (!name) continue;
      const employeeNo = normalizeText(row.employeeNo);
      const deptName = normalizeDeptName(row.department);
      const jobName = normalizeJobTitle(row.jobTitle);

      let departmentId = null;
      if (deptName) {
        const deptKey = normalizeForKey(deptName);
        departmentId = maps.deptIdByName.get(deptKey) || null;
        if (!departmentId && args.createMissingOptions) {
          const nextSort = await getNextSortOrder(conn, 'org_departments', null);
          if (!args.dryRun) {
            const [insertRes] = await conn.execute(
              `
              INSERT INTO system_options (option_type, value, sort_order, parent_id)
              VALUES ('org_departments', ?, ?, NULL)
              `,
              [deptName, nextSort],
            );
            departmentId = Number(insertRes.insertId);
          } else {
            departmentId = -(createdDeptCount + 1);
          }
          createdDeptCount += 1;
          maps.deptIdByName.set(deptKey, departmentId);
        }
        if (!departmentId) unresolvedDept.push({ name, department: deptName });
      }

      let jobTitleId = null;
      if (departmentId && departmentId > 0 && jobName) {
        const jobKey = `${departmentId}::${normalizeForKey(jobName)}`;
        jobTitleId = maps.jobIdByDeptAndName.get(jobKey) || null;
        if (!jobTitleId && args.createMissingOptions) {
          const nextSort = await getNextSortOrder(conn, 'org_jobs', departmentId);
          if (!args.dryRun) {
            const [insertRes] = await conn.execute(
              `
              INSERT INTO system_options (option_type, value, sort_order, parent_id)
              VALUES ('org_jobs', ?, ?, ?)
              `,
              [jobName, nextSort, departmentId],
            );
            jobTitleId = Number(insertRes.insertId);
          } else {
            jobTitleId = -(createdJobCount + 1);
          }
          createdJobCount += 1;
          maps.jobIdByDeptAndName.set(jobKey, jobTitleId);
        }
        if (!jobTitleId) unresolvedJob.push({ name, department: deptName, jobTitle: jobName });
      } else if (jobName) {
        unresolvedJob.push({ name, department: deptName, jobTitle: jobName });
      }

      const existingId = employeeIdByName.get(normalizeForKey(name)) || null;
      if (existingId) {
        updateCount += 1;
        if (!args.dryRun) {
          await conn.execute(
            `
            UPDATE employees
            SET
              employee_no = CASE WHEN ? <> '' THEN ? ELSE employee_no END,
              department_id = COALESCE(?, department_id),
              job_title_id = COALESCE(?, job_title_id),
              updated_at = NOW()
            WHERE id = ?
            `,
            [employeeNo, employeeNo, departmentId && departmentId > 0 ? departmentId : null, jobTitleId && jobTitleId > 0 ? jobTitleId : null, existingId],
          );
        }
      } else {
        insertCount += 1;
        if (!args.dryRun) {
          await conn.execute(
            `
            INSERT INTO employees
              (employee_no, name, department, job_title, department_id, job_title_id, entry_date, contact_phone, status, user_id, remark, created_at, updated_at)
            VALUES
              (?, ?, '', '', ?, ?, NULL, '', 'active', NULL, '', NOW(), NOW())
            `,
            [
              employeeNo || '',
              name,
              departmentId && departmentId > 0 ? departmentId : null,
              jobTitleId && jobTitleId > 0 ? jobTitleId : null,
            ],
          );
        }
      }
    }

    if (!args.dryRun) await conn.commit();

    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: args.dryRun,
          createMissingOptions: args.createMissingOptions,
          sourceFile: path.resolve(args.file),
          sourceRows: sourceRows.length,
          mergedRows: mergedRows.length,
          insertCount,
          updateCount,
          createdDeptCount,
          createdJobCount,
          unresolvedDeptCount: unresolvedDept.length,
          unresolvedJobCount: unresolvedJob.length,
          unresolvedDeptSamples: unresolvedDept.slice(0, 20),
          unresolvedJobSamples: unresolvedJob.slice(0, 20),
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


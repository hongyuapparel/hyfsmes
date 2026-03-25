const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const {
  LABELS,
  buildJobTypePath,
  detectDepartment,
  normalizeJobLeaf,
} = require('./utils/production-process-normalizer');

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

async function ensureRoot(conn, department, sortOrder) {
  const [rows] = await conn.execute(
    'SELECT id FROM system_options WHERE option_type = ? AND parent_id IS NULL AND value = ? LIMIT 1',
    ['process_job_types', department],
  );
  if (rows[0]?.id) {
    await conn.execute('UPDATE system_options SET sort_order = ? WHERE id = ?', [sortOrder, rows[0].id]);
    return rows[0].id;
  }

  const [result] = await conn.execute(
    'INSERT INTO system_options (option_type, value, sort_order, parent_id) VALUES (?, ?, ?, NULL)',
    ['process_job_types', department, sortOrder],
  );
  return result.insertId;
}

async function ensureChild(conn, rootId, leafName, sortOrder) {
  const [result] = await conn.execute(
    'INSERT INTO system_options (option_type, value, sort_order, parent_id) VALUES (?, ?, ?, ?)',
    ['process_job_types', leafName, sortOrder, rootId],
  );
  return result.insertId;
}

function choosePreferred(existing, current) {
  if (current.isProtected && !existing.isProtected) return current;
  if (existing.isProtected && !current.isProtected) return existing;
  if (existing.unitPrice === 0 && current.unitPrice > 0) return current;
  if (current.sortOrder < existing.sortOrder) return current;
  if (current.id < existing.id) return current;
  return existing;
}

async function main() {
  const env = loadEnv(path.resolve(__dirname, '..', '.env'));
  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: parseInt(env.MYSQL_PORT || '3306', 10),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'erp',
    charset: 'utf8mb4',
  });

  const departments = [LABELS.CUT, LABELS.SEW, LABELS.TAIL];

  try {
    await conn.beginTransaction();

    const [protectedRows] = await conn.query('SELECT DISTINCT process_id FROM process_quote_template_items');
    const protectedIds = new Set(protectedRows.map((row) => Number(row.process_id)).filter(Number.isFinite));

    const [processRows] = await conn.query(
      'SELECT id, department, job_type, name, unit_price, sort_order FROM production_processes ORDER BY department, job_type, id',
    );

    const normalized = processRows.map((row) => {
      const leaf = normalizeJobLeaf({
        department: String(row.department || '').trim(),
        currentJobType: row.job_type,
      });
      const department = detectDepartment({
        groupName: leaf,
        processesName: row.name,
        currentJobType: row.job_type,
      });

      return {
        id: row.id,
        name: String(row.name || '').trim(),
        department,
        leaf,
        oldDepartment: String(row.department || '').trim(),
        oldJobType: String(row.job_type || '').trim(),
        normalizedJobType: buildJobTypePath(department, leaf),
        unitPrice: Number(row.unit_price) || 0,
        sortOrder: Number(row.sort_order) || 0,
        isProtected: protectedIds.has(Number(row.id)),
      };
    });

    const deduped = new Map();
    for (const row of normalized) {
      const key = `${row.department}__${row.normalizedJobType}__${row.name}`;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, row);
        continue;
      }
      deduped.set(key, choosePreferred(existing, row));
    }

    const keeperIdSet = new Set(Array.from(deduped.values()).map((row) => row.id));

    let updatedProcesses = 0;
    for (const row of normalized) {
      if (!keeperIdSet.has(row.id)) continue;
      const needsDepartmentUpdate = row.oldDepartment !== row.department;
      const needsJobTypeUpdate = row.oldJobType !== row.normalizedJobType;
      if (!needsDepartmentUpdate && !needsJobTypeUpdate) continue;

      await conn.execute(
        'UPDATE production_processes SET department = ?, job_type = ?, updated_at = NOW() WHERE id = ?',
        [row.department, row.normalizedJobType, row.id],
      );
      updatedProcesses += 1;
    }

    let deletedDuplicates = 0;
    for (const row of normalized) {
      if (keeperIdSet.has(row.id)) continue;

      const key = `${row.department}__${row.normalizedJobType}__${row.name}`;
      const keeper = deduped.get(key);
      if (!keeper) continue;

      if (protectedIds.has(row.id) && keeper.id !== row.id) {
        await conn.execute('UPDATE process_quote_template_items SET process_id = ? WHERE process_id = ?', [keeper.id, row.id]);
      }

      await conn.execute('DELETE FROM production_processes WHERE id = ?', [row.id]);
      deletedDuplicates += 1;
    }

    const rootIdByDepartment = new Map();
    for (let i = 0; i < departments.length; i += 1) {
      const rootId = await ensureRoot(conn, departments[i], i);
      rootIdByDepartment.set(departments[i], rootId);
    }

    const rootIds = Array.from(rootIdByDepartment.values());
    if (rootIds.length) {
      await conn.query(
        `DELETE FROM system_options
          WHERE option_type = 'process_job_types'
            AND parent_id IN (${rootIds.map(() => '?').join(', ')})`,
        rootIds,
      );
    }

    const leafMap = new Map();
    for (const row of deduped.values()) {
      if (!row.department || !rootIdByDepartment.has(row.department)) continue;
      const key = `${row.department}__${row.leaf}`;
      if (!leafMap.has(key)) {
        leafMap.set(key, {
          department: row.department,
          leaf: row.leaf,
        });
      }
    }

    const childCounters = new Map();
    let insertedChildren = 0;
    for (const item of Array.from(leafMap.values()).sort((a, b) => {
      if (a.department !== b.department) return a.department.localeCompare(b.department, 'zh-CN');
      return a.leaf.localeCompare(b.leaf, 'zh-CN');
    })) {
      const rootId = rootIdByDepartment.get(item.department);
      const currentSort = childCounters.get(item.department) ?? 0;
      await ensureChild(conn, rootId, item.leaf, currentSort);
      childCounters.set(item.department, currentSort + 1);
      insertedChildren += 1;
    }

    const [childCounts] = await conn.query(
      `
      SELECT p.value AS department, COUNT(c.id) AS total
      FROM system_options p
      LEFT JOIN system_options c
        ON c.parent_id = p.id
       AND c.option_type = 'process_job_types'
      WHERE p.option_type = 'process_job_types'
        AND p.parent_id IS NULL
      GROUP BY p.id, p.value
      ORDER BY p.sort_order, p.id
      `,
    );

    await conn.commit();

    console.log(
      JSON.stringify(
        {
          ok: true,
          updatedProcesses,
          deletedDuplicates,
          insertedChildren,
          roots: departments,
          childCounts,
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

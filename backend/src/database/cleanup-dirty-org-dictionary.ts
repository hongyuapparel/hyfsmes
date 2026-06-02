import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 启动时清理本地脏部门字典：把 seed-org-dictionary 期望保留之外的项删掉。
 *
 * 背景：用户本地早期手动建过一些部门/岗位字典（如顶级"销售部""工厂""开发部"等），
 * seed-org-dictionary 又在正确父级下补了一份。reconcile-employee-dept-job-ids v5
 * 已经把员工挂到 seed 加的正确 ID 上，所以这些脏顶级项理论上已无员工引用，可以
 * 安全删除。
 *
 * 安全策略：
 *   1. 只删顶级 value 不在 KEEP_TOP_DEPTS 名单里的、以及 KEEP_TOP_DEPTS 下不在
 *      KEEP_CHILDREN 名单里的项
 *   2. 删之前 SELECT COUNT employees WHERE department_id = ?；非 0 跳过 + 日志
 *   3. system_options 表自引用 ON DELETE CASCADE，删父级自动级联子级，无需手动
 *
 * 线上字典本来就是干净的（不在脏名单里的项不存在），ensure 跑过去无事发生。
 * 本地脏字典则会被清干净。
 *
 * 幂等：写 marker .cleanup-dirty-org-dictionary-v1.applied。删 marker + 重启
 * 可重跑（前提是字典又脏了）。
 */

const MARKER_FILENAME = '.cleanup-dirty-org-dictionary-v1.applied';

const KEEP_TOP_DEPTS = new Set(['C端电商', 'B2B外贸', '辅助部门', '生产部门']);

const KEEP_CHILDREN: Record<string, Set<string>> = {
  C端电商: new Set([
    'C端亚马逊2',
    'C端TEMU1',
    'C端temu2',
    'C端1688',
    'C端希音',
    'C端亚马逊1',
  ]),
  B2B外贸: new Set<string>(),
  辅助部门: new Set(['人事行政', '财务', '仓库']),
  生产部门: new Set(['采购', '版房', '跟单', '裁床', '车缝', '尾部']),
};

interface DeptRow {
  id: number;
  value: string;
  parentId: number | null;
}

function findMarkerPath(): { path: string; exists: boolean } {
  const candidates = [
    path.resolve(process.cwd(), 'scripts', MARKER_FILENAME),
    path.resolve(__dirname, '../../scripts/' + MARKER_FILENAME),
    path.resolve(__dirname, '../../../scripts/' + MARKER_FILENAME),
  ];
  const exists = candidates.find((p) => fs.existsSync(p));
  return { path: exists ?? candidates[1], exists: !!exists };
}

export async function cleanupDirtyOrgDictionary(dataSource: DataSource): Promise<void> {
  const marker = findMarkerPath();
  if (marker.exists) {
    console.log(`[CleanupDirtyDict] already applied at ${marker.path}, skip.`);
    return;
  }

  const rows = (await dataSource.query(
    `SELECT id, value, parent_id AS parentId FROM system_options WHERE option_type = 'org_departments'`,
  )) as DeptRow[];

  const rowById = new Map<number, DeptRow>();
  for (const r of rows) rowById.set(r.id, r);

  function isDirty(r: DeptRow): boolean {
    if (r.parentId == null) return !KEEP_TOP_DEPTS.has(r.value);
    const parent = rowById.get(r.parentId);
    if (!parent) return true;
    if (parent.parentId != null) return true; // 三级以上一律视为脏
    if (!KEEP_TOP_DEPTS.has(parent.value)) return true; // 父级是脏顶级
    return !(KEEP_CHILDREN[parent.value]?.has(r.value) ?? false);
  }

  const dirtyRows = rows.filter(isDirty);

  // 先删子项（按 parentId NOT NULL），再删顶级；同时检查 employees 引用
  const dirtyChildren = dirtyRows.filter((r) => r.parentId != null);
  const dirtyTops = dirtyRows.filter((r) => r.parentId == null);

  let deleted = 0;
  const skipped: string[] = [];

  async function tryDelete(r: DeptRow) {
    const ref = (await dataSource.query(
      `SELECT COUNT(*) AS c FROM employees WHERE department_id = ?`,
      [r.id],
    )) as Array<{ c: number }>;
    const refCount = Number(ref[0]?.c ?? 0);
    if (refCount > 0) {
      skipped.push(`${r.value}(id=${r.id})[${refCount} emps]`);
      return;
    }
    await dataSource.query(`DELETE FROM system_options WHERE id = ?`, [r.id]);
    deleted += 1;
  }

  for (const r of dirtyChildren) await tryDelete(r);
  for (const r of dirtyTops) await tryDelete(r);

  console.log(
    `[CleanupDirtyDict] deleted ${deleted} dirty department dict entries (${dirtyChildren.length} children + ${dirtyTops.length} tops candidates)`,
  );
  if (skipped.length) {
    console.warn(
      `[CleanupDirtyDict] skipped (still referenced by employees): ${skipped.join(', ')}`,
    );
  }

  try {
    fs.writeFileSync(marker.path, new Date().toISOString(), 'utf-8');
  } catch (e) {
    console.warn(`[CleanupDirtyDict] failed to write marker: ${(e as Error).message}`);
  }
}

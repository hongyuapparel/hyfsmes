import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 启动时 seed 公司组织字典（部门 + 岗位），按线上「组织与人事」页面已有结构。
 *
 * 幂等：按 (option_type, value, parent_id) 三元组查 system_options，存在则跳过、
 * 缺失则 INSERT。**只增不改不删**：
 *   - 已有的名字/排序/parent 都不会被动
 *   - 若用户本地另外加了"销售部"等额外项，也不会被清掉
 *
 * 写 marker .seed-org-dictionary-v1.applied 防止重复执行。
 * 如需重 seed：删 marker 文件 + 重启 PM2；或改 MARKER_FILENAME 版本号。
 *
 * 部门 19 个、岗位 17 个，来源：用户线上「系统设置 → 组织与人事」截图。
 */

const MARKER_FILENAME = '.seed-org-dictionary-v1.applied';

interface DeptNode {
  value: string;
  children?: string[];
}

const DEPARTMENTS: DeptNode[] = [
  {
    value: 'C端电商',
    children: ['C端亚马逊2', 'C端TEMU1', 'C端temu2', 'C端1688', 'C端希音', 'C端亚马逊1'],
  },
  { value: 'B2B外贸' },
  { value: '辅助部门', children: ['人事行政', '财务', '仓库'] },
  {
    value: '生产部门',
    children: ['采购', '版房', '跟单', '裁床', '车缝', '尾部'],
  },
];

/** 部门 value -> 该部门下的岗位 value 列表（仅截图中可见的部门有岗位） */
const JOBS_BY_DEPT: Record<string, string[]> = {
  版房: ['纸样师', '车版师'],
  跟单: ['QC', '跟单'],
  裁床: ['电剪', '裁床主管', '外发裁床'],
  车缝: ['车缝组长', '平车', '打边', '中烫'],
  尾部: ['尾部主管', '大烫', '包装', '剪线', '尾查', '收发'],
};

function findMarkerPath(): { path: string; exists: boolean } {
  const candidates = [
    path.resolve(process.cwd(), 'scripts', MARKER_FILENAME),
    path.resolve(__dirname, '../../scripts/' + MARKER_FILENAME),
    path.resolve(__dirname, '../../../scripts/' + MARKER_FILENAME),
  ];
  const exists = candidates.find((p) => fs.existsSync(p));
  return { path: exists ?? candidates[1], exists: !!exists };
}

async function ensureOption(
  ds: DataSource,
  optionType: string,
  value: string,
  parentId: number | null,
): Promise<number> {
  const existingRows = (await ds.query(
    parentId === null
      ? `SELECT id FROM system_options WHERE option_type = ? AND value = ? AND parent_id IS NULL LIMIT 1`
      : `SELECT id FROM system_options WHERE option_type = ? AND value = ? AND parent_id = ? LIMIT 1`,
    parentId === null ? [optionType, value] : [optionType, value, parentId],
  )) as Array<{ id: number }>;
  if (existingRows.length > 0) return existingRows[0].id;

  const maxRows = (await ds.query(
    parentId === null
      ? `SELECT COALESCE(MAX(sort_order), 0) AS m FROM system_options WHERE option_type = ? AND parent_id IS NULL`
      : `SELECT COALESCE(MAX(sort_order), 0) AS m FROM system_options WHERE option_type = ? AND parent_id = ?`,
    parentId === null ? [optionType] : [optionType, parentId],
  )) as Array<{ m: number }>;
  const sortOrder = Number(maxRows[0]?.m ?? 0) + 1;

  const result = (await ds.query(
    `INSERT INTO system_options (option_type, value, sort_order, parent_id) VALUES (?, ?, ?, ?)`,
    [optionType, value, sortOrder, parentId],
  )) as { insertId: number };
  return result.insertId;
}

export async function seedOrgDictionary(dataSource: DataSource): Promise<void> {
  const marker = findMarkerPath();
  if (marker.exists) {
    console.log(`[SeedOrgDict] already applied at ${marker.path}, skip.`);
    return;
  }

  let createdDept = 0;
  let createdJob = 0;
  const deptIdByName = new Map<string, number>();

  for (const top of DEPARTMENTS) {
    const beforeTop = (
      (await dataSource.query(
        `SELECT id FROM system_options WHERE option_type = 'org_departments' AND value = ? AND parent_id IS NULL LIMIT 1`,
        [top.value],
      )) as Array<{ id: number }>
    ).length;
    const topId = await ensureOption(dataSource, 'org_departments', top.value, null);
    deptIdByName.set(top.value, topId);
    if (beforeTop === 0) createdDept += 1;
    if (top.children) {
      for (const child of top.children) {
        const beforeChild = (
          (await dataSource.query(
            `SELECT id FROM system_options WHERE option_type = 'org_departments' AND value = ? AND parent_id = ? LIMIT 1`,
            [child, topId],
          )) as Array<{ id: number }>
        ).length;
        const childId = await ensureOption(dataSource, 'org_departments', child, topId);
        deptIdByName.set(child, childId);
        if (beforeChild === 0) createdDept += 1;
      }
    }
  }

  for (const [deptName, jobs] of Object.entries(JOBS_BY_DEPT)) {
    const deptId = deptIdByName.get(deptName);
    if (!deptId) {
      console.warn(`[SeedOrgDict] dept "${deptName}" not seeded, skip its jobs.`);
      continue;
    }
    for (const job of jobs) {
      const beforeJob = (
        (await dataSource.query(
          `SELECT id FROM system_options WHERE option_type = 'org_jobs' AND value = ? AND parent_id = ? LIMIT 1`,
          [job, deptId],
        )) as Array<{ id: number }>
      ).length;
      await ensureOption(dataSource, 'org_jobs', job, deptId);
      if (beforeJob === 0) createdJob += 1;
    }
  }

  console.log(`[SeedOrgDict] done: +${createdDept} departments, +${createdJob} jobs`);
  try {
    fs.writeFileSync(marker.path, new Date().toISOString(), 'utf-8');
  } catch (e) {
    console.warn(`[SeedOrgDict] failed to write marker: ${(e as Error).message}`);
  }
}

import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 一次性把 employees 表里 Excel 老部门/岗位名字映射到系统字典里实际存在的项。
 *
 * 规则：
 *   - 部门：按 DEPT_MAPPING 把 employees.department 字符串映射到字典里实际的 value，
 *     再反查 org_departments 拿到 id，写入 employees.department_id
 *   - 岗位：FORCE_QC_DEPTS 内的部门，员工岗位强制改为 "QC"；其他员工按 employees.job_title
 *     字面直接查 org_jobs 字典
 *   - 只更新 department_id / job_title_id 为 NULL 的字段（保留用户已手动修改过的数据）
 *   - employees.department / job_title 字符串字段保留 Excel 原始名作为审计
 *
 * 幂等：在 backend/scripts/ 下写 marker 文件 .reconcile-employee-dept-job-v1.applied，
 * 存在则跳过。要重新跑：删 marker 文件 + 重启 PM2；或改 MARKER_FILENAME 版本号。
 */

const MARKER_FILENAME = '.reconcile-employee-dept-job-v5.applied';

/**
 * 映射目标：value + parent（可选）。同名字典项在不同父级下会有不同 ID
 * （本地脏字典遗留过同名顶级项），指定 parent 可精确锁定到 seed 加的项。
 */
interface MappingTarget {
  value: string;
  parent: string | null;
}

const DEPT_MAPPING: Record<string, MappingTarget> = {
  电商中心: { value: 'B2B外贸', parent: null },
  尾部: { value: '尾部', parent: '生产部门' },
  整件组: { value: '车缝', parent: '生产部门' },
  整件B组: { value: '车缝', parent: '生产部门' },
  流水组: { value: '车缝', parent: '生产部门' },
  流水1组: { value: '车缝', parent: '生产部门' },
  A组: { value: '车缝', parent: '生产部门' },
  B组: { value: '车缝', parent: '生产部门' },
  C组: { value: '车缝', parent: '生产部门' },
  裁床部: { value: '裁床', parent: '生产部门' },
  版房: { value: '版房', parent: '生产部门' },
  板房: { value: '版房', parent: '生产部门' },
  生产部: { value: '生产部门', parent: null },
  生产中心: { value: '生产部门', parent: null },
  跟单部: { value: '跟单', parent: '生产部门' },
  人事部: { value: '人事行政', parent: '辅助部门' },
  人力行政部: { value: '人事行政', parent: '辅助部门' },
  财务部: { value: '财务', parent: '辅助部门' },
  希音部: { value: 'C端希音', parent: 'C端电商' },
  IE部: { value: '跟单', parent: '生产部门' },
  物流部: { value: '仓库', parent: '辅助部门' },
  外贸业务: { value: 'B2B外贸', parent: null },
  品控部: { value: '跟单', parent: '生产部门' },
  品质部: { value: '跟单', parent: '生产部门' },
  采购部: { value: '采购', parent: '生产部门' },
  // 跳过（保持 department_id = NULL）：抖音部 / 抖音2部 / 总经办
};

const FORCE_QC_DEPTS = new Set(['IE部', '品控部', '品质部']);

const JOB_MAPPING: Record<string, MappingTarget> = {
  车板: { value: '车版师', parent: '版房' },
  车位: { value: '平车', parent: '车缝' },
  流水车位: { value: '平车', parent: '车缝' },
  纸样: { value: '纸样师', parent: '版房' },
  服装QC: { value: 'QC', parent: '跟单' },
  外发QC: { value: 'QC', parent: '跟单' },
  大烫学徒: { value: '大烫', parent: '尾部' },
};

/** QC 岗位也是跟单部门下的 */
const QC_JOB_TARGET: MappingTarget = { value: 'QC', parent: '跟单' };

interface EmployeeRow {
  id: number;
  department: string;
  jobTitle: string;
  departmentId: number | null;
  jobTitleId: number | null;
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

export async function reconcileEmployeeDeptJobIds(dataSource: DataSource): Promise<void> {
  const marker = findMarkerPath();
  if (marker.exists) {
    console.log(`[ReconcileDeptJob] already applied at ${marker.path}, skip.`);
    return;
  }

  type OptRow = { id: number; value: string; parentId: number | null };
  const deptRows = (await dataSource.query(
    `SELECT id, value, parent_id AS parentId FROM system_options WHERE option_type = 'org_departments'`,
  )) as OptRow[];
  const jobRows = (await dataSource.query(
    `SELECT id, value, parent_id AS parentId FROM system_options WHERE option_type = 'org_jobs'`,
  )) as OptRow[];

  /**
   * 查 dict ID。支持指定 parent value 精确锁定（解决本地脏字典有同名顶级项时
   * 选错的问题）。fallback 顺序：
   *   1. 精确匹配指定 parent
   *   2. 没指定 parent：优先选 parent_id 不为 null 的（即 seed/正常字典）
   *   3. 都不行取第一个
   */
  function findIdByTarget(
    rows: OptRow[],
    deptRows: OptRow[],
    target: MappingTarget,
  ): number | null {
    if (target.parent != null) {
      const parent = deptRows.find((r) => r.value === target.parent && r.parentId == null);
      if (parent) {
        const child = rows.find((r) => r.value === target.value && r.parentId === parent.id);
        if (child) return child.id;
      }
      return null;
    }
    const withParent = rows.find((r) => r.value === target.value && r.parentId != null);
    if (withParent) return withParent.id;
    return rows.find((r) => r.value === target.value)?.id ?? null;
  }

  /** 按字面查（DEPT_MAPPING/JOB_MAPPING 没列出的项用） */
  function findIdByLiteralName(rows: OptRow[], name: string): number | null {
    const withParent = rows.find((r) => r.value === name && r.parentId != null);
    if (withParent) return withParent.id;
    return rows.find((r) => r.value === name)?.id ?? null;
  }

  const qcId = findIdByTarget(jobRows, deptRows, QC_JOB_TARGET);
  if (FORCE_QC_DEPTS.size > 0 && !qcId) {
    console.warn(`[ReconcileDeptJob] 系统岗位字典里没有 "QC"，IE/品控/品质部的岗位无法映射。`);
  }

  const employees = (await dataSource.query(
    `SELECT id, department, job_title AS jobTitle,
            department_id AS departmentId, job_title_id AS jobTitleId
       FROM employees`,
  )) as EmployeeRow[];

  let deptUpdated = 0;
  let jobIdUpdated = 0;
  let jobTitleStrUpdated = 0;
  const unmatchedDept = new Set<string>();
  const unmatchedJob = new Set<string>();

  for (const emp of employees) {
    const updates: string[] = [];
    const params: unknown[] = [];

    // 部门映射：
    //   - DEPT_MAPPING 列出的 Excel 老名字 → 按 (value, parent) 精确锁定 seed 加的 ID
    //   - 没列的 → 仅当 departmentId 为 NULL 时按字面查（优先有父级的字典项）
    if (emp.department) {
      const target = DEPT_MAPPING[emp.department];
      if (target !== undefined) {
        const id = findIdByTarget(deptRows, deptRows, target);
        if (id) {
          if (id !== emp.departmentId) {
            updates.push('department_id = ?');
            params.push(id);
            deptUpdated += 1;
          }
        } else {
          unmatchedDept.add(`${emp.department} -> ${target.value}（${target.parent ?? '顶级'}）下未找到`);
        }
      } else if (emp.departmentId == null) {
        const id = findIdByLiteralName(deptRows, emp.department);
        if (id) {
          updates.push('department_id = ?');
          params.push(id);
          deptUpdated += 1;
        } else {
          unmatchedDept.add(emp.department);
        }
      }
    }

    // 岗位：FORCE_QC_DEPTS 内强制改为 QC（含字符串），其他按字面查
    if (FORCE_QC_DEPTS.has(emp.department)) {
      if (qcId) {
        if (emp.jobTitleId !== qcId) {
          updates.push('job_title_id = ?');
          params.push(qcId);
          jobIdUpdated += 1;
        }
        if (emp.jobTitle !== 'QC') {
          updates.push('job_title = ?');
          params.push('QC');
          jobTitleStrUpdated += 1;
        }
      }
    } else if (emp.jobTitle) {
      // 岗位映射：
      //   - JOB_MAPPING 列出的（错字/同义词）→ (value, parent) 精确锁定
      //   - 没列的 → 仅当 jobTitleId 为 NULL 时按字面查字典补
      const target = JOB_MAPPING[emp.jobTitle];
      if (target !== undefined) {
        const id = findIdByTarget(jobRows, deptRows, target);
        if (id) {
          if (id !== emp.jobTitleId) {
            updates.push('job_title_id = ?');
            params.push(id);
            jobIdUpdated += 1;
          }
          if (target.value !== emp.jobTitle) {
            updates.push('job_title = ?');
            params.push(target.value);
            jobTitleStrUpdated += 1;
          }
        } else {
          unmatchedJob.add(`${emp.jobTitle} -> ${target.value}（${target.parent ?? '顶级'}）下未找到`);
        }
      } else if (emp.jobTitleId == null) {
        const id = findIdByLiteralName(jobRows, emp.jobTitle);
        if (id) {
          updates.push('job_title_id = ?');
          params.push(id);
          jobIdUpdated += 1;
        } else {
          unmatchedJob.add(emp.jobTitle);
        }
      }
    }

    if (updates.length > 0) {
      params.push(emp.id);
      await dataSource.query(
        `UPDATE employees SET ${updates.join(', ')} WHERE id = ?`,
        params,
      );
    }
  }

  console.log(
    `[ReconcileDeptJob] done: departmentId+${deptUpdated} jobTitleId+${jobIdUpdated} jobTitleStr+${jobTitleStrUpdated}`,
  );
  if (unmatchedDept.size) {
    console.warn(
      `[ReconcileDeptJob] unmatched departments (${unmatchedDept.size}): ${Array.from(unmatchedDept).join(', ')}`,
    );
  }
  if (unmatchedJob.size) {
    console.warn(
      `[ReconcileDeptJob] unmatched jobs (${unmatchedJob.size}): ${Array.from(unmatchedJob).slice(0, 30).join(', ')}${unmatchedJob.size > 30 ? ' ...' : ''}`,
    );
  }

  try {
    fs.writeFileSync(marker.path, new Date().toISOString(), 'utf-8');
    console.log(`[ReconcileDeptJob] marker written: ${marker.path}`);
  } catch (e) {
    console.warn(`[ReconcileDeptJob] failed to write marker: ${(e as Error).message}`);
  }
}

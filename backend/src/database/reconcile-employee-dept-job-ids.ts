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

const MARKER_FILENAME = '.reconcile-employee-dept-job-v1.applied';

const DEPT_MAPPING: Record<string, string> = {
  电商中心: 'B2B外贸',
  尾部: '尾部',
  整件组: '车缝',
  整件B组: '车缝',
  流水组: '车缝',
  流水1组: '车缝',
  A组: '车缝',
  B组: '车缝',
  C组: '车缝',
  裁床部: '裁床',
  版房: '版房',
  板房: '版房',
  生产部: '生产部门',
  生产中心: '生产部门',
  跟单部: '跟单',
  人事部: '人事行政',
  人力行政部: '人事行政',
  财务部: '财务',
  希音部: 'C端希音',
  IE部: '跟单',
  物流部: '仓库',
  外贸业务: 'B2B外贸',
  品控部: '跟单',
  品质部: '跟单',
  采购部: '采购',
  // 跳过（保持 department_id = NULL，用户后续手动处理）:
  // 抖音部 / 抖音2部 / 总经办
};

const FORCE_QC_DEPTS = new Set(['IE部', '品控部', '品质部']);

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

  const deptRows = (await dataSource.query(
    `SELECT id, value FROM system_options WHERE option_type = 'org_departments'`,
  )) as Array<{ id: number; value: string }>;
  const jobRows = (await dataSource.query(
    `SELECT id, value FROM system_options WHERE option_type = 'org_jobs'`,
  )) as Array<{ id: number; value: string }>;
  const deptIdByName = new Map<string, number>();
  for (const r of deptRows) {
    const k = (r.value ?? '').trim();
    if (k && !deptIdByName.has(k)) deptIdByName.set(k, r.id);
  }
  const jobIdByName = new Map<string, number>();
  for (const r of jobRows) {
    const k = (r.value ?? '').trim();
    if (k && !jobIdByName.has(k)) jobIdByName.set(k, r.id);
  }

  const qcId = jobIdByName.get('QC') ?? null;
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

    // 部门：只补 department_id 为 NULL 的
    if (emp.departmentId == null && emp.department) {
      const target = DEPT_MAPPING[emp.department];
      if (target === undefined) {
        unmatchedDept.add(emp.department);
      } else if (target !== '') {
        const id = deptIdByName.get(target);
        if (id) {
          updates.push('department_id = ?');
          params.push(id);
          deptUpdated += 1;
        } else {
          unmatchedDept.add(`${emp.department} -> ${target}（字典里没有该项）`);
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
    } else if (emp.jobTitleId == null && emp.jobTitle) {
      const id = jobIdByName.get(emp.jobTitle);
      if (id) {
        updates.push('job_title_id = ?');
        params.push(id);
        jobIdUpdated += 1;
      } else {
        unmatchedJob.add(emp.jobTitle);
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

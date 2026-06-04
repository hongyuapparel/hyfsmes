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

const MARKER_FILENAME = '.reconcile-employee-dept-job-v14.applied';

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
  // 用户决策：抖音相关归到 C端电商
  抖音部: { value: 'C端电商', parent: null },
  抖音2部: { value: 'C端电商', parent: null },
  // 仍跳过（保持 department_id = NULL）：总经办
};

const FORCE_QC_DEPTS = new Set(['IE部', '品控部', '品质部']);

const JOB_MAPPING: Record<string, MappingTarget> = {
  // 错字 / 同义词
  车板: { value: '车版师', parent: '版房' },
  车位: { value: '平车', parent: '车缝' },
  流水车位: { value: '平车', parent: '车缝' },
  纸样: { value: '纸样师', parent: '版房' },
  服装QC: { value: 'QC', parent: '跟单' },
  外发QC: { value: 'QC', parent: '跟单' },
  大烫学徒: { value: '大烫', parent: '尾部' },
  // 用户决策（B2B外贸 / 外贸跟单 / 外贸业务 / 美工 / 外贸运营）
  英文跟单: { value: '外贸跟单', parent: 'B2B外贸' },
  外贸实习生: { value: '外贸业务', parent: 'B2B外贸' },
  外贸组长: { value: '外贸业务', parent: 'B2B外贸' },
  外贸主管: { value: '外贸业务', parent: 'B2B外贸' },
  设计师: { value: '美工', parent: 'B2B外贸' },
  服装设计: { value: '美工', parent: 'B2B外贸' },
  运营助理: { value: '外贸运营', parent: 'B2B外贸' },
  国际站运营: { value: '外贸运营', parent: 'B2B外贸' },
  独立站运营: { value: '外贸运营', parent: 'B2B外贸' },
  阿里运营: { value: '外贸运营', parent: 'B2B外贸' },
  // 用户决策（C端电商 / C端运营助理）
  亚马逊发货: { value: 'C端运营助理', parent: 'C端电商' },
  亚马逊助理: { value: 'C端运营助理', parent: 'C端电商' },
  亚马逊运营: { value: 'C端运营助理', parent: 'C端电商' },
  亚马逊运营助理: { value: 'C端运营助理', parent: 'C端电商' },
  亚马逊主管: { value: 'C端运营助理', parent: 'C端电商' },
  速卖通助理: { value: 'C端运营助理', parent: 'C端电商' },
  速卖通运营: { value: 'C端运营助理', parent: 'C端电商' },
  速买通运营: { value: 'C端运营助理', parent: 'C端电商' },
  运营: { value: 'C端运营助理', parent: 'C端电商' },
  抖音跟单: { value: 'C端运营助理', parent: 'C端电商' },
  // 用户决策：抖音/抖音2部 岗位
  抖音运营: { value: 'C端运营助理', parent: 'C端电商' },
  助播: { value: 'C端运营助理', parent: 'C端电商' },
  女装主播: { value: 'C端运营助理', parent: 'C端电商' },
  主播: { value: 'C端运营助理', parent: 'C端电商' },
  童装运营: { value: 'C端运营助理', parent: 'C端电商' },
  客服: { value: 'C端运营助理', parent: 'C端电商' },
  女装运营: { value: 'C端运营助理', parent: 'C端电商' },
  // 用户决策：归到生产部门下的 跟单/QC/尾查/包装
  生产跟单: { value: '跟单', parent: '跟单' },
  外发跟单: { value: '跟单', parent: '跟单' },
  跟单助理: { value: '跟单', parent: '跟单' },
  IE: { value: 'QC', parent: '跟单' },
  中查: { value: '尾查', parent: '尾部' },
  普工: { value: '包装', parent: '尾部' },
  手工: { value: '包装', parent: '尾部' },
  // 用户最终决策
  会计: { value: '财务', parent: '财务' },
  全盘会计: { value: '财务', parent: '财务' },
  采购: { value: '生产采购', parent: '采购' },
  国际站业务: { value: '外贸业务', parent: 'B2B外贸' },
  唛架: { value: '纸样师', parent: '版房' },
  唛架师: { value: '纸样师', parent: '版房' },
  放码师: { value: '纸样师', parent: '版房' },
  拉布: { value: '电剪', parent: '裁床' },
  // 用户在「人事行政」下要新建岗位 "清洁/厨师"，建好后删 v8 marker 重启即匹配
  清洁工: { value: '清洁/厨师', parent: '人事行政' },
  厨师: { value: '清洁/厨师', parent: '人事行政' },
  厨工: { value: '清洁/厨师', parent: '人事行政' },
  // 用户决策：总经办/工艺师 → QC（部门会被 align 自动改成"跟单"）
  工艺师: { value: 'QC', parent: '跟单' },
};

/** QC 岗位也是跟单部门下的 */
const QC_JOB_TARGET: MappingTarget = { value: 'QC', parent: '跟单' };

/**
 * 部门 + 岗位组合映射（仅对名字过于泛的岗位生效，如"主管"/"组长"/"经理"）。
 * 优先级高于 JOB_MAPPING；要求员工的 employees.department 字段经过 DEPT_MAPPING
 * 映射后，**字典里的部门 value** 等于这里的 key。例如裁床部员工 → 部门"裁床" →
 * "主管"在裁床下应该是"裁床主管"。
 */
const DEPT_JOB_MAPPING: Record<string, Record<string, MappingTarget>> = {
  裁床: {
    主管: { value: '裁床主管', parent: '裁床' },
  },
  车缝: {
    组长: { value: '车缝组长', parent: '车缝' },
  },
  尾部: {
    主管: { value: '尾部主管', parent: '尾部' },
  },
  人事行政: {
    主管: { value: '人事', parent: '人事行政' },
  },
  采购: {
    主管: { value: '生产采购', parent: '采购' },
  },
  C端希音: {
    组长: { value: 'C端运营', parent: 'C端电商' },
  },
  生产部门: {
    经理: { value: '生产经理', parent: '生产部门' },
  },
  B2B外贸: {
    经理: { value: '外贸经理', parent: 'B2B外贸' },
  },
};

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
      // parent 节点不一定是顶级（如"跟单"是"生产部门"的子，岗位 QC 又挂在"跟单"下）
      // 同名 parent 时优先选有父级的（即 seed 加在正确路径上的）
      const parents = deptRows.filter((r) => r.value === target.parent);
      const parent = parents.find((p) => p.parentId != null) ?? parents[0];
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

  // 把指向已删除字典项的"孤儿"引用立即 UPDATE 成 NULL 写库，避免 reconcile 主循环
  // 把这种 ID 当作"已映射"跳过、align 时找不到 parent 也跳过，最终数据库残留旧 ID。
  const validDeptIds = new Set(deptRows.map((r) => r.id));
  const validJobIds = new Set(jobRows.map((r) => r.id));
  let orphanDept = 0;
  let orphanJob = 0;
  for (const emp of employees) {
    if (emp.departmentId != null && !validDeptIds.has(emp.departmentId)) {
      await dataSource.query(
        `UPDATE employees SET department_id = NULL WHERE id = ?`,
        [emp.id],
      );
      emp.departmentId = null;
      orphanDept += 1;
    }
    if (emp.jobTitleId != null && !validJobIds.has(emp.jobTitleId)) {
      await dataSource.query(
        `UPDATE employees SET job_title_id = NULL WHERE id = ?`,
        [emp.id],
      );
      emp.jobTitleId = null;
      orphanJob += 1;
    }
  }
  if (orphanDept || orphanJob) {
    console.log(
      `[ReconcileDeptJob] cleared orphan refs: dept=${orphanDept} job=${orphanJob}`,
    );
  }

  let deptUpdated = 0;
  let jobIdUpdated = 0;
  let jobTitleStrUpdated = 0;
  const unmatchedDept = new Set<string>();
  const unmatchedJob = new Set<string>();

  for (const emp of employees) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let newDeptValue: string | null = null;

    // 部门映射：
    //   - DEPT_MAPPING 列出的 Excel 老名字 → 按 (value, parent) 精确锁定 seed 加的 ID
    //   - 没列的 → 仅当 departmentId 为 NULL 时按字面查（优先有父级的字典项）
    if (emp.department) {
      const target = DEPT_MAPPING[emp.department];
      if (target !== undefined) {
        const id = findIdByTarget(deptRows, deptRows, target);
        if (id) {
          newDeptValue = target.value;
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
          newDeptValue = deptRows.find((r) => r.id === id)?.value ?? null;
          updates.push('department_id = ?');
          params.push(id);
          deptUpdated += 1;
        } else {
          unmatchedDept.add(emp.department);
        }
      } else {
        // 已有 departmentId，反查字典 value 以供 DEPT_JOB_MAPPING 使用
        newDeptValue = deptRows.find((r) => r.id === emp.departmentId)?.value ?? null;
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
      // 岗位映射优先级：
      //   1. DEPT_JOB_MAPPING[映射后部门][jobTitle] — 按部门细分（如裁床/主管 → 裁床主管）
      //   2. JOB_MAPPING[jobTitle] — 全局错字/同义词
      //   3. 字面查字典（仅 jobTitleId 为 NULL）
      const deptJobTarget =
        newDeptValue != null ? DEPT_JOB_MAPPING[newDeptValue]?.[emp.jobTitle] : undefined;
      const target = deptJobTarget ?? JOB_MAPPING[emp.jobTitle];
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

  // 部门-岗位一致性对齐：用员工最终的 job_title_id 反查字典 parent_id，
  // 强制 department_id = 岗位所在的字典部门（解决"电商中心员工挂 C端岗位
  // 但部门字段是 B2B外贸"这类不一致）
  const afterEmployees = (await dataSource.query(
    `SELECT id, department_id AS departmentId, job_title_id AS jobTitleId
       FROM employees WHERE job_title_id IS NOT NULL`,
  )) as Array<{ id: number; departmentId: number | null; jobTitleId: number }>;
  let alignedDept = 0;
  for (const emp of afterEmployees) {
    const jobOpt = jobRows.find((r) => r.id === emp.jobTitleId);
    if (jobOpt && jobOpt.parentId != null && jobOpt.parentId !== emp.departmentId) {
      await dataSource.query(
        `UPDATE employees SET department_id = ? WHERE id = ?`,
        [jobOpt.parentId, emp.id],
      );
      alignedDept += 1;
    }
  }

  console.log(
    `[ReconcileDeptJob] done: departmentId+${deptUpdated} jobTitleId+${jobIdUpdated} jobTitleStr+${jobTitleStrUpdated} alignedDept+${alignedDept}`,
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

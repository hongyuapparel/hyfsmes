<template>
  <div class="page-card">
    <p class="settings-hint">
      配置订单相关下拉选项，如订单类型、合作方式、产品分组、物料类型等，这些选项会在订单相关页面中统一复用，保证含义和取值一致。生产工序用于订单成本页勾选并汇总工序单价。
    </p>

    <div class="settings-body">
      <el-tabs v-model="activeTab" tab-position="left" class="settings-tabs">
        <el-tab-pane label="订单类型" name="orderTypes" />
        <el-tab-pane label="合作方式" name="collaboration" />
        <el-tab-pane label="产品分组" name="productGroups" />
        <el-tab-pane label="物料类型" name="materialTypes" />
        <el-tab-pane label="生产工序" name="productionProcesses" />
      </el-tabs>

      <div class="settings-content">
        <template v-if="activeTab === 'orderTypes'">
          <h3 class="section-title">订单类型</h3>
          <OptionList type="order_types" label="订单类型" />
        </template>

        <template v-else-if="activeTab === 'collaboration'">
          <h3 class="section-title">合作方式</h3>
          <OptionList type="collaboration" label="合作方式" />
        </template>

        <template v-else-if="activeTab === 'productGroups'">
          <h3 class="section-title">产品分组</h3>
          <OptionList type="product_groups" label="产品分组" />
        </template>

        <template v-else-if="activeTab === 'materialTypes'">
          <h3 class="section-title">物料类型</h3>
          <OptionList type="material_types" label="物料类型" />
        </template>

        <template v-else>
          <h3 class="section-title">生产工序</h3>
          <p class="section-desc">部门为固定根（裁床、车缝、尾部），在其下维护工种及多级子分组；工序列表为具体工序与单价。</p>

          <h4 class="subsection-title">部门 · 工种（父分组可多级子分组）</h4>
          <OptionList
            :key="processJobTypeTreeKey"
            type="process_job_types"
            label="名称"
            :hide-top-level-button="true"
          />

          <h4 class="subsection-title">工序列表（树形懒加载）</h4>
          <div class="process-actions">
            <el-button type="primary" size="small" @click="openProcessDialog()">新增工序</el-button>
          </div>
          <el-table
            ref="processTreeTableRef"
            :data="processTreeData"
            row-key="id"
            border
            size="small"
            class="process-table"
            lazy
            :load="loadProcessTreeNode"
            :tree-props="{ hasChildren: 'hasChildren', children: 'children' }"
          >
            <el-table-column label="部门" prop="department" width="100" />
            <el-table-column label="工种" prop="jobType" min-width="120" />
            <el-table-column label="生产工序" prop="processName" min-width="120" />
            <el-table-column label="价格(元)" prop="price" width="100" align="right" />
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <template v-if="row.rowType === 'process'">
                  <el-button link type="primary" size="small" @click="openProcessDialog(row.processRow)">编辑</el-button>
                  <el-button link type="danger" size="small" @click="removeProcess(row.processRow!)">删除</el-button>
                </template>
                <template v-else-if="row.rowType === 'job_type'">
                  <el-button link type="primary" size="small" @click="openProcessDialog(undefined, row)">新增工序</el-button>
                </template>
              </template>
            </el-table-column>
          </el-table>
          <el-dialog
            v-model="processDialog.visible"
            :title="processDialog.id ? '编辑工序' : '新增工序'"
            width="440px"
            @close="processDialog.id = undefined"
          >
            <el-form :model="processForm" label-width="90px" size="default">
              <el-form-item label="部门">
                <el-select v-model="processForm.department" placeholder="选择部门" clearable style="width: 100%" @change="onProcessDepartmentChange">
                  <el-option v-for="d in processDepartments" :key="d" :label="d" :value="d" />
                </el-select>
              </el-form-item>
              <el-form-item label="工种">
                <el-select v-model="processForm.jobType" placeholder="先选部门后选择工种" clearable filterable style="width: 100%" :disabled="!processForm.department">
                  <el-option v-for="j in processJobTypeOptions" :key="j" :label="j" :value="j" />
                </el-select>
              </el-form-item>
              <el-form-item label="工序名称">
                <el-input v-model="processForm.name" placeholder="如：开裁、拼缝" />
              </el-form-item>
              <el-form-item label="单价(元)">
                <el-input-number v-model="processForm.unitPrice" :min="0" :precision="2" :controls="false" style="width: 100%" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="processDialog.visible = false">取消</el-button>
              <el-button type="primary" @click="submitProcess">确定</el-button>
            </template>
          </el-dialog>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import OptionList from './product-option-list.vue'
import {
  getProductionProcesses,
  createProductionProcess,
  updateProductionProcess,
  deleteProductionProcess,
  type ProductionProcessItem,
} from '@/api/production-processes'
import {
  getSystemOptionsTree,
  createSystemOption,
  type SystemOptionTreeNode,
} from '@/api/system-options'

/** 树表行：部门 / 工种 / 工序（懒加载用） */
interface ProcessTreeRow {
  id: string | number
  rowType: 'department' | 'job_type' | 'process'
  department: string
  jobType: string
  processName: string
  price: string
  hasChildren: boolean
  nodeId?: number
  jobTypePath?: string
  processRow?: ProductionProcessItem
}

const processDepartments = ['裁床', '车缝', '尾部'] as const
const processJobTypeTreeKey = ref(0)

const activeTab = ref<'orderTypes' | 'collaboration' | 'productGroups' | 'materialTypes' | 'productionProcesses'>('orderTypes')
const processTreeTableRef = ref<InstanceType<typeof import('element-plus')['ElTable']>>()
const processTreeData = ref<ProcessTreeRow[]>([])
const processJobTypeTreeRef = ref<SystemOptionTreeNode[]>([])
const processJobTypeNodeMap = ref<Map<number, SystemOptionTreeNode>>(new Map())

const processDialog = ref<{ visible: boolean; id?: number }>({ visible: false })
const processForm = ref({
  department: '',
  jobType: '',
  name: '',
  unitPrice: 0,
  sortOrder: 0,
})
const processJobTypeOptions = ref<string[]>([])

function buildNodeMap(nodes: SystemOptionTreeNode[], map: Map<number, SystemOptionTreeNode>) {
  for (const n of nodes) {
    map.set(n.id, n)
    if (n.children?.length) buildNodeMap(n.children, map)
  }
}

/** 树表根节点：部门（来自 process_job_types 根） */
async function loadProcessTreeRoots() {
  try {
    const res = await getSystemOptionsTree('process_job_types')
    const tree = res.data ?? []
    processJobTypeTreeRef.value = tree
    const map = new Map<number, SystemOptionTreeNode>()
    buildNodeMap(tree, map)
    processJobTypeNodeMap.value = map
    processTreeData.value = tree.map((n) => ({
      id: `dept-${n.id}`,
      rowType: 'department' as const,
      department: n.value,
      jobType: '',
      processName: '',
      price: '',
      hasChildren: true,
      nodeId: n.id,
    }))
  } catch {
    processTreeData.value = []
  }
}

/** 树表懒加载：展开部门加载工种，展开工种加载工序 */
async function loadProcessTreeNode(
  row: ProcessTreeRow,
  treeNode: { level: number; expanded: boolean },
  resolve: (rows: ProcessTreeRow[]) => void,
) {
  if (row.rowType === 'department' && row.nodeId != null) {
    const node = processJobTypeNodeMap.value.get(row.nodeId)
    const children = node?.children ?? []
    const rows: ProcessTreeRow[] = children.map((c) => ({
      id: `job-${c.id}`,
      rowType: 'job_type' as const,
      department: row.department,
      jobType: `${row.department} > ${c.value}`,
      processName: '',
      price: '',
      hasChildren: true,
      nodeId: c.id,
      jobTypePath: `${row.department} > ${c.value}`,
    }))
    resolve(rows)
    return
  }
  if (row.rowType === 'job_type' && row.nodeId != null && row.jobTypePath != null) {
    const node = processJobTypeNodeMap.value.get(row.nodeId)
    if (node?.children?.length) {
      const rows: ProcessTreeRow[] = node.children.map((c) => ({
        id: `job-${c.id}`,
        rowType: 'job_type' as const,
        department: row.department,
        jobType: `${row.jobTypePath} > ${c.value}`,
        processName: '',
        price: '',
        hasChildren: true,
        nodeId: c.id,
        jobTypePath: `${row.jobTypePath} > ${c.value}`,
      }))
      resolve(rows)
      return
    }
    const res = await getProductionProcesses({ department: row.department, jobType: row.jobTypePath })
    const list = res.data ?? []
    const rows: ProcessTreeRow[] = list.map((p) => ({
      id: p.id,
      rowType: 'process' as const,
      department: p.department,
      jobType: p.jobType,
      processName: p.name,
      price: p.unitPrice,
      hasChildren: false,
      processRow: p,
    }))
    resolve(rows)
  }
}

/** 从部门根节点递归收集所有后代路径，如 裁床 > 裁工、裁床 > 裁工 > 细分 */
function collectJobTypePaths(nodes: SystemOptionTreeNode[], parentPath = ''): string[] {
  const list: string[] = []
  for (const n of nodes) {
    const path = parentPath ? `${parentPath} > ${n.value}` : n.value
    list.push(path)
    if (n.children?.length) list.push(...collectJobTypePaths(n.children, path))
  }
  return list
}

async function loadProcessJobTypeOptions(department: string) {
  if (!department) {
    processJobTypeOptions.value = []
    return
  }
  try {
    const res = await getSystemOptionsTree('process_job_types')
    const tree = res.data ?? []
    const root = tree.find((n) => n.value === department)
    if (!root) {
      processJobTypeOptions.value = []
      return
    }
    // 只取该部门下的后代路径（不含部门名本身），用于下拉选项
    const paths = root.children?.length
      ? collectJobTypePaths(root.children, department)
      : []
    processJobTypeOptions.value = paths
  } catch {
    processJobTypeOptions.value = []
  }
}

function onProcessDepartmentChange() {
  processForm.value.jobType = ''
  loadProcessJobTypeOptions(processForm.value.department)
}

/** 确保 process_job_types 下存在三个根节点：裁床、车缝、尾部 */
async function ensureProcessJobTypeRoots() {
  try {
    const res = await getSystemOptionsTree('process_job_types')
    const tree = res.data ?? []
    const values = new Set(tree.map((n) => n.value))
    const toAdd = processDepartments.filter((d) => !values.has(d))
    for (let i = 0; i < toAdd.length; i++) {
      await createSystemOption({
        type: 'process_job_types',
        value: toAdd[i],
        sort_order: tree.length + i,
        parent_id: null,
      })
    }
    if (toAdd.length > 0) processJobTypeTreeKey.value += 1
  } catch {
    // ignore
  }
}

watch(activeTab, async (tab) => {
  if (tab === 'productionProcesses') {
    await ensureProcessJobTypeRoots()
    loadProcessTreeRoots()
  }
})

async function openProcessDialog(row?: ProductionProcessItem, treeRow?: ProcessTreeRow) {
  if (row) {
    processDialog.value = { visible: true, id: row.id }
    processForm.value = {
      department: row.department ?? '',
      jobType: row.jobType ?? '',
      name: row.name ?? '',
      unitPrice: Number(row.unitPrice) || 0,
      sortOrder: row.sortOrder ?? 0,
    }
    await loadProcessJobTypeOptions(processForm.value.department)
  } else {
    processDialog.value = { visible: true }
    const dept = treeRow?.department ?? ''
    const job = treeRow?.jobTypePath ?? treeRow?.jobType ?? ''
    processForm.value = {
      department: dept,
      jobType: job,
      name: '',
      unitPrice: 0,
      sortOrder: 0,
    }
    if (dept) await loadProcessJobTypeOptions(dept)
    else processJobTypeOptions.value = []
  }
}

async function submitProcess() {
  const name = processForm.value.name?.trim()
  if (!name) {
    ElMessage.warning('请填写工序名称')
    return
  }
  try {
    if (processDialog.value.id) {
      await updateProductionProcess(processDialog.value.id, {
        department: processForm.value.department,
        jobType: processForm.value.jobType,
        name: processForm.value.name,
        unitPrice: String(processForm.value.unitPrice),
      })
      ElMessage.success('已更新')
    } else {
      await createProductionProcess({
        department: processForm.value.department,
        jobType: processForm.value.jobType,
        name: processForm.value.name,
        unitPrice: String(processForm.value.unitPrice),
      })
      ElMessage.success('已新增')
    }
    processDialog.value.visible = false
    loadProcessTreeRoots()
  } catch (e: unknown) {
    ElMessage.error((e as { message?: string })?.message ?? '操作失败')
  }
}

async function removeProcess(row: ProductionProcessItem) {
  try {
    await ElMessageBox.confirm(`确定删除工序「${row.name}」？`, '删除确认', {
      type: 'warning',
    })
    await deleteProductionProcess(row.id)
    ElMessage.success('已删除')
    loadProcessTreeRoots()
  } catch (e) {
    if ((e as string) !== 'cancel') ElMessage.error('删除失败')
  }
}
</script>

<style scoped>
.settings-hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
  margin-bottom: var(--space-md);
  line-height: 1.6;
}

.settings-body {
  display: flex;
  align-items: flex-start;
}

.settings-tabs {
  width: 160px;
  margin-right: var(--space-lg);
}

.settings-content {
  flex: 1;
  min-width: 0;
}

.section-title {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-body);
  font-weight: 600;
}

.section-desc {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
  margin: 0 0 var(--space-sm);
}

.subsection-title {
  font-size: var(--font-size-caption);
  font-weight: 600;
  margin: var(--space-md) 0 var(--space-xs);
}

.process-actions {
  margin-bottom: var(--space-sm);
}

.process-table {
  font-size: var(--font-size-body);
}
</style>


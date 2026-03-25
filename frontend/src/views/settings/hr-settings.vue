<template>
  <div class="page-card">
    <p class="settings-hint">
      维护公司组织架构：左侧为部门树，右侧为选中部门下的岗位列表。人事管理等页面将复用这里的配置，通过 ID 关联，改名后历史数据自动同步。
    </p>

    <div class="settings-body">
      <div class="org-tree-wrap">
        <h3 class="section-title">
          部门
          <span class="section-subtitle">（{{ deptCount }}）</span>
        </h3>
        <div class="org-toolbar">
          <el-button type="primary" size="small" @click="openDeptDialog(null)">新增顶级部门</el-button>
          <el-button
            size="small"
            :disabled="!currentDept"
            @click="openAddChildDept()"
          >
            新增子部门
          </el-button>
        </div>
        <div class="dept-panel">
          <el-tree
            v-loading="deptLoading"
            :data="deptTree"
            node-key="id"
            highlight-current
            default-expand-all
            draggable
            :props="{ label: 'label', children: 'children' }"
            class="dept-tree"
            :allow-drag="allowDeptDrag"
            :allow-drop="allowDeptDrop"
            @current-change="onDeptChange"
            @node-drop="onDeptDrop"
            @node-drag-end="onDeptDragEnd"
          >
            <template #default="{ data }">
              <span class="tree-node">
                <span class="option-drag-handle" title="拖拽调整顺序" @mousedown.stop="enableDeptDrag(data.id)">
                  ≡
                </span>
                <span class="tree-node-label">{{ data.label }}</span>
                <span class="tree-node-actions">
                  <el-button link type="primary" size="small" @click.stop="openDeptDialog(data)">
                    编辑
                  </el-button>
                  <el-button
                    link
                    type="danger"
                    size="small"
                    @click.stop="removeDept(data)"
                  >
                    删除
                  </el-button>
                </span>
              </span>
            </template>
          </el-tree>
        </div>
      </div>

      <div class="org-jobs-wrap">
        <h3 class="section-title">
          岗位
          <span v-if="currentDept" class="section-subtitle">
            （当前部门：{{ currentDept.label }}）
          </span>
        </h3>
        <p v-if="!currentDept" class="section-desc">请先在左侧选择一个部门，再维护该部门下的岗位。</p>
        <template v-else>
          <div class="org-toolbar">
            <el-button type="primary" size="small" @click="openJobDialog(null)">新增岗位</el-button>
          </div>
          <el-table
            v-loading="jobLoading"
            :data="jobList"
            size="small"
            border
            row-key="id"
            class="jobs-table"
          >
            <el-table-column prop="label" label="岗位名称" min-width="160" />
            <el-table-column prop="description" label="说明" min-width="200" show-overflow-tooltip />
            <el-table-column prop="sortOrder" label="排序" width="80" />
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openJobDialog(row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="removeJob(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </div>
    </div>

    <el-dialog v-model="deptDialog.visible" :title="deptDialogTitle" width="400px" @close="resetDeptDialog">
      <el-form :model="deptForm" label-width="80px" size="default">
        <el-form-item label="部门名称">
          <el-input v-model="deptForm.label" placeholder="如：生产部 / 外贸部" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deptDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="deptDialog.submitting" @click="submitDept">
          确定
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="jobDialog.visible" :title="jobDialogTitle" width="400px" @close="resetJobDialog">
      <el-form :model="jobForm" label-width="80px" size="default">
        <el-form-item label="岗位名称">
          <el-input v-model="jobForm.label" placeholder="如：版师 / 业务员 / 车缝工" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input
            v-model="jobForm.description"
            type="textarea"
            :rows="2"
            placeholder="选填：岗位职责说明"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="jobDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="jobDialog.submitting" @click="submitJob">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getSystemOptionsTree,
  getSystemOptionsList,
  createSystemOption,
  updateSystemOption,
  deleteSystemOption,
  batchUpdateSystemOptionOrder,
  type SystemOptionTreeNode,
  type SystemOptionItem,
} from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const ORG_DEPT_TYPE = 'org_departments'
const ORG_JOB_TYPE = 'org_jobs'

interface DeptTreeNode {
  id: number
  label: string
  sortOrder: number
  parentId: number | null
  children?: DeptTreeNode[]
}

interface JobItem {
  id: number
  label: string
  sortOrder: number
  parentId: number
  description?: string
}

const deptLoading = ref(false)
const jobLoading = ref(false)
const deptTree = ref<DeptTreeNode[]>([])
const currentDept = ref<DeptTreeNode | null>(null)
const jobList = ref<JobItem[]>([])

const deptDialog = reactive({ visible: false, submitting: false, editingId: 0, parentId: null as number | null })
const deptForm = reactive({ label: '' })
const deptDialogTitle = computed(() => (deptDialog.editingId ? '编辑部门' : deptDialog.parentId ? '新增子部门' : '新增顶级部门'))
const dragEnabledDeptId = ref<number | null>(null)
const deptCount = computed(() => {
  function count(nodes: DeptTreeNode[]): number {
    return nodes.reduce((sum, n) => sum + 1 + count(n.children ?? []), 0)
  }
  return count(deptTree.value)
})

const jobDialog = reactive({ visible: false, submitting: false, editingId: 0 })
const jobForm = reactive({ label: '', description: '' })
const jobDialogTitle = computed(() => (jobDialog.editingId ? '编辑岗位' : '新增岗位'))

async function loadDepartments() {
  deptLoading.value = true
  try {
    const res = await getSystemOptionsTree(ORG_DEPT_TYPE)
    const data = (res.data ?? []) as SystemOptionTreeNode[]
    const convert = (nodes: SystemOptionTreeNode[]): DeptTreeNode[] =>
      nodes.map((n) => ({
        id: n.id,
        label: n.value,
        sortOrder: n.sortOrder,
        parentId: n.parentId ?? null,
        children: n.children ? convert(n.children) : [],
      }))
    deptTree.value = convert(data)
    if (currentDept.value) {
      const found = findDeptById(currentDept.value.id, deptTree.value)
      currentDept.value = found ?? null
    }
  } catch (e: unknown) {
    deptTree.value = []
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    deptLoading.value = false
  }
}

function findDeptById(id: number, tree: DeptTreeNode[]): DeptTreeNode | null {
  for (const n of tree) {
    if (n.id === id) return n
    if (n.children?.length) {
      const found = findDeptById(id, n.children)
      if (found) return found
    }
  }
  return null
}

function isDescendantOf(node: DeptTreeNode, maybeAncestorId: number): boolean {
  if (node.id === maybeAncestorId) return true
  if (!node.children?.length) return false
  return node.children.some((c) => isDescendantOf(c, maybeAncestorId))
}

function allowDeptDrop(
  draggingNode: { data: DeptTreeNode },
  dropNode: { data: DeptTreeNode },
  type: 'prev' | 'next' | 'inner',
) {
  if (type !== 'inner') return true
  // 禁止把节点拖到自己的后代里，避免形成循环树
  return !isDescendantOf(draggingNode.data, dropNode.data.id)
}

function allowDeptDrag(node: { data?: DeptTreeNode }) {
  return dragEnabledDeptId.value != null && dragEnabledDeptId.value === (node.data?.id ?? null)
}

function enableDeptDrag(id: number) {
  dragEnabledDeptId.value = id
}

function onDeptDragEnd() {
  dragEnabledDeptId.value = null
}

function getSiblingNodes(parentId: number | null): DeptTreeNode[] {
  if (parentId == null) return deptTree.value
  const parent = findDeptById(parentId, deptTree.value)
  return parent?.children ?? []
}

async function syncSiblingOrder(parentId: number | null) {
  const siblings = getSiblingNodes(parentId)
  const items = siblings.map((n, idx) => ({ id: n.id, sort_order: idx }))
  await batchUpdateSystemOptionOrder(ORG_DEPT_TYPE, parentId, items)
}

async function onDeptDrop(
  draggingNode: { data: DeptTreeNode },
  dropNode: { data: DeptTreeNode; parent?: { data?: DeptTreeNode } },
  dropType: 'before' | 'after' | 'inner',
) {
  const dragged = draggingNode.data
  const oldParentId = dragged.parentId ?? null
  const newParentId = dropType === 'inner' ? dropNode.data.id : (dropNode.parent?.data?.id ?? null)

  try {
    if (oldParentId !== newParentId) {
      await updateSystemOption(dragged.id, { parent_id: newParentId })
      dragged.parentId = newParentId
    }
    await syncSiblingOrder(newParentId)
    if (oldParentId !== newParentId) await syncSiblingOrder(oldParentId)
    ElMessage.success('部门顺序已更新')
    await loadDepartments()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    await loadDepartments()
  }
}

function onDeptChange(node: DeptTreeNode | null) {
  currentDept.value = node
  if (node) {
    loadJobs(node.id)
  } else {
    jobList.value = []
  }
}

async function loadJobs(deptId: number) {
  jobLoading.value = true
  try {
    const res = await getSystemOptionsList(ORG_JOB_TYPE)
    const all = (res.data ?? []) as SystemOptionItem[]
    jobList.value = all
      .filter((j) => j.parentId === deptId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map((j) => ({
        id: j.id,
        label: j.value,
        sortOrder: j.sortOrder,
        parentId: j.parentId as number,
      }))
  } catch (e: unknown) {
    jobList.value = []
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    jobLoading.value = false
  }
}

function openDeptDialog(node: DeptTreeNode | null) {
  if (node) {
    deptDialog.editingId = node.id
    deptDialog.parentId = null
    deptForm.label = node.label
  } else {
    deptDialog.editingId = 0
    deptDialog.parentId = currentDept.value ? currentDept.value.id : null
    deptForm.label = ''
  }
  deptDialog.visible = true
}

function openAddChildDept() {
  if (!currentDept.value) return
  deptDialog.editingId = 0
  deptDialog.parentId = currentDept.value.id
  deptForm.label = ''
  deptDialog.visible = true
}

function resetDeptDialog() {
  deptDialog.editingId = 0
  deptDialog.parentId = null
  deptForm.label = ''
}

async function submitDept() {
  const label = deptForm.label?.trim()
  if (!label) {
    ElMessage.warning('请输入部门名称')
    return
  }
  deptDialog.submitting = true
  try {
    if (deptDialog.editingId) {
      await updateSystemOption(deptDialog.editingId, { value: label })
      ElMessage.success('保存成功')
    } else {
      await createSystemOption({
        type: ORG_DEPT_TYPE,
        value: label,
        parent_id: deptDialog.parentId ?? undefined,
      })
      ElMessage.success('新增成功')
    }
    deptDialog.visible = false
    await loadDepartments()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    deptDialog.submitting = false
  }
}

async function removeDept(node: DeptTreeNode) {
  try {
    await ElMessageBox.confirm(
      node.children?.length
        ? `确定删除部门「${node.label}」及其所有子部门？`
        : `确定删除部门「${node.label}」？`,
      '提示',
      { type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await deleteSystemOption(node.id)
    if (currentDept.value?.id === node.id) {
      currentDept.value = null
      jobList.value = []
    }
    await loadDepartments()
    ElMessage.success('已删除')
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

function openJobDialog(row: JobItem | null) {
  if (!currentDept.value) {
    ElMessage.warning('请先选择部门')
    return
  }
  if (row) {
    jobDialog.editingId = row.id
    jobForm.label = row.label
    jobForm.description = row.description ?? ''
  } else {
    jobDialog.editingId = 0
    jobForm.label = ''
    jobForm.description = ''
  }
  jobDialog.visible = true
}

function resetJobDialog() {
  jobDialog.editingId = 0
  jobForm.label = ''
  jobForm.description = ''
}

async function submitJob() {
  if (!currentDept.value) {
    ElMessage.warning('请先选择部门')
    return
  }
  const label = jobForm.label?.trim()
  if (!label) {
    ElMessage.warning('请输入岗位名称')
    return
  }
  jobDialog.submitting = true
  try {
    if (jobDialog.editingId) {
      await updateSystemOption(jobDialog.editingId, { value: label })
      ElMessage.success('保存成功')
    } else {
      const sortOrder = jobList.value.length
      await createSystemOption({
        type: ORG_JOB_TYPE,
        value: label,
        parent_id: currentDept.value.id,
        sort_order: sortOrder,
      })
      ElMessage.success('新增成功')
    }
    jobDialog.visible = false
    await loadJobs(currentDept.value.id)
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    jobDialog.submitting = false
  }
}

async function removeJob(row: JobItem) {
  try {
    await ElMessageBox.confirm(`确定删除岗位「${row.label}」？`, '提示', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteSystemOption(row.id)
    if (currentDept.value) await loadJobs(currentDept.value.id)
    ElMessage.success('已删除')
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

onMounted(() => {
  loadDepartments()
})
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
  align-items: stretch;
  gap: var(--space-lg);
}

.org-tree-wrap {
  width: 360px;
  min-width: 360px;
  flex: 0 0 360px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.org-jobs-wrap {
  flex: 1;
}

.section-title {
  font-size: var(--font-size-subtitle);
  margin-bottom: var(--space-xs);
}

.section-subtitle {
  margin-left: 8px;
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
}

.section-desc {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
  margin-bottom: var(--space-sm);
}

.org-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
}

.dept-panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-base);
  padding: var(--space-xs);
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.dept-tree :deep(.el-tree-node__content) {
  height: 38px;
  border-radius: 8px;
  padding-right: 8px;
}

.dept-tree :deep(.el-tree-node__content:hover) {
  background: var(--color-bg-subtle, #f5f6f8);
}

.dept-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: color-mix(in srgb, var(--el-color-primary) 10%, #fff);
}

.tree-node {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
}

.option-drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  line-height: 24px;
  color: var(--el-text-color-secondary);
  cursor: grab;
  flex: 0 0 auto;
  user-select: none;
}

.option-drag-handle:active {
  cursor: grabbing;
}

.tree-node-label {
  font-size: var(--font-size-body);
  color: var(--color-text-primary);
  flex: 1;
  min-width: 0;
}

.tree-node-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 1;
}

.tree-node-actions :deep(.el-button--primary) {
  color: var(--el-color-primary);
}

.tree-node-actions :deep(.el-button--danger) {
  color: var(--el-color-danger);
}

.jobs-table {
  margin-top: var(--space-xs);
}
</style>


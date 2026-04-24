<template>
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
          <el-table-column label="操作" width="160">
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
</template>

<script setup lang="ts">
import { useHrSettings } from '@/composables/useHrSettings'

const {
  deptLoading,
  jobLoading,
  deptTree,
  currentDept,
  jobList,
  deptDialog,
  deptForm,
  deptDialogTitle,
  deptCount,
  jobDialog,
  jobForm,
  jobDialogTitle,
  allowDeptDrop,
  allowDeptDrag,
  enableDeptDrag,
  onDeptDragEnd,
  onDeptDrop,
  onDeptChange,
  openDeptDialog,
  openAddChildDept,
  resetDeptDialog,
  submitDept,
  removeDept,
  openJobDialog,
  resetJobDialog,
  submitJob,
  removeJob,
} = useHrSettings()
</script>

<style scoped>
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

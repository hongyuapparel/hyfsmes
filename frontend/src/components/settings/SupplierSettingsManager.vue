<template>
  <div class="settings-body">
    <div class="option-toolbar">
      <el-button type="primary" size="small" @click="openAdd(null)">添加供应商类型</el-button>
    </div>
    <div v-if="treeData.length === 0" class="option-empty">暂无配置，点击「添加供应商类型」新增</div>
    <el-table
      v-else
      ref="tableRef"
      :data="treeData"
      row-key="id"
      border
      class="option-table"
      lazy
      :load="loadChildren"
      :row-class-name="getRowClassName"
      :tree-props="{ hasChildren: 'hasChildren', children: 'children' }"
    >
      <el-table-column label="供应商类型" min-width="200">
        <template #default="{ row }">
          <span v-if="row.level === 0">{{ row.value }}</span>
        </template>
      </el-table-column>
      <el-table-column label="业务范围" min-width="220">
        <template #default="{ row }">
          <span v-if="row.level === 0" class="scope-empty">—</span>
          <span v-else class="scope-label" :class="`scope-level-${row.level}`">
            <el-icon
              v-if="row.level === 1 && row.hasChildren"
              class="scope-expand-icon"
              :class="{ expanded: isExpanded(row.id) }"
              @click.stop="toggleScopeExpand(row)"
            >
              <ArrowRight />
            </el-icon>
            <span v-else-if="row.level > 1" class="scope-branch">└</span>
            <span>{{ row.value }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="320" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button v-if="row.level < 2" link type="primary" size="small" @click="openAdd(row.id, row.level)">
            {{ row.level === 0 ? '添加父分组' : '添加子分组' }}
          </el-button>
          <el-button link size="small" :disabled="!canMoveUp(row)" @click="moveRow(row, -1)">
            上移
          </el-button>
          <el-button link size="small" :disabled="!canMoveDown(row)" @click="moveRow(row, 1)">
            下移
          </el-button>
          <el-tooltip content="删除" placement="top">
            <el-button link type="danger" size="small" circle @click="remove(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑' : getAddTitle()"
      width="400"
      @close="onDialogClose"
    >
      <el-form label-width="110px">
        <template v-if="isEdit && addLevel > 0">
          <el-form-item label="供应商类型">
            <el-select
              v-model="editSupplierTypeId"
              placeholder="请选择供应商类型"
              style="width: 100%"
              @change="onEditSupplierTypeChange"
            >
              <el-option
                v-for="opt in editSupplierTypeOptions"
                :key="opt.id"
                :label="opt.label"
                :value="opt.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="父分组">
            <el-select
              v-model="editParentGroupId"
              clearable
              placeholder="不选则直属当前供应商类型"
              style="width: 100%"
            >
              <el-option
                v-for="opt in editParentGroupOptions"
                :key="opt.id"
                :label="opt.label"
                :value="opt.id"
              />
            </el-select>
          </el-form-item>
        </template>
        <el-form-item :label="getAddLabel()">
          <el-input
            v-model="form.value"
            :placeholder="`请输入${getAddLabel()}`"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ArrowRight, Delete } from '@element-plus/icons-vue'
import { useSupplierSettings } from '@/composables/useSupplierSettings'

const {
  treeData,
  tableRef,
  dialogVisible,
  isEdit,
  addLevel,
  form,
  submitLoading,
  editSupplierTypeId,
  editParentGroupId,
  editSupplierTypeOptions,
  editParentGroupOptions,
  loadChildren,
  getRowClassName,
  isExpanded,
  toggleScopeExpand,
  canMoveUp,
  canMoveDown,
  getAddLabel,
  getAddTitle,
  onEditSupplierTypeChange,
  onDialogClose,
  openAdd,
  openEdit,
  submit,
  remove,
  moveRow,
} = useSupplierSettings()
</script>

<style scoped>
.settings-body {
  padding-top: var(--space-sm);
}

.option-toolbar {
  margin-bottom: var(--space-sm);
}

.option-empty {
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
  padding: var(--space-lg);
}

.option-table {
  margin-top: var(--space-xs);
}

.scope-empty {
  color: var(--color-text-muted);
}

.scope-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.scope-expand-icon {
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: transform 0.2s;
}

.scope-expand-icon.expanded {
  transform: rotate(90deg);
}

.scope-level-1 {
  color: var(--color-text-primary);
}

.scope-level-2 {
  padding-left: 12px;
  color: var(--color-text-secondary);
}

.scope-branch {
  color: var(--color-text-muted);
}

.option-table :deep(.row-level-1 .el-table__expand-icon) {
  display: none;
}
</style>

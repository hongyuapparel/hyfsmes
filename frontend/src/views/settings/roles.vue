<template>
  <div class="page-card">
    <h3 class="section-title">角色列表</h3>
    <div class="toolbar">
      <el-button type="primary" @click="openCreate">新增角色</el-button>
    </div>
    <el-table ref="roleTableRef" :data="list" border stripe row-key="id">
      <el-table-column label="" width="52">
        <template #default>
          <span class="role-drag-handle" title="拖拽排序">::</span>
        </template>
      </el-table-column>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="code" label="编码" width="140" />
      <el-table-column prop="name" label="名称" width="140" />
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-tooltip content="删除" placement="top">
            <el-button link type="danger" size="small" circle :disabled="row.code === 'admin'" @click="removeRole(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <RolesPermissionTreeSection
      ref="permissionTreeSectionRef"
      v-model:selected-role-id="selectedRoleId"
      :roles="list"
      :saving="saving"
      :menu-tree-data="menuTreeData"
      :menu-expanded-keys="menuExpandedKeys"
      :menu-checked-keys="menuCheckedKeys"
      :action-checked-ids="checkedIds"
      :has-any-action-perms="hasAnyActionPerms"
      :has-action-perms="hasActionPerms"
      @role-change="onRoleChange"
      @save-permissions="savePermissions"
      @open-action-dialog="openActionDialog"
      @action-check-change="setActionCheckedIds"
    />

    <!-- 操作权限弹窗：仅展示当前页面的操作权限勾选 -->
    <el-dialog
      v-model="actionDialogVisible"
      :title="actionDialogTitle"
      width="420px"
      class="action-perm-dialog"
      @closed="actionDialogClosed"
    >
      <div v-if="actionDialogItems.length" class="action-perm-list">
        <el-checkbox-group v-model="actionDialogCheckedIds">
          <div v-for="item in actionDialogItems" :key="item.id" class="action-perm-item">
            <el-checkbox :label="item.id">{{ item.name }}</el-checkbox>
            <div v-if="isOrderListAction(item)" class="action-status-config">
              <template v-if="isOrderReviewAction(item)">
                <div class="action-status-title">可操作状态：待审单（固定）</div>
              </template>
              <template v-else>
              <div class="action-status-title">可操作状态：</div>
              <el-checkbox-group
                v-model="actionStatusDraft[getOrderActionKey(item)!]"
                :disabled="!actionDialogCheckedIds.includes(item.id)"
              >
                <el-checkbox
                  v-for="status in orderStatuses"
                  :key="`${item.id}-${status.code}`"
                  :label="status.code"
                  size="small"
                >
                  {{ status.label }}
                </el-checkbox>
              </el-checkbox-group>
              </template>
            </div>
          </div>
        </el-checkbox-group>
      </div>
      <el-empty v-else description="该页面暂无操作权限项" />
      <template #footer>
        <el-button @click="actionDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmActionDialog">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑角色' : '新增角色'" width="400" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80">
        <el-form-item label="编码" prop="code">
          <el-input
            v-model="form.code"
            :disabled="isEdit && form.code === 'admin'"
            placeholder="根据名称自动匹配，可修改"
          />
        </el-form-item>
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="如: 仓库员" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitRole">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import RolesPermissionTreeSection from '@/components/settings/roles/RolesPermissionTreeSection.vue'
import { useRolesManagement } from '@/composables/useRolesManagement'
import { useRolesPermissionConfig } from '@/composables/useRolesPermissionConfig'

const selectedRoleId = ref<number | null>(null)
const selectedRoleCode = ref<string | null>(null)
type PermissionTreeSectionExpose = {
  getCheckedKeys: () => Array<number | string>
  setCheckedKeys: (keys: number[]) => void
}

const permissionConfig = useRolesPermissionConfig({ selectedRoleId, selectedRoleCode })
const {
  saving,
  menuTreeData,
  menuExpandedKeys,
  menuCheckedKeys,
  checkedIds,
  hasAnyActionPerms,
  orderStatuses,
  roleOrderPolicies,
  actionDialogVisible,
  actionDialogTitle,
  actionDialogItems,
  actionDialogCheckedIds,
  actionStatusDraft,
  registerMenuTreeBridge,
  hasActionPerms,
  setActionCheckedIds,
  getOrderActionKey,
  isOrderListAction,
  isOrderReviewAction,
  openActionDialog,
  confirmActionDialog,
  actionDialogClosed,
  loadPermissionsBaseData,
  loadRolePermissions,
  onRoleChange,
  savePermissions,
  resetForEmptyRoles,
} = permissionConfig

const roleState = useRolesManagement({
  selectedRoleId,
  onAfterLoad: async () => {
    if (!selectedRoleId.value) {
      resetForEmptyRoles()
      return
    }
    await loadRolePermissions()
  },
})
const {
  list,
  roleTableRef,
  dialogVisible,
  isEdit,
  formRef,
  submitLoading,
  form,
  rules,
  loadRoles,
  initRoleDragSort,
  destroyRoleDragSort,
  openCreate,
  openEdit,
  resetForm,
  submitRole,
  removeRole,
} = roleState

const permissionTreeSectionRef = ref<PermissionTreeSectionExpose>()

watch(
  [list, selectedRoleId],
  () => {
    selectedRoleCode.value = list.value.find((role) => role.id === selectedRoleId.value)?.code ?? null
  },
  { immediate: true },
)

watch(
  () => permissionTreeSectionRef.value,
  (section) => {
    if (!section) {
      registerMenuTreeBridge(null)
      return
    }
    registerMenuTreeBridge({
      getCheckedKeys: section.getCheckedKeys,
      setCheckedKeys: section.setCheckedKeys,
    })
  },
  { immediate: true },
)

onMounted(async () => {
  await loadPermissionsBaseData()
  await loadRoles()
  await nextTick()
  initRoleDragSort()
})

onBeforeUnmount(() => {
  destroyRoleDragSort()
  registerMenuTreeBridge(null)
})
</script>

<style scoped>
.page-card {
  background: var(--color-card, #fff);
  padding: var(--space-md, 24px);
  border-radius: var(--radius-xl, 8px);
}
.section-title {
  font-size: var(--font-size-subtitle, 16px);
  margin: 0 0 var(--space-sm, 12px);
}
.section-title:not(:first-child) {
  margin-top: var(--space-lg, 24px);
}
.toolbar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.role-drag-handle {
  cursor: move;
  user-select: none;
  color: var(--el-text-color-secondary);
  font-weight: 600;
  letter-spacing: 1px;
}
:deep(.role-drag-ghost > td) {
  background: var(--el-color-primary-light-9);
}
.action-perm-list {
  max-height: 360px;
  overflow-y: auto;
}
.action-perm-item {
  margin-bottom: 8px;
}
.action-perm-item:last-child {
  margin-bottom: 0;
}
.action-status-config {
  margin: 6px 0 0 24px;
}
.action-status-title {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-bottom: 4px;
}
</style>

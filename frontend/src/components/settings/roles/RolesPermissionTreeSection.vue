<template>
  <section>
    <h3 class="section-title">权限配置</h3>
    <div class="toolbar">
      <span>选择角色：</span>
      <el-select
        :model-value="selectedRoleId"
        placeholder="选择角色"
        filterable
        style="width: 200px"
        @update:model-value="onSelectRole"
        @change="onRoleChange"
      >
        <el-option v-for="role in roles" :key="role.id" :label="role.name" :value="role.id" />
      </el-select>
      <el-button type="primary" :disabled="!selectedRoleId" :loading="saving" @click="$emit('save-permissions')">
        保存权限
      </el-button>
    </div>
    <div class="perm-section">
      <div class="perm-tab-desc">勾选后，该菜单/页面在侧栏展示并可进入；点击「操作权限」可配置该页面的删除、编辑等操作权限。</div>
      <el-alert
        v-if="!hasAnyActionPerms"
        type="warning"
        show-icon
        :closable="false"
        title="当前没有加载到操作权限项；请重启后端，让权限种子写入数据库后再刷新本页。"
        class="perm-action-alert"
      />
      <el-tree
        :key="'menu-' + (selectedRoleId ?? 0)"
        ref="menuTreeRef"
        :data="menuTreeData"
        show-checkbox
        node-key="id"
        :default-expanded-keys="menuExpandedKeys"
        :default-checked-keys="menuCheckedKeys"
        :props="{ label: 'name', children: 'children' }"
        class="perm-tree"
      >
        <template #default="{ data }">
          <div class="tree-node-content">
            <div class="tree-node-main">
              <span class="tree-node-label">{{ data.name }}</span>
              <el-button
                v-if="hasActionPerms(data)"
                link
                type="primary"
                size="small"
                class="tree-node-action-btn"
                @click.stop="$emit('open-action-dialog', data)"
              >
                详细设置
              </el-button>
            </div>
            <div v-if="data.actions?.length" class="tree-node-actions" @click.stop>
              <span class="tree-node-actions-title">操作权限</span>
              <el-checkbox-group
                :model-value="getNodeActionCheckedIds(data)"
                class="tree-node-action-checks"
                @change="(value) => onNodeActionChange(data, value)"
              >
                <el-checkbox
                  v-for="action in data.actions"
                  :key="action.id"
                  :label="action.id"
                  size="small"
                >
                  {{ formatActionName(action.name, data.name) }}
                </el-checkbox>
              </el-checkbox-group>
            </div>
          </div>
        </template>
      </el-tree>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { RoleItem } from '@/api/roles'
import type { RolePermissionTreeNode } from '@/composables/useRolesPermissionConfig'

const props = defineProps<{
  roles: RoleItem[]
  selectedRoleId: number | null
  saving: boolean
  menuTreeData: RolePermissionTreeNode[]
  menuExpandedKeys: number[]
  menuCheckedKeys: number[]
  actionCheckedIds: number[]
  hasAnyActionPerms: boolean
  hasActionPerms: (node: RolePermissionTreeNode) => boolean
}>()

const emit = defineEmits<{
  (e: 'update:selectedRoleId', value: number | null): void
  (e: 'role-change', value: number): void
  (e: 'save-permissions'): void
  (e: 'open-action-dialog', data: RolePermissionTreeNode): void
  (e: 'action-check-change', value: number[]): void
}>()

const menuTreeRef = ref<InstanceType<typeof import('element-plus')['ElTree']>>()

function onSelectRole(value: string | number | boolean | null | undefined) {
  emit('update:selectedRoleId', typeof value === 'number' ? value : null)
}

function onRoleChange(value: string | number | boolean | null | undefined) {
  if (typeof value === 'number') emit('role-change', value)
}

function getCheckedKeys(): Array<number | string> {
  return (menuTreeRef.value?.getCheckedKeys?.() ?? []) as Array<number | string>
}

function setCheckedKeys(keys: number[]) {
  menuTreeRef.value?.setCheckedKeys?.(keys)
}

function getNodeActionCheckedIds(node: RolePermissionTreeNode): number[] {
  const ids = new Set(props.actionCheckedIds)
  return (node.actions ?? []).map((action) => action.id).filter((id) => ids.has(id))
}

function onNodeActionChange(node: RolePermissionTreeNode, value: unknown) {
  const selected = Array.isArray(value) ? value.filter((id): id is number => typeof id === 'number') : []
  const nodeActionIds = new Set((node.actions ?? []).map((action) => action.id))
  const nextIds = [
    ...props.actionCheckedIds.filter((id) => !nodeActionIds.has(id)),
    ...selected,
  ]
  if (selected.length && typeof node.id === 'number') {
    menuTreeRef.value?.setChecked?.(node.id, true, false)
  }
  emit('action-check-change', nextIds)
}

function formatActionName(actionName: string, nodeName: string): string {
  const pageName = nodeName.replace(/\s*\([^)]*\)\s*$/, '').trim()
  return actionName
    .replace(`${pageName}-`, '')
    .replace(`${pageName} - `, '')
    .trim()
}

defineExpose({
  getCheckedKeys,
  setCheckedKeys,
})
</script>

<style scoped>
.section-title {
  font-size: var(--font-size-subtitle, 16px);
  margin: 0 0 var(--space-sm, 12px);
}
.toolbar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.perm-section {
  margin-top: 12px;
}
.perm-tab-desc {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 12px;
}
.perm-tree {
  margin-top: 12px;
}
.perm-tree :deep(.el-tree-node__content) {
  height: auto;
  min-height: 28px;
  align-items: flex-start;
  padding: 4px 0;
}
.perm-tree :deep(.el-tree-node__expand-icon) {
  margin-top: 6px;
}
.perm-tree :deep(.el-checkbox) {
  margin-top: 5px;
}
.perm-tree :deep(.tree-node-action-checks .el-checkbox) {
  margin-top: 0;
}
.perm-action-alert {
  margin-bottom: 12px;
}
.tree-node-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 4px 0;
  min-width: 0;
}
.tree-node-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.tree-node-label {
  line-height: 20px;
}
.tree-node-action-btn {
  padding: 0 4px;
}
.tree-node-actions {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  margin-left: 4px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.tree-node-actions-title {
  flex: 0 0 auto;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 24px;
}
.tree-node-action-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
}
.tree-node-action-checks :deep(.el-checkbox) {
  margin-right: 0;
  height: 24px;
}
</style>

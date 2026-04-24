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
          <span class="tree-node-label">{{ data.name }}</span>
          <el-button
            v-if="hasActionPerms(data)"
            link
            type="primary"
            size="small"
            class="tree-node-action-btn"
            @click.stop="$emit('open-action-dialog', data)"
          >
            操作权限
          </el-button>
        </template>
      </el-tree>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { RoleItem } from '@/api/roles'
import type { RolePermissionTreeNode } from '@/composables/useRolesPermissionConfig'

defineProps<{
  roles: RoleItem[]
  selectedRoleId: number | null
  saving: boolean
  menuTreeData: RolePermissionTreeNode[]
  menuExpandedKeys: number[]
  menuCheckedKeys: number[]
  hasActionPerms: (node: RolePermissionTreeNode) => boolean
}>()

const emit = defineEmits<{
  (e: 'update:selectedRoleId', value: number | null): void
  (e: 'role-change', value: number): void
  (e: 'save-permissions'): void
  (e: 'open-action-dialog', data: RolePermissionTreeNode): void
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
.tree-node-label {
  margin-right: 8px;
}
.tree-node-action-btn {
  padding: 0 4px;
}
</style>

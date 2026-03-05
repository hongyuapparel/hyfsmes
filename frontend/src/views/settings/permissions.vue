<template>
  <div class="page-card">
    <div class="toolbar">
      <span>选择角色：</span>
      <el-select v-model="selectedRoleId" placeholder="选择角色" filterable style="width: 200px" @change="loadRolePermissions">
        <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
      </el-select>
      <el-button type="primary" :disabled="!selectedRoleId" :loading="saving" @click="save">
        保存
      </el-button>
    </div>
    <el-tree
      :key="selectedRoleId ?? 0"
      ref="treeRef"
      :data="treeData"
      show-checkbox
      node-key="id"
      :default-checked-keys="checkedIds"
      :props="{ label: 'name', children: 'children' }"
      class="perm-tree"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getRoles, getRolePermissions, setRolePermissions, type RoleItem } from '@/api/roles'
import { getPermissions, type PermissionItem } from '@/api/permissions'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const roles = ref<RoleItem[]>([])
const permissions = ref<PermissionItem[]>([])
const selectedRoleId = ref<number | null>(null)
const checkedIds = ref<number[]>([])
const saving = ref(false)
const treeRef = ref<any>()

const treeData = computed(() => {
  return permissions.value.map((p) => ({
    id: p.id,
    name: `${p.name} (${p.routePath || '/'})`,
    children: [],
  }))
})

async function loadRoles() {
  const res = await getRoles()
  roles.value = res.data ?? []
  if (roles.value.length && !selectedRoleId.value) selectedRoleId.value = roles.value[0].id
}

async function loadPermissions() {
  const res = await getPermissions()
  permissions.value = res.data ?? []
}

async function loadRolePermissions() {
  if (!selectedRoleId.value) {
    checkedIds.value = []
    return
  }
  const res = await getRolePermissions(selectedRoleId.value)
  checkedIds.value = res.data ?? []
}

async function save() {
  if (!selectedRoleId.value) return
  const half = treeRef.value?.getHalfCheckedKeys?.() ?? []
  const full = treeRef.value?.getCheckedKeys?.() ?? []
  const ids = [...new Set([...half, ...full])]
  saving.value = true
  try {
    await setRolePermissions(selectedRoleId.value, ids)
    ElMessage.success('保存成功')
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '保存失败'))
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadPermissions()
  await loadRoles()
  await loadRolePermissions()
})
</script>

<style scoped>
.page-card {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
}
.toolbar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.perm-tree {
  margin-top: 12px;
}
</style>

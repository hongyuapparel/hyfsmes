<template>
  <div class="page-card">
    <h3 class="section-title">角色列表</h3>
    <div class="toolbar">
      <el-button type="primary" @click="openCreate">新增角色</el-button>
    </div>
    <el-table :data="list" border stripe>
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="code" label="编码" width="140" />
      <el-table-column prop="name" label="名称" width="140" />
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
            {{ row.status === 'active' ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" size="small" :disabled="row.code === 'admin'" @click="remove(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <h3 class="section-title">权限配置</h3>
    <div class="toolbar">
      <span>选择角色：</span>
      <el-select v-model="selectedRoleId" placeholder="选择角色" filterable style="width: 200px" @change="loadRolePermissions">
        <el-option v-for="r in list" :key="r.id" :label="r.name" :value="r.id" />
      </el-select>
      <el-button type="primary" :disabled="!selectedRoleId" :loading="saving" @click="savePermissions">
        保存权限
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

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑角色' : '新增角色'" width="400" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80">
        <el-form-item label="编码" prop="code">
          <el-input v-model="form.code" :disabled="isEdit && form.code === 'admin'" placeholder="如: warehouse" />
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
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  setRolePermissions,
  type RoleItem,
} from '@/api/roles'
import { getPermissions, type PermissionItem } from '@/api/permissions'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const list = ref<RoleItem[]>([])
const permissions = ref<PermissionItem[]>([])
const selectedRoleId = ref<number | null>(null)
const checkedIds = ref<number[]>([])
const saving = ref(false)
const treeRef = ref<InstanceType<typeof import('element-plus')['ElTree']>>()

const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(0)
const formRef = ref<FormInstance>()
const submitLoading = ref(false)

const form = ref({ code: '', name: '' })
const rules: FormRules = {
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
}

interface TreeNode {
  id: number | string
  name: string
  children?: TreeNode[]
}

interface PageNode extends TreeNode {
  routePath: string
}

const treeData = computed<TreeNode[]>(() => {
  const pageMap = new Map<string, PageNode>()

  const getPageNode = (routePath: string, displayName: string): PageNode => {
    const key = routePath || '/'
    let node = pageMap.get(key)
    if (!node) {
      const pathLabel = key || '/'
      node = {
        id: `page:${key}`,
        name: `${displayName || '页面'} (${pathLabel})`,
        routePath: key,
        children: [],
      }
      pageMap.set(key, node)
    } else if (!node.name && displayName) {
      node.name = `${displayName} (${key || '/'})`
    }
    return node
  }

  for (const p of permissions.value) {
    const routePath = p.routePath || '/'
    const pageNode = getPageNode(routePath, p.name)
    const children = pageNode.children ?? (pageNode.children = [])

    if (p.type === 'menu') {
      children.push({
        id: p.id,
        name: '板块可见（菜单）',
      })
    } else {
      let actionGroup = children.find((c) => c.id === `action:${routePath}`)
      if (!actionGroup) {
        actionGroup = {
          id: `action:${routePath}`,
          name: '编辑/操作权限',
          children: [],
        }
        children.push(actionGroup)
      }
      ;(actionGroup.children ?? (actionGroup.children = [])).push({
        id: p.id,
        name: p.name,
      })
    }
  }

  const roots: TreeNode[] = []
  const allPages = Array.from(pageMap.values())

  const findParent = (path: string): PageNode | null => {
    if (!path || path === '/') return null
    const parts = path.split('/').filter(Boolean)
    if (parts.length <= 1) return pageMap.get('/') ?? null
    const parentPath = '/' + parts.slice(0, parts.length - 1).join('/')
    return pageMap.get(parentPath) ?? null
  }

  for (const page of allPages) {
    const parent = findParent(page.routePath)
    if (!parent) {
      roots.push(page)
    } else {
      const parentChildren = parent.children ?? (parent.children = [])
      parentChildren.push(page)
    }
  }

  return roots
})

async function load() {
  const res = await getRoles()
  list.value = res.data ?? []
  if (list.value.length && !selectedRoleId.value) selectedRoleId.value = list.value[0].id
  await loadRolePermissions()
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

function openCreate() {
  isEdit.value = false
  editId.value = 0
  form.value = { code: '', name: '' }
  dialogVisible.value = true
}

function openEdit(row: RoleItem) {
  isEdit.value = true
  editId.value = row.id
  form.value = { code: row.code, name: row.name }
  dialogVisible.value = true
}

function resetForm() {
  formRef.value?.resetFields()
}

async function submitRole() {
  await formRef.value?.validate()
  submitLoading.value = true
  try {
    if (isEdit.value) {
      await updateRole(editId.value, { code: form.value.code, name: form.value.name })
      ElMessage.success('保存成功')
    } else {
      await createRole(form.value)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    submitLoading.value = false
  }
}

async function remove(row: RoleItem) {
  await ElMessageBox.confirm(`确定删除角色「${row.name}」？`, '提示', {
    type: 'warning',
  }).catch(() => {})
  try {
    await deleteRole(row.id)
    ElMessage.success('已删除')
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '删除失败'))
  }
}

async function savePermissions() {
  if (!selectedRoleId.value) return
  const half = treeRef.value?.getHalfCheckedKeys?.() ?? []
  const full = treeRef.value?.getCheckedKeys?.() ?? []
  const ids = [
    ...new Set([...(half as Array<number | string>), ...(full as Array<number | string>)]),
  ].filter((id): id is number => typeof id === 'number')
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
  await load()
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
.perm-tree {
  margin-top: 12px;
}
</style>

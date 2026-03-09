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
          <el-tooltip content="删除" placement="top">
          <el-button link type="danger" size="small" circle :disabled="row.code === 'admin'" @click="remove(row)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <h3 class="section-title">权限配置</h3>
    <div class="toolbar">
      <span>选择角色：</span>
      <el-select
        v-model="selectedRoleId"
        placeholder="选择角色"
        filterable
        style="width: 200px"
        @change="loadRolePermissions"
      >
        <el-option v-for="r in list" :key="r.id" :label="r.name" :value="r.id" />
      </el-select>
      <el-button type="primary" :disabled="!selectedRoleId" :loading="saving" @click="savePermissions">
        保存权限
      </el-button>
    </div>
    <el-tabs v-model="permTab" type="border-card" class="perm-tabs">
      <el-tab-pane label="菜单可见" name="menu">
        <div class="perm-tab-desc">勾选后，该菜单/页面在侧栏展示并可进入。</div>
        <el-tree
          :key="'menu-' + (selectedRoleId ?? 0)"
          ref="menuTreeRef"
          :data="menuTreeData"
          show-checkbox
          node-key="id"
          :default-checked-keys="menuCheckedKeys"
          :props="{ label: 'name', children: 'children' }"
          class="perm-tree"
        />
      </el-tab-pane>
      <el-tab-pane label="操作权限" name="action">
        <div class="perm-tab-desc">按页面分组的操作权限（如删除、审核等），可搜索。</div>
        <div class="perm-toolbar">
          <el-input
            v-model="actionKeyword"
            placeholder="搜索权限名称"
            clearable
            style="width: 220px"
            :prefix-icon="Search"
          />
        </div>
        <el-tree
          :key="'action-' + (selectedRoleId ?? 0)"
          ref="actionTreeRef"
          :data="filteredActionTreeData"
          show-checkbox
          node-key="id"
          :default-checked-keys="actionCheckedKeys"
          :props="{ label: 'name', children: 'children' }"
          class="perm-tree"
        />
      </el-tab-pane>
    </el-tabs>

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
import { Search, Delete } from '@element-plus/icons-vue'
import { getPermissions, type PermissionItem } from '@/api/permissions'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const list = ref<RoleItem[]>([])
const permissions = ref<PermissionItem[]>([])
const selectedRoleId = ref<number | null>(null)
const checkedIds = ref<number[]>([])
const saving = ref(false)
const permTab = ref<'menu' | 'action'>('menu')
const actionKeyword = ref('')
const menuTreeRef = ref<InstanceType<typeof import('element-plus')['ElTree']>>()
const actionTreeRef = ref<InstanceType<typeof import('element-plus')['ElTree']>>()

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

const menuPermissionIds = computed(() =>
  permissions.value.filter((p) => p.type === 'menu').map((p) => p.id),
)
const actionPermissionIds = computed(() =>
  permissions.value.filter((p) => p.type === 'action').map((p) => p.id),
)
const menuCheckedKeys = computed(() =>
  checkedIds.value.filter((id) => menuPermissionIds.value.includes(id)),
)
const actionCheckedKeys = computed(() =>
  checkedIds.value.filter((id) => actionPermissionIds.value.includes(id)),
)

const menuTreeData = computed<TreeNode[]>(() => {
  const pageMap = new Map<string, PageNode>()
  const getPageNode = (routePath: string, displayName: string): PageNode => {
    const key = routePath || '/'
    let node = pageMap.get(key)
    if (!node) {
      node = {
        id: `page:${key}`,
        name: `${displayName || '页面'} (${key || '/'})`,
        routePath: key,
        children: [],
      }
      pageMap.set(key, node)
    } else if (displayName) {
      node.name = `${displayName} (${key || '/'})`
    }
    return node
  }
  const menuPerms = permissions.value.filter((p) => p.type === 'menu')
  for (const p of menuPerms) {
    const routePath = p.routePath || '/'
    getPageNode(routePath, p.name)
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
    const menuPerm = menuPerms.find((p) => (p.routePath || '/') === page.routePath)
    const permNode = menuPerm ? { id: menuPerm.id, name: menuPerm.name } : null
    const childPages = allPages.filter((p) => findParent(p.routePath)?.routePath === page.routePath)
    page.children = [...(permNode ? [permNode] : []), ...childPages]
  }
  for (const page of allPages) {
    const parent = findParent(page.routePath)
    if (!parent) roots.push(page)
  }
  return roots
})

const actionTreeData = computed<TreeNode[]>(() => {
  const menuByPath = new Map<string, string>()
  for (const p of permissions.value) {
    if (p.type === 'menu') menuByPath.set(p.routePath || '/', p.name)
  }
  const group = new Map<string, PermissionItem[]>()
  for (const p of permissions.value) {
    if (p.type !== 'action') continue
    const key = p.routePath || '/'
    if (!group.has(key)) group.set(key, [])
    group.get(key)!.push(p)
  }
  return Array.from(group.entries()).map(([path, actions]) => ({
    id: `action-group:${path}`,
    name: `${menuByPath.get(path) || path} (${path})`,
    children: actions.map((a) => ({ id: a.id, name: a.name })),
  }))
})

const filteredActionTreeData = computed(() => {
  const kw = actionKeyword.value.trim().toLowerCase()
  if (!kw) return actionTreeData.value
  const filterNode = (nodes: TreeNode[]): TreeNode[] => {
    const out: TreeNode[] = []
    for (const n of nodes) {
      if (typeof n.id === 'number') {
        if (n.name.toLowerCase().includes(kw)) out.push(n)
      } else {
        const filtered = n.children ? filterNode(n.children) : []
        if (filtered.length || n.name.toLowerCase().includes(kw)) {
          out.push({ ...n, children: filtered.length ? filtered : n.children })
        }
      }
    }
    return out
  }
  return filterNode(actionTreeData.value)
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
  const halfMenu = (menuTreeRef.value?.getHalfCheckedKeys?.() ?? []) as Array<number | string>
  const fullMenu = (menuTreeRef.value?.getCheckedKeys?.() ?? []) as Array<number | string>
  const halfAction = (actionTreeRef.value?.getHalfCheckedKeys?.() ?? []) as Array<number | string>
  const fullAction = (actionTreeRef.value?.getCheckedKeys?.() ?? []) as Array<number | string>
  const menuIds = [...new Set([...halfMenu, ...fullMenu])].filter((id): id is number => typeof id === 'number')
  let actionIds = [...new Set([...halfAction, ...fullAction])].filter((id): id is number => typeof id === 'number')
  if (actionKeyword.value.trim()) {
    const prevActionIds = new Set(checkedIds.value.filter((id) => actionPermissionIds.value.includes(id)))
    actionIds = [...new Set([...actionIds, ...prevActionIds])]
  }
  const ids = [...new Set([...menuIds, ...actionIds])]
  saving.value = true
  try {
    await setRolePermissions(selectedRoleId.value, ids)
    checkedIds.value = ids
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
.perm-tabs {
  margin-top: 12px;
}
.perm-tab-desc {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-bottom: 12px;
}
.perm-toolbar {
  margin-bottom: 12px;
}
</style>

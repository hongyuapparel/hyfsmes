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
        <template #default="{ node, data }">
          <span class="tree-node-label">{{ data.name }}</span>
          <el-button
            v-if="hasActionPerms(data)"
            link
            type="primary"
            size="small"
            class="tree-node-action-btn"
            @click.stop="openActionDialog(data)"
          >
            操作权限
          </el-button>
        </template>
      </el-tree>
    </div>

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
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  getRoles,
  suggestRoleCode,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  setRolePermissions,
  getRoleOrderPolicies,
  setRoleOrderPolicies,
  type RoleItem,
} from '@/api/roles'
import { Delete } from '@element-plus/icons-vue'
import { getPermissions, type PermissionItem } from '@/api/permissions'
import { getOrderStatuses, type OrderStatusItem } from '@/api/order-status-config'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const list = ref<RoleItem[]>([])
const permissions = ref<PermissionItem[]>([])
const selectedRoleId = ref<number | null>(null)
const checkedIds = ref<number[]>([])
const saving = ref(false)
const menuTreeRef = ref<InstanceType<typeof import('element-plus')['ElTree']>>()
const rolePermReqSeq = ref(0)
const orderStatuses = ref<OrderStatusItem[]>([])
const roleOrderPolicies = ref<{ edit: string[]; review: string[]; delete: string[] }>({
  edit: [],
  review: [],
  delete: [],
})

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

/** 新增时根据名称自动带出编码（与系统菜单/业务一致），防抖 300ms */
let suggestCodeTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => [form.value.name, dialogVisible.value, isEdit.value] as const,
  ([name, visible, edit]) => {
    if (!visible || edit) return
    const n = (name as string)?.trim()
    if (!n) return
    if (suggestCodeTimer) clearTimeout(suggestCodeTimer)
    suggestCodeTimer = setTimeout(async () => {
      suggestCodeTimer = null
      try {
        const res = await suggestRoleCode(n)
        const code = res.data?.code
        if (code != null && !isEdit.value && dialogVisible.value) form.value.code = code
      } catch {
        // 忽略建议接口失败，用户可手动填编码
      }
    }, 300)
  },
)

interface TreeNode {
  id: number | string
  name: string
  children?: TreeNode[]
  /** 菜单节点对应的路由路径，用于操作权限弹窗 */
  routePath?: string
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
/**
 * 订单列表页不在「操作权限」弹窗中展示的权限：
 * - 草稿提交：全员允许，无需在此配置
 * - 采购完成、纸样完成、裁床完成、车缝完成、待尾部发货申请、财务审核发货、待尾部入库申请、仓管接收入库：在订单链路设置中配置，不在此处展示
 */
const ORDER_LIST_ACTION_EXCLUDE_NAMES = [
  '草稿提交',
  '待审单可编辑',
  '全状态可编辑',
  '采购完成',
  '纸样完成',
  '裁床完成',
  '车缝完成',
  '待尾部发货申请',
  '财务审核发货',
  '待尾部入库申请',
  '仓管接收入库',
]

/** 某页面对应的操作权限列表（用于弹窗） */
function actionsForRoute(routePath: string): PermissionItem[] {
  const path = routePath || '/'
  let items = permissions.value.filter(
    (p) => p.type === 'action' && (p.routePath || '/') === path,
  )
  if (path === '/orders/list') {
    items = items.filter(
      (p) => !ORDER_LIST_ACTION_EXCLUDE_NAMES.some((name) => p.name.includes(name)),
    )
  }
  return items
}

function hasActionPerms(data: TreeNode): boolean {
  return Boolean(data.routePath && actionsForRoute(data.routePath).length > 0)
}

const actionDialogVisible = ref(false)
const actionDialogPageName = ref('')
const actionDialogRoutePath = ref('')
const actionDialogItems = ref<PermissionItem[]>([])
const actionDialogCheckedIds = ref<number[]>([])
const actionStatusDraft = ref<Record<'edit' | 'review' | 'delete', string[]>>({
  edit: [],
  review: [],
  delete: [],
})

const actionDialogTitle = computed(
  () => `${actionDialogPageName.value || '页面'} - 操作权限`,
)

function getOrderActionKey(item: PermissionItem): 'edit' | 'review' | 'delete' | null {
  if (item.code === 'orders_edit') return 'edit'
  if (item.code === 'orders_review') return 'review'
  if (item.code === 'orders_delete') return 'delete'
  return null
}

function isOrderListAction(item: PermissionItem): boolean {
  return (item.routePath || '/') === '/orders/list' && !!getOrderActionKey(item)
}

function isOrderReviewAction(item: PermissionItem): boolean {
  return getOrderActionKey(item) === 'review'
}

function openActionDialog(data: TreeNode) {
  const path = data.routePath || '/'
  const items = actionsForRoute(path)
  actionDialogPageName.value = String(data.name).replace(/\s*\([^)]*\)\s*$/, '').trim() || path
  actionDialogRoutePath.value = path
  actionDialogItems.value = items
  actionDialogCheckedIds.value = checkedIds.value.filter((id) =>
    items.some((p) => p.id === id),
  )
  actionStatusDraft.value = {
    edit: [...roleOrderPolicies.value.edit],
    review: [...roleOrderPolicies.value.review],
    delete: [...roleOrderPolicies.value.delete],
  }
  actionDialogVisible.value = true
}

function confirmActionDialog() {
  const items = actionDialogItems.value
  const idsForPage = new Set(items.map((p) => p.id))
  checkedIds.value = [
    ...checkedIds.value.filter((id) => !idsForPage.has(id)),
    ...actionDialogCheckedIds.value,
  ]
  const checkedSet = new Set(actionDialogCheckedIds.value)
  for (const item of items) {
    const actionKey = getOrderActionKey(item)
    if (!actionKey) continue
    if (!checkedSet.has(item.id)) {
      actionStatusDraft.value[actionKey] = []
    } else if (actionKey === 'review') {
      actionStatusDraft.value.review = ['pending_review']
    }
  }
  roleOrderPolicies.value = {
    edit: [...actionStatusDraft.value.edit],
    review: [...actionStatusDraft.value.review],
    delete: [...actionStatusDraft.value.delete],
  }
  actionDialogVisible.value = false
}

function actionDialogClosed() {
  actionDialogPageName.value = ''
  actionDialogRoutePath.value = ''
  actionDialogItems.value = []
  actionDialogCheckedIds.value = []
  actionStatusDraft.value = { edit: [], review: [], delete: [] }
}

const menuTreeData = computed<TreeNode[]>(() => {
  // 仅使用后端返回的菜单型权限，避免一页出现两行
  const menuPerms = permissions.value.filter((p) => p.type === 'menu')
  // 按 routePath 构建层级结构，每个节点就是一个可勾选的菜单权限
  const nodeByPath = new Map<string, TreeNode>()

  const getNode = (p: PermissionItem): TreeNode => {
    const path = p.routePath || '/'
    let node = nodeByPath.get(path)
    if (!node) {
      node = { id: p.id, name: `${p.name} (${path || '/'})`, children: [], routePath: path }
      nodeByPath.set(path, node)
    } else {
      node.id = p.id
      node.name = `${p.name} (${path || '/'})`
      node.routePath = path
    }
    return node
  }

  for (const p of menuPerms) {
    getNode(p)
  }

  const roots: TreeNode[] = []
  const allNodes = Array.from(nodeByPath.entries())

  const findParentPath = (path: string): string | null => {
    if (!path || path === '/') return null
    const parts = path.split('/').filter(Boolean)
    // 一级菜单与主页并列，不应挂在 "/" 下面，否则会导致勾选主页时整树联动全选
    if (parts.length <= 1) return null
    return '/' + parts.slice(0, parts.length - 1).join('/')
  }

  for (const [path, node] of allNodes) {
    const parentPath = findParentPath(path)
    if (!parentPath || !nodeByPath.has(parentPath)) {
      roots.push(node)
    } else {
      const parent = nodeByPath.get(parentPath)!
      parent.children = parent.children || []
      parent.children.push(node)
    }
  }

  return roots
})

// 默认仅展开“主页 (/)"，其它菜单折叠
const menuExpandedKeys = computed(() => {
  const root = permissions.value.find((p) => p.type === 'menu' && (p.routePath || '/') === '/')
  return root ? [root.id] : []
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
  const statusRes = await getOrderStatuses()
  orderStatuses.value = (statusRes.data ?? [])
    .filter((s) => s.enabled !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

async function loadRolePermissions() {
  const reqSeq = ++rolePermReqSeq.value
  if (!selectedRoleId.value) {
    checkedIds.value = []
    menuTreeRef.value?.setCheckedKeys?.([])
    roleOrderPolicies.value = { edit: [], review: [], delete: [] }
    return
  }
  const roleId = selectedRoleId.value
  const permRes = await getRolePermissions(roleId)
  let policyData: { edit?: string[]; review?: string[]; delete?: string[] } | null = null
  try {
    const policyRes = await getRoleOrderPolicies(roleId)
    policyData = policyRes.data ?? null
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status
    if (status !== 404 && !isErrorHandled(e)) {
      ElMessage.warning('订单状态策略读取失败，已按旧模式加载')
    }
  }
  // 忽略过期请求结果，避免快速切换角色时旧请求覆盖新角色权限
  if (reqSeq !== rolePermReqSeq.value) return
  checkedIds.value = (permRes.data ?? []).filter((id) => menuPermissionIds.value.includes(id) || actionPermissionIds.value.includes(id))
  roleOrderPolicies.value = {
    edit: policyData?.edit ?? [],
    review: policyData?.review ?? [],
    delete: policyData?.delete ?? [],
  }
  menuTreeRef.value?.setCheckedKeys?.(menuCheckedKeys.value)
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
  const menuIds = [...new Set([...halfMenu, ...fullMenu])].filter((id): id is number => typeof id === 'number')
  const actionIds = checkedIds.value.filter((id) => actionPermissionIds.value.includes(id))
  const ids = [...new Set([...menuIds, ...actionIds])]
  saving.value = true
  try {
    await setRolePermissions(selectedRoleId.value, ids)
    try {
      await setRoleOrderPolicies(selectedRoleId.value, roleOrderPolicies.value)
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      // 404 表示当前后端未启用状态策略接口；主权限已保存，这里不再提示避免误导为“保存失败”
      if (status !== 404) {
        ElMessage.warning('主权限已保存；订单状态策略保存失败，请稍后重试')
      }
    }
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

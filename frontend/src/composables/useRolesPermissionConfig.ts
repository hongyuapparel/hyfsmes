import { computed, nextTick, ref, type Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getRolePermissions,
  setRolePermissions,
  getRoleOrderPolicies,
  setRoleOrderPolicies,
} from '@/api/roles'
import { getPermissions, resyncAdminPermissions, type PermissionItem } from '@/api/permissions'
import { getOrderStatuses, type OrderStatusItem } from '@/api/order-status-config'
import { getErrorMessage, isErrorHandled } from '@/api/request'

export interface RolePermissionTreeNode {
  id: number | string
  name: string
  children?: RolePermissionTreeNode[]
  routePath?: string
  actions?: Array<Pick<PermissionItem, 'id' | 'code' | 'name' | 'routePath'>>
}

export interface MenuTreeBridge {
  getCheckedKeys: () => Array<number | string>
  setCheckedKeys: (keys: number[]) => void
}

interface UseRolesPermissionConfigOptions {
  selectedRoleId: Ref<number | null>
  selectedRoleCode?: Ref<string | null>
}

export function useRolesPermissionConfig(options: UseRolesPermissionConfigOptions) {
  const { selectedRoleId, selectedRoleCode } = options

  const menuTreeBridge = ref<MenuTreeBridge | null>(null)
  const permissions = ref<PermissionItem[]>([])
  const orderStatuses = ref<OrderStatusItem[]>([])
  const checkedIds = ref<number[]>([])
  const saving = ref(false)
  const rolePermReqSeq = ref(0)
  const lastStableRoleId = ref<number | null>(null)
  const isRevertingRoleChange = ref(false)
  const savedPermissionSnapshot = ref('')
  const roleOrderPolicies = ref<{ edit: string[]; review: string[]; delete: string[] }>({
    edit: [],
    review: [],
    delete: [],
  })

  const actionDialogVisible = ref(false)
  const actionDialogPageName = ref('')
  const actionDialogItems = ref<PermissionItem[]>([])
  const actionDialogCheckedIds = ref<number[]>([])
  const actionStatusDraft = ref<Record<'edit' | 'review' | 'delete', string[]>>({
    edit: [],
    review: [],
    delete: [],
  })

  const menuPermissionIds = computed(() =>
    permissions.value.filter((p) => p.type === 'menu').map((p) => p.id),
  )
  const actionPermissionIds = computed(() =>
    permissions.value.filter((p) => p.type === 'action').map((p) => p.id),
  )
  const hasAnyActionPerms = computed(() => actionPermissionIds.value.length > 0)
  const menuCheckedKeys = computed(() =>
    checkedIds.value.filter((id) => menuPermissionIds.value.includes(id)),
  )
  const menuExpandedKeys = computed(() => {
    const root = permissions.value.find((p) => p.type === 'menu' && (p.routePath || '/') === '/')
    return root ? [root.id] : []
  })

  const actionDialogTitle = computed(
    () => `${actionDialogPageName.value || '页面'} - 操作权限`,
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

  const menuTreeData = computed<RolePermissionTreeNode[]>(() => {
    const menuPerms = permissions.value.filter((p) => p.type === 'menu')
    const nodeByPath = new Map<string, RolePermissionTreeNode>()

    const getNode = (p: PermissionItem): RolePermissionTreeNode => {
      const path = p.routePath || '/'
      let node = nodeByPath.get(path)
      if (!node) {
        node = { id: p.id, name: `${p.name} (${path || '/'})`, children: [], routePath: path, actions: [] }
        nodeByPath.set(path, node)
      } else {
        node.id = p.id
        node.name = `${p.name} (${path || '/'})`
        node.routePath = path
      }
      return node
    }

    for (const p of menuPerms) getNode(p)
    for (const node of nodeByPath.values()) {
      node.actions = node.routePath
        ? actionsForRoute(node.routePath).map((item) => ({
            id: item.id,
            code: item.code,
            name: item.name,
            routePath: item.routePath,
          }))
        : []
    }

    const roots: RolePermissionTreeNode[] = []
    const allNodes = Array.from(nodeByPath.entries())
    const findParentPath = (path: string): string | null => {
      if (!path || path === '/') return null
      const parts = path.split('/').filter(Boolean)
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

  function registerMenuTreeBridge(bridge: MenuTreeBridge | null) {
    menuTreeBridge.value = bridge
  }

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

  function hasActionPerms(data: RolePermissionTreeNode): boolean {
    return Boolean(data.routePath && actionsForRoute(data.routePath).length > 0)
  }

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

  function openActionDialog(data: RolePermissionTreeNode) {
    const path = data.routePath || '/'
    const items = actionsForRoute(path)
    actionDialogPageName.value = String(data.name).replace(/\s*\([^)]*\)\s*$/, '').trim() || path
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
    actionDialogItems.value = []
    actionDialogCheckedIds.value = []
    actionStatusDraft.value = { edit: [], review: [], delete: [] }
  }

  function setActionCheckedIds(nextIds: number[]) {
    const actionSet = new Set(actionPermissionIds.value)
    const normalized = [...new Set(nextIds)].filter((id) => actionSet.has(id))
    checkedIds.value = [
      ...checkedIds.value.filter((id) => !actionSet.has(id)),
      ...normalized,
    ]
  }

  function getMenuIdByRoute(routePath: string | null | undefined): number | null {
    const path = routePath || '/'
    return permissions.value.find((p) => p.type === 'menu' && (p.routePath || '/') === path)?.id ?? null
  }

  function normalizePoliciesForActions(actionIds: number[]) {
    const actionCodes = new Set(
      permissions.value
        .filter((p) => actionIds.includes(p.id))
        .map((p) => p.code),
    )
    return {
      edit: actionCodes.has('orders_edit') ? roleOrderPolicies.value.edit : [],
      review: actionCodes.has('orders_review') ? ['pending_review'] : [],
      delete: actionCodes.has('orders_delete') ? roleOrderPolicies.value.delete : [],
    }
  }

  function collectSelectedPermissionIds(): { ids: number[]; actionIds: number[] } {
    const fullMenu = menuTreeBridge.value?.getCheckedKeys() ?? []
    const menuIds = new Set(
      fullMenu.filter((id): id is number => typeof id === 'number' && menuPermissionIds.value.includes(id)),
    )
    const actionIds = checkedIds.value.filter((id) => actionPermissionIds.value.includes(id))
    for (const action of permissions.value.filter((p) => actionIds.includes(p.id))) {
      const menuId = getMenuIdByRoute(action.routePath)
      if (menuId != null) menuIds.add(menuId)
    }
    const ids = [...new Set([...menuIds, ...actionIds])]
    return { ids, actionIds }
  }

  async function loadPermissionsBaseData() {
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
      menuTreeBridge.value?.setCheckedKeys([])
      roleOrderPolicies.value = { edit: [], review: [], delete: [] }
      savedPermissionSnapshot.value = ''
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
    if (reqSeq !== rolePermReqSeq.value) return

    checkedIds.value = (permRes.data ?? []).filter(
      (id) => menuPermissionIds.value.includes(id) || actionPermissionIds.value.includes(id),
    )
    roleOrderPolicies.value = {
      edit: policyData?.edit ?? [],
      review: policyData?.review ?? [],
      delete: policyData?.delete ?? [],
    }
    await nextTick()
    menuTreeBridge.value?.setCheckedKeys(menuCheckedKeys.value)
    savedPermissionSnapshot.value = buildPermissionSnapshot()
    lastStableRoleId.value = selectedRoleId.value
  }

  function buildPermissionSnapshot(): string {
    const { ids, actionIds } = collectSelectedPermissionIds()
    ids.sort((a, b) => a - b)
    const norm = (arr: string[]) => [...new Set((arr ?? []).map((x) => (x ?? '').trim()).filter(Boolean))].sort()
    const normalizedPolicies = normalizePoliciesForActions(actionIds)
    const payload = {
      ids,
      policies: {
        edit: norm(normalizedPolicies.edit),
        review: norm(normalizedPolicies.review),
        delete: norm(normalizedPolicies.delete),
      },
    }
    return JSON.stringify(payload)
  }

  function hasUnsavedPermissionChanges(): boolean {
    if (!selectedRoleId.value || !savedPermissionSnapshot.value) return false
    return buildPermissionSnapshot() !== savedPermissionSnapshot.value
  }

  async function onRoleChange(nextRoleId: number) {
    if (isRevertingRoleChange.value) return
    const prevRoleId = lastStableRoleId.value
    if (prevRoleId != null && nextRoleId !== prevRoleId && hasUnsavedPermissionChanges()) {
      try {
        await ElMessageBox.confirm(
          '当前角色权限有未保存修改，切换后将丢失。是否继续切换？',
          '提示',
          { type: 'warning', confirmButtonText: '继续切换', cancelButtonText: '留在当前角色' },
        )
      } catch {
        isRevertingRoleChange.value = true
        selectedRoleId.value = prevRoleId
        await nextTick()
        isRevertingRoleChange.value = false
        return
      }
    }
    await loadRolePermissions()
  }

  async function savePermissions() {
    if (!selectedRoleId.value) return
    const { ids, actionIds } = collectSelectedPermissionIds()
    const normalizedPolicies = normalizePoliciesForActions(actionIds)
    saving.value = true
    try {
      await setRolePermissions(selectedRoleId.value, ids)
      if (selectedRoleCode?.value === 'admin') {
        await resyncAdminPermissions()
      }
      try {
        await setRoleOrderPolicies(selectedRoleId.value, normalizedPolicies)
        roleOrderPolicies.value = normalizedPolicies
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status
        if (status !== 404) {
          ElMessage.warning('主权限已保存；订单状态策略保存失败，请稍后重试')
        }
      }
      checkedIds.value = ids
      savedPermissionSnapshot.value = buildPermissionSnapshot()
      lastStableRoleId.value = selectedRoleId.value
      ElMessage.success('保存成功')
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '保存失败'))
    } finally {
      saving.value = false
    }
  }

  function resetForEmptyRoles() {
    selectedRoleId.value = null
    checkedIds.value = []
    roleOrderPolicies.value = { edit: [], review: [], delete: [] }
    savedPermissionSnapshot.value = ''
    actionDialogClosed()
    menuTreeBridge.value?.setCheckedKeys([])
  }

  return {
    permissions,
    orderStatuses,
    checkedIds,
    saving,
    menuTreeData,
    menuExpandedKeys,
    menuCheckedKeys,
    hasAnyActionPerms,
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
  }
}

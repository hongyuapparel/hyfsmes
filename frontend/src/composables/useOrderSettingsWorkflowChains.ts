import { ref, nextTick, onBeforeUnmount, type Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Sortable from 'sortablejs'
import { getSystemOptionsTree, type SystemOptionTreeNode } from '@/api/system-options'
import { getRoles, type RoleItem } from '@/api/roles'
import {
  createOrderStatusTransitionsBatch,
  getOrderWorkflowChains,
  reorderOrderWorkflowChains,
  updateOrderWorkflowChain,
  deleteOrderWorkflowChain,
  type OrderStatusTransitionItem,
  type OrderWorkflowChainWithSteps,
} from '@/api/order-status-config'

interface ChainStepRow {
  fromStatusCode: string
  toStatusCode: string
  triggerType: string
  triggerCode: string
  allowRoles: string[]
}

export function useOrderSettingsWorkflowChains(
  helpers: {
    normalizeStatusCode: (value: string) => string
    normalizeTriggerCode: (value: string) => string
    getStatusLabel: (value: string) => string
    getTriggerActionLabel: (value: string) => string
  },
  currentStatusCode: Ref<string>,
  loadTransitions: () => Promise<void>,
) {
  const chainDialog = ref({ visible: false })
  const chainEdit = ref<{ id: number | null }>({ id: null })
  const roleOptions = ref<RoleItem[]>([])
  const chainOrderTypeOptions = ref<Array<{ id: number; label: string }>>([])
  const chainCollaborationOptions = ref<Array<{ id: number; label: string }>>([])
  const chainForm = ref<{
    name: string
    orderTypeIds: number[]
    collaborationTypeIds: number[]
    hasProcessItem: '' | 'has' | 'none'
    steps: ChainStepRow[]
  }>({
    name: '',
    orderTypeIds: [],
    collaborationTypeIds: [],
    hasProcessItem: '',
    steps: [{ fromStatusCode: '', toStatusCode: '', triggerType: 'button', triggerCode: '', allowRoles: [] }],
  })
  const chainList = ref<OrderWorkflowChainWithSteps[]>([])
  const chainTableRef = ref()
  let chainSortable: Sortable | null = null

  function resetChainForm() {
    chainForm.value = {
      name: '',
      orderTypeIds: [],
      collaborationTypeIds: [],
      hasProcessItem: '',
      steps: [{ fromStatusCode: '', toStatusCode: '', triggerType: 'button', triggerCode: '', allowRoles: [] }],
    }
  }

  function openChainDialog() {
    resetChainForm()
    chainEdit.value.id = null
    chainDialog.value.visible = true
  }

  function addChainStep() {
    const prev = chainForm.value.steps[chainForm.value.steps.length - 1]
    chainForm.value.steps.push({
      fromStatusCode: prev?.toStatusCode ?? '',
      toStatusCode: '',
      triggerType: 'button',
      triggerCode: '',
      allowRoles: [],
    })
  }

  function removeChainStep(index: number) {
    chainForm.value.steps.splice(index, 1)
  }

  function buildChainSummary(steps: OrderStatusTransitionItem[]): string {
    if (!steps?.length) return '-'
    return steps
      .slice()
      .sort((a, b) => (Number(a.stepOrder ?? 0) - Number(b.stepOrder ?? 0)) || (a.id - b.id))
      .map((step) => `${helpers.getStatusLabel(step.fromStatus)}(${helpers.getTriggerActionLabel(step.triggerCode)})→${helpers.getStatusLabel(step.toStatus)}`)
      .join('；')
  }

  async function loadChains() {
    try {
      const res = await getOrderWorkflowChains()
      chainList.value = res.data ?? []
      await nextTick()
      initChainDragSort()
    } catch {
      chainList.value = []
    }
  }

  function initChainDragSort() {
    const tableEl = (chainTableRef.value as { $el?: HTMLElement } | undefined)?.$el
    const tbody = tableEl?.querySelector('.el-table__body-wrapper tbody') as HTMLElement | null
    if (!tbody) return
    chainSortable?.destroy()
    chainSortable = Sortable.create(tbody, {
      handle: '.chain-drag-handle',
      animation: 150,
      ghostClass: 'chain-drag-ghost',
      onEnd: (evt) => {
        if (evt.oldIndex == null || evt.newIndex == null || evt.oldIndex === evt.newIndex) return
        const list = chainList.value.slice()
        const [moved] = list.splice(evt.oldIndex, 1)
        if (!moved) return
        list.splice(evt.newIndex, 0, moved)
        chainList.value = list
        void persistChainOrder()
      },
    })
  }

  async function persistChainOrder() {
    try {
      await reorderOrderWorkflowChains({ orderedIds: chainList.value.map((x) => x.chain.id) })
      ElMessage.success('已保存链路顺序')
    } catch {
      ElMessage.error('保存顺序失败')
      await loadChains()
    }
  }

  onBeforeUnmount(() => chainSortable?.destroy())

  async function loadRolesForSelect() {
    try {
      const res = await getRoles()
      roleOptions.value = (res.data ?? []).filter((role) => (role.status ?? '').toLowerCase() === 'active')
    } catch {
      roleOptions.value = []
    }
  }

  async function loadOrderTypesForChain() {
    chainOrderTypeOptions.value = await loadSystemOptionFlat('order_types')
  }

  async function loadCollaborationOptionsForChain() {
    chainCollaborationOptions.value = await loadSystemOptionFlat('collaboration')
  }

  async function loadSystemOptionFlat(type: string): Promise<Array<{ id: number; label: string }>> {
    try {
      const res = await getSystemOptionsTree(type)
      const tree = (res.data ?? []) as SystemOptionTreeNode[]
      const flat: Array<{ id: number; label: string }> = []
      const walk = (nodes: SystemOptionTreeNode[], parentLabel = '') => {
        for (const node of nodes) {
          const label = parentLabel ? `${parentLabel} / ${node.value}` : node.value
          flat.push({ id: node.id, label })
          if (node.children?.length) walk(node.children, label)
        }
      }
      walk(tree)
      return flat
    } catch {
      return []
    }
  }

  function getChainConditions() {
    const conditions: { orderTypeIds?: number[]; collaborationTypeIds?: number[]; hasProcessItem?: boolean } = {}
    if (chainForm.value.orderTypeIds.length) conditions.orderTypeIds = [...chainForm.value.orderTypeIds]
    if (chainForm.value.collaborationTypeIds.length) conditions.collaborationTypeIds = [...chainForm.value.collaborationTypeIds]
    if (chainForm.value.hasProcessItem === 'has') conditions.hasProcessItem = true
    if (chainForm.value.hasProcessItem === 'none') conditions.hasProcessItem = false
    return conditions
  }

  async function submitChain() {
    const valid = chainForm.value.steps.every((step) => step.fromStatusCode && step.toStatusCode && step.triggerCode)
    if (!valid) return ElMessage.warning('请把每一步的「从状态」「到状态」「触发动作」都选好')
    const conditions = getChainConditions()
    const payload = {
      name: chainForm.value.name?.trim() || undefined,
      conditionsJson: Object.keys(conditions).length ? conditions : undefined,
      steps: chainForm.value.steps.map((step) => ({
        fromStatus: step.fromStatusCode,
        toStatus: step.toStatusCode,
        triggerType: step.triggerType,
        triggerCode: step.triggerCode,
        allowRoles: step.allowRoles.filter(Boolean).join(',') || undefined,
        enabled: true,
        conditionsJson: Object.keys(conditions).length ? { ...conditions } : undefined,
      })),
    }
    try {
      if (chainEdit.value.id) await updateOrderWorkflowChain(chainEdit.value.id, payload)
      else await createOrderStatusTransitionsBatch(payload)
      chainDialog.value.visible = false
      await loadChains()
      if (currentStatusCode.value) await loadTransitions()
    } catch (err) {
      if (!(err as { errorHandled?: boolean }).errorHandled) ElMessage.error('保存失败')
    }
  }

  function openEditChain(row: OrderWorkflowChainWithSteps) {
    const conditions = (row.chain.conditionsJson ?? {}) as { orderTypeIds?: number[]; collaborationTypeIds?: number[]; hasProcessItem?: boolean }
    chainForm.value = {
      name: row.chain.name ?? '',
      orderTypeIds: Array.isArray(conditions.orderTypeIds) ? conditions.orderTypeIds : [],
      collaborationTypeIds: Array.isArray(conditions.collaborationTypeIds) ? conditions.collaborationTypeIds : [],
      hasProcessItem: conditions.hasProcessItem === true ? 'has' : conditions.hasProcessItem === false ? 'none' : '',
      steps: (row.steps ?? []).slice().sort((a, b) => (Number(a.stepOrder ?? 0) - Number(b.stepOrder ?? 0)) || (a.id - b.id)).map((step) => ({
        fromStatusCode: helpers.normalizeStatusCode(step.fromStatus),
        toStatusCode: helpers.normalizeStatusCode(step.toStatus),
        triggerType: step.triggerType,
        triggerCode: helpers.normalizeTriggerCode(step.triggerCode),
        allowRoles: (step.allowRoles ?? '').split(',').map((x) => x.trim()).filter(Boolean),
      })),
    }
    chainEdit.value.id = row.chain.id
    chainDialog.value.visible = true
  }

  function duplicateChain(row: OrderWorkflowChainWithSteps) {
    openEditChain(row)
    const baseName = chainForm.value.name || row.chain.name || ''
    chainForm.value.name = `${baseName}（复制）`
    chainEdit.value.id = null
  }

  async function removeChain(row: OrderWorkflowChainWithSteps) {
    await ElMessageBox.confirm(`确定删除流程链路「${row.chain.name}」吗？`, '提示', { type: 'warning' })
    try {
      await deleteOrderWorkflowChain(row.chain.id)
      ElMessage.success('已删除')
      await loadChains()
    } catch (err) {
      if (!(err as { errorHandled?: boolean }).errorHandled) ElMessage.error('删除失败')
    }
  }

  return {
    chainDialog,
    chainEdit,
    roleOptions,
    chainOrderTypeOptions,
    chainCollaborationOptions,
    chainForm,
    chainList,
    chainTableRef,
    openChainDialog,
    addChainStep,
    removeChainStep,
    buildChainSummary,
    loadChains,
    loadRolesForSelect,
    loadOrderTypesForChain,
    loadCollaborationOptionsForChain,
    submitChain,
    openEditChain,
    duplicateChain,
    removeChain,
  }
}

import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getOrderStatuses,
  createOrderStatus,
  updateOrderStatus,
  deleteOrderStatus,
  getOrderStatusTransitions,
  createOrderStatusTransition,
  updateOrderStatusTransition,
  deleteOrderStatusTransition,
  type OrderStatusItem,
  type OrderStatusTransitionItem,
} from '@/api/order-status-config'
import { TRIGGER_ACTION_OPTIONS } from './orderSettingsStatusConstants'
import { useOrderSettingsWorkflowChains } from './useOrderSettingsWorkflowChains'

export { TRIGGER_ACTION_OPTIONS } from './orderSettingsStatusConstants'

export function useOrderSettingsStatus() {
  const statusList = ref<OrderStatusItem[]>([])
  const transitionList = ref<OrderStatusTransitionItem[]>([])
  const currentStatusCode = ref('')
  const currentStatusLabel = ref('')
  const statusDialog = ref<{ visible: boolean; isEdit: boolean; id?: number }>({ visible: false, isEdit: false })
  const statusForm = ref({ label: '', sortOrder: 0, isFinal: false })
  const transitionDialog = ref<{ visible: boolean; isEdit: boolean; id?: number }>({ visible: false, isEdit: false })
  const transitionForm = ref({
    fromStatus: '',
    toStatus: '',
    triggerType: 'button',
    triggerCode: '',
    nextDepartment: '',
    enabled: true,
  })

  function getStatusLabel(codeOrLabel: string): string {
    const value = (codeOrLabel ?? '').trim()
    if (!value) return '-'
    const byCode = statusList.value.find((status) => status.code === value)
    if (byCode) return byCode.label
    const byLabel = statusList.value.find((status) => status.label === value)
    return byLabel?.label ?? value
  }

  function normalizeStatusCode(codeOrLabel: string): string {
    const value = (codeOrLabel ?? '').trim()
    if (!value) return ''
    const byCode = statusList.value.find((status) => status.code === value)
    if (byCode) return byCode.code
    const byLabel = statusList.value.find((status) => status.label === value)
    return byLabel?.code ?? value
  }

  function getTriggerActionLabel(codeOrLabel: string): string {
    const value = (codeOrLabel ?? '').trim()
    if (!value) return '-'
    const hit = TRIGGER_ACTION_OPTIONS.find((item) => item.code === value)
    if (hit) return hit.label
    const byLabel = TRIGGER_ACTION_OPTIONS.find((item) => item.label === value)
    return byLabel?.label ?? value
  }

  function normalizeTriggerCode(codeOrLabel: string): string {
    const value = (codeOrLabel ?? '').trim()
    if (!value) return ''
    const hit = TRIGGER_ACTION_OPTIONS.find((item) => item.code === value)
    if (hit) return hit.code
    const byLabel = TRIGGER_ACTION_OPTIONS.find((item) => item.label === value)
    return byLabel?.code ?? value
  }

  async function loadStatuses() {
    try {
      const res = await getOrderStatuses()
      statusList.value = res.data ?? []
      if (!currentStatusCode.value && statusList.value.length) {
        const first = statusList.value[0]
        currentStatusCode.value = first.code
        currentStatusLabel.value = first.label
        await loadTransitions()
      }
    } catch {
      statusList.value = []
    }
  }

  async function loadTransitions() {
    if (!currentStatusCode.value) {
      transitionList.value = []
      return
    }
    try {
      const res = await getOrderStatusTransitions(currentStatusCode.value)
      transitionList.value = res.data ?? []
    } catch {
      transitionList.value = []
    }
  }

  function onCurrentStatusChange(row: OrderStatusItem | undefined) {
    if (!row) return
    currentStatusCode.value = row.code
    currentStatusLabel.value = row.label
    void loadTransitions()
  }

  function openCreateStatus() {
    statusDialog.value = { visible: true, isEdit: false }
    statusForm.value = { label: '', sortOrder: statusList.value.length, isFinal: false }
  }

  function openEditStatus(row: OrderStatusItem) {
    statusDialog.value = { visible: true, isEdit: true, id: row.id }
    statusForm.value = { label: row.label, sortOrder: row.sortOrder, isFinal: row.isFinal }
  }

  async function submitStatus() {
    const payload = { label: statusForm.value.label.trim(), sortOrder: statusForm.value.sortOrder, isFinal: statusForm.value.isFinal }
    if (!payload.label) {
      ElMessage.warning('请填写状态名称')
      return
    }
    try {
      if (statusDialog.value.isEdit && statusDialog.value.id != null) {
        await updateOrderStatus(statusDialog.value.id, payload)
        ElMessage.success('状态已更新')
      } else {
        await createOrderStatus(payload)
        ElMessage.success('状态已创建')
      }
      statusDialog.value.visible = false
      await loadStatuses()
    } catch (err) {
      if (!(err as { errorHandled?: boolean }).errorHandled) ElMessage.error('保存失败')
    }
  }

  async function removeStatus(row: OrderStatusItem) {
    await ElMessageBox.confirm(`确定删除状态「${row.label}」吗？`, '提示', { type: 'warning' })
    try {
      await deleteOrderStatus(row.id)
      ElMessage.success('已删除')
      await loadStatuses()
    } catch (err) {
      if (!(err as { errorHandled?: boolean }).errorHandled) ElMessage.error('删除失败')
    }
  }

  function openEditTransition(row: OrderStatusTransitionItem) {
    transitionDialog.value = { visible: true, isEdit: true, id: row.id }
    transitionForm.value = {
      fromStatus: row.fromStatus,
      toStatus: normalizeStatusCode(row.toStatus),
      triggerType: row.triggerType,
      triggerCode: normalizeTriggerCode(row.triggerCode),
      nextDepartment: row.nextDepartment ?? '',
      enabled: row.enabled,
    }
  }

  async function submitTransition() {
    const payload = {
      fromStatus: transitionForm.value.fromStatus,
      toStatus: normalizeStatusCode(transitionForm.value.toStatus),
      triggerType: transitionForm.value.triggerType,
      triggerCode: normalizeTriggerCode(transitionForm.value.triggerCode),
      nextDepartment: transitionForm.value.nextDepartment.trim() || undefined,
      enabled: transitionForm.value.enabled,
    }
    if (!payload.toStatus || !payload.triggerCode) return ElMessage.warning('请填写目标状态和触发动作')
    try {
      if (transitionDialog.value.isEdit && transitionDialog.value.id != null) {
        await updateOrderStatusTransition(transitionDialog.value.id, {
          toStatus: payload.toStatus,
          triggerType: payload.triggerType,
          triggerCode: payload.triggerCode,
          nextDepartment: payload.nextDepartment ?? null,
          enabled: payload.enabled,
        })
      } else {
        await createOrderStatusTransition(payload)
      }
      transitionDialog.value.visible = false
      await loadTransitions()
    } catch (err) {
      if (!(err as { errorHandled?: boolean }).errorHandled) ElMessage.error('保存失败')
    }
  }

  async function removeTransition(row: OrderStatusTransitionItem) {
    await ElMessageBox.confirm(`确定删除规则「${row.triggerCode}」吗？`, '提示', { type: 'warning' })
    try {
      await deleteOrderStatusTransition(row.id)
      ElMessage.success('已删除')
      await loadTransitions()
    } catch (err) {
      if (!(err as { errorHandled?: boolean }).errorHandled) ElMessage.error('删除失败')
    }
  }

  async function onToggleTransitionEnabled(row: OrderStatusTransitionItem) {
    try {
      await updateOrderStatusTransition(row.id, { enabled: row.enabled })
    } catch (err) {
      if (!(err as { errorHandled?: boolean }).errorHandled) ElMessage.error('更新失败')
      row.enabled = !row.enabled
    }
  }

  const workflow = useOrderSettingsWorkflowChains(
    { normalizeStatusCode, normalizeTriggerCode, getStatusLabel, getTriggerActionLabel },
    currentStatusCode,
    loadTransitions,
  )

  return {
    statusList,
    transitionList,
    currentStatusCode,
    currentStatusLabel,
    statusDialog,
    statusForm,
    transitionDialog,
    transitionForm,
    getStatusLabel,
    getTriggerActionLabel,
    loadStatuses,
    loadTransitions,
    onCurrentStatusChange,
    openCreateStatus,
    openEditStatus,
    submitStatus,
    removeStatus,
    openEditTransition,
    submitTransition,
    removeTransition,
    onToggleTransitionEnabled,
    ...workflow,
  }
}

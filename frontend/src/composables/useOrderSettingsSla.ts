import { ref, type Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getOrderStatusSlaList,
  createOrderStatusSla,
  updateOrderStatusSla,
  deleteOrderStatusSla,
  type OrderStatusItem,
  type OrderStatusSlaItem,
} from '@/api/order-status-config'

export function useOrderSettingsSla(statusList: Ref<OrderStatusItem[]>) {
  const slaList = ref<OrderStatusSlaItem[]>([])
  const slaDialog = ref<{ visible: boolean; id?: number }>({ visible: false })
  const slaForm = ref({ orderStatusId: 0, limitHours: 0, enabled: true })
  const slaStatusOptions = ref<OrderStatusItem[]>([])

  async function loadSlaList() {
    try {
      const res = await getOrderStatusSlaList()
      slaList.value = res.data ?? []
    } catch {
      slaList.value = []
    }
  }

  function openSlaDialog(row?: OrderStatusSlaItem) {
    if (row) {
      slaDialog.value = { visible: true, id: row.id }
      slaForm.value = {
        orderStatusId: row.orderStatusId,
        limitHours: parseFloat(row.limitHours) || 0,
        enabled: row.enabled,
      }
      const status = statusList.value.find((x) => x.id === row.orderStatusId)
      slaStatusOptions.value = status ? [status] : []
      return
    }

    slaDialog.value = { visible: true }
    const usedIds = new Set(slaList.value.map((item) => item.orderStatusId))
    slaStatusOptions.value = (statusList.value ?? []).filter((status) => !usedIds.has(status.id))
    slaForm.value = { orderStatusId: slaStatusOptions.value[0]?.id ?? 0, limitHours: 0, enabled: true }
  }

  async function submitSla() {
    const id = slaForm.value.orderStatusId
    const hours = slaForm.value.limitHours
    if (!id) {
      ElMessage.warning('请选择订单状态')
      return
    }
    if (hours < 0) {
      ElMessage.warning('合理时长不能为负数')
      return
    }
    try {
      if (slaDialog.value.id) {
        await updateOrderStatusSla(slaDialog.value.id, {
          limitHours: hours,
          enabled: slaForm.value.enabled,
        })
        ElMessage.success('已更新')
      } else {
        await createOrderStatusSla({ orderStatusId: id, limitHours: hours, enabled: slaForm.value.enabled })
        ElMessage.success('已新增')
      }
      slaDialog.value.visible = false
      await loadSlaList()
    } catch (err) {
      if (!(err as { errorHandled?: boolean }).errorHandled) ElMessage.error('保存失败')
    }
  }

  async function removeSla(row: OrderStatusSlaItem) {
    try {
      await ElMessageBox.confirm(`确定删除「${row.orderStatus?.label ?? row.orderStatusId}」的时效配置？`, '删除确认', {
        type: 'warning',
      })
      await deleteOrderStatusSla(row.id)
      ElMessage.success('已删除')
      await loadSlaList()
    } catch (error) {
      if ((error as string) !== 'cancel') ElMessage.error('删除失败')
    }
  }

  return {
    slaList,
    slaDialog,
    slaForm,
    slaStatusOptions,
    loadSlaList,
    openSlaDialog,
    submitSla,
    removeSla,
  }
}

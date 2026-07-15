import { reactive, type Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { copyOrdersToDraft, getOrderLogs, restoreOrders, type OrderListItem, type OrderOperationLogItem } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'

interface UseOrderListActionsParams {
  list: Ref<OrderListItem[]>
  selectedIds: Ref<number[]>
  hasSelection: Ref<boolean>
  isPendingReviewTab: Ref<boolean>
  pagination: { page: number }
  reloadList: () => Promise<void>
  reloadWithCounts: () => Promise<void>
}

export function useOrderListActions(params: UseOrderListActionsParams) {
  const { list, selectedIds, hasSelection, isPendingReviewTab, pagination, reloadList, reloadWithCounts } = params

  const viewDialog = reactive<{ visible: boolean; order: OrderListItem | null }>({
    visible: false,
    order: null,
  })

  const logDialog = reactive<{
    visible: boolean
    loading: boolean
    orderId: number | null
    logs: OrderOperationLogItem[]
  }>({
    visible: false,
    loading: false,
    orderId: null,
    logs: [],
  })

  const remarkDialog = reactive<{
    visible: boolean
    orderId: number | null
    initialRemark: string
  }>({
    visible: false,
    orderId: null,
    initialRemark: '',
  })

  const reviewDialog = reactive<{
    visible: boolean
    orderId: number | null
    orderNo: string
    orderIds: number[]
  }>({
    visible: false,
    orderId: null,
    orderNo: '',
    orderIds: [],
  })

  const deleteDialog = reactive<{ visible: boolean; orderIds: number[] }>({
    visible: false,
    orderIds: [],
  })

  function openDeleteDialog() {
    if (!hasSelection.value) return
    deleteDialog.orderIds = [...selectedIds.value]
    deleteDialog.visible = true
  }

  async function onOrdersDeleted() {
    pagination.page = 1
    await reloadWithCounts()
  }

  async function onBatchRestore() {
    if (!hasSelection.value) return
    try {
      await ElMessageBox.confirm(`确定恢复选中的 ${selectedIds.value.length} 条订单吗？`, '恢复订单', {
        type: 'warning',
      })
    } catch {
      return
    }
    try {
      await restoreOrders(selectedIds.value)
      ElMessage.success('已恢复选中订单')
      pagination.page = 1
      await reloadWithCounts()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '恢复失败'))
    }
  }

  function openReviewDialog() {
    if (!hasSelection.value || !isPendingReviewTab.value) return
    reviewDialog.orderIds = [...selectedIds.value]
    reviewDialog.orderId = selectedIds.value[0] ?? null
    reviewDialog.orderNo = reviewDialog.orderIds.length > 1
      ? `已选 ${reviewDialog.orderIds.length} 条订单`
      : (list.value.find((item) => item.id === reviewDialog.orderId)?.orderNo ?? '')
    reviewDialog.visible = true
  }

  async function onReviewed() {
    pagination.page = 1
    await reloadWithCounts()
  }

  async function onBatchCopyToDraft() {
    if (!hasSelection.value) return
    try {
      await ElMessageBox.confirm(`确定将选中的 ${selectedIds.value.length} 条订单复制为草稿吗？`, '复制为草稿', {
        type: 'warning',
      })
    } catch {
      return
    }
    try {
      await copyOrdersToDraft(selectedIds.value)
      ElMessage.success('已复制为草稿')
      pagination.page = 1
      await reloadWithCounts()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '复制失败'))
    }
  }

  function openRemark(order: OrderListItem) {
    remarkDialog.visible = true
    remarkDialog.orderId = order.id
    remarkDialog.initialRemark = ''
  }

  async function onRemarkSaved() {
    await reloadList()
  }

  async function openOperationLog(order: OrderListItem) {
    logDialog.visible = true
    logDialog.orderId = order.id
    logDialog.loading = true
    logDialog.logs = []
    try {
      const res = await getOrderLogs(order.id)
      logDialog.logs = res.data ?? []
    } catch (e: unknown) {
      if (!isErrorHandled(e)) {
        ElMessage.error(getErrorMessage(e, '操作记录加载失败'))
      }
    } finally {
      logDialog.loading = false
    }
  }

  return {
    viewDialog,
    logDialog,
    remarkDialog,
    reviewDialog,
    deleteDialog,
    openDeleteDialog,
    onOrdersDeleted,
    onBatchRestore,
    openReviewDialog,
    onReviewed,
    onBatchCopyToDraft,
    openRemark,
    onRemarkSaved,
    openOperationLog,
  }
}

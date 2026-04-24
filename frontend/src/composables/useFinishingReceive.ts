import { computed, reactive, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getFinishingRegisterFormData,
  registerFinishingReceive,
  type FinishingListItem,
} from '@/api/production-finishing'
import { getErrorMessage, isErrorHandled } from '@/api/request'

interface UseFinishingReceiveParams {
  selectedRows: Ref<FinishingListItem[]>
  reloadList: () => Promise<void>
  reloadTabCounts: () => Promise<void>
}

export function useFinishingReceive(params: UseFinishingReceiveParams) {
  const { selectedRows, reloadList, reloadTabCounts } = params

  const receiveDialog = reactive<{
    visible: boolean
    submitting: boolean
    formLoading: boolean
    row: FinishingListItem | null
    headers: string[]
    orderRow: (number | null)[]
    cutRow: (number | null)[]
    sewingRow: (number | null)[]
    tailReceivedQuantities: number[]
  }>({
    visible: false,
    submitting: false,
    formLoading: false,
    row: null,
    headers: [],
    orderRow: [],
    cutRow: [],
    sewingRow: [],
    tailReceivedQuantities: [],
  })

  const receiveSizeTableRows = computed(() => {
    const h = receiveDialog.headers
    if (!h.length) return []
    return [
      { key: 'order', label: '订单数量', values: receiveDialog.orderRow },
      { key: 'cut', label: '裁床数量', values: receiveDialog.cutRow },
      { key: 'sewing', label: '车缝数量', values: receiveDialog.sewingRow },
      { key: 'tail', label: '尾部收货数', values: receiveDialog.tailReceivedQuantities },
    ]
  })

  const receiveTailReceivedTotal = computed(() =>
    receiveDialog.tailReceivedQuantities.reduce((a, b) => a + (Number(b) || 0), 0),
  )

  function resetReceiveForm() {
    receiveDialog.row = null
    receiveDialog.headers = []
    receiveDialog.orderRow = []
    receiveDialog.cutRow = []
    receiveDialog.sewingRow = []
    receiveDialog.tailReceivedQuantities = []
  }

  async function openReceiveDialog() {
    const rows = selectedRows.value.filter((r) => r.finishingStatus === 'pending_receive')
    if (rows.length === 0) return
    const row = rows[0]
    receiveDialog.row = row
    receiveDialog.headers = []
    receiveDialog.orderRow = []
    receiveDialog.cutRow = []
    receiveDialog.sewingRow = []
    receiveDialog.tailReceivedQuantities = []
    receiveDialog.visible = true
    receiveDialog.formLoading = true
    try {
      const res = await getFinishingRegisterFormData(row.orderId)
      const data = res.data
      const headers = data?.headers ?? []
      const orderRow = data?.orderRow ?? []
      const cutRow = data?.cutRow ?? []
      const sewingRow = data?.sewingRow ?? []
      receiveDialog.headers = headers
      receiveDialog.orderRow = orderRow
      receiveDialog.cutRow = cutRow
      receiveDialog.sewingRow = sewingRow
      const sizeCount = headers.length > 1 ? headers.length - 1 : 1
      receiveDialog.tailReceivedQuantities = sewingRow
        .slice(0, sizeCount)
        .map((v) => (v != null ? Number(v) : 0))
      while (receiveDialog.tailReceivedQuantities.length < sizeCount) {
        receiveDialog.tailReceivedQuantities.push(0)
      }
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载尺寸细数失败'))
      receiveDialog.visible = false
    } finally {
      receiveDialog.formLoading = false
    }
  }

  async function submitReceive() {
    if (!receiveDialog.row) return
    const total = receiveTailReceivedTotal.value
    if (!total || total < 1) {
      ElMessage.warning('请填写尾部收货数（可按尺码填写）')
      return
    }
    receiveDialog.submitting = true
    try {
      await registerFinishingReceive({
        orderId: receiveDialog.row.orderId,
        tailReceivedQty: total,
        tailReceivedQuantities: receiveDialog.tailReceivedQuantities,
      })
      ElMessage.success('登记收货成功，订单已进入「尾部中」')
      receiveDialog.visible = false
      await reloadList()
      await reloadTabCounts()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '登记收货失败'))
    } finally {
      receiveDialog.submitting = false
    }
  }

  return {
    receiveDialog,
    receiveSizeTableRows,
    receiveTailReceivedTotal,
    resetReceiveForm,
    openReceiveDialog,
    submitReceive,
  }
}

import { computed, reactive, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getFinishingRegisterFormData,
  registerFinishingReceive,
  type FinishingListItem,
} from '@/api/production-finishing'
import { getErrorMessage, isErrorHandled } from '@/api/request'

interface ColorRow {
  colorName: string
  quantities: number[]
}

interface UseFinishingReceiveParams {
  selectedRows: Ref<FinishingListItem[]>
  reloadList: () => Promise<void>
  reloadTabCounts: () => Promise<void>
}

function emptyColorRows(planColors: string[], sizeLen: number): ColorRow[] {
  return planColors.map((name) => ({
    colorName: name,
    quantities: Array(sizeLen).fill(0),
  }))
}

function sumColorRowsTotal(rows: ColorRow[]): number {
  let s = 0
  for (const r of rows) {
    const q = Array.isArray(r?.quantities) ? r.quantities : []
    for (const n of q) s += Math.max(0, Math.trunc(Number(n) || 0))
  }
  return s
}

export function useFinishingReceive(params: UseFinishingReceiveParams) {
  const { selectedRows, reloadList, reloadTabCounts } = params

  const receiveDialog = reactive<{
    visible: boolean
    submitting: boolean
    formLoading: boolean
    row: FinishingListItem | null
    headers: string[]
    sizeHeaders: string[]
    orderRow: (number | null)[]
    cutRow: (number | null)[]
    sewingRow: (number | null)[]
    planColorRows: ColorRow[]
    cutColorRows: ColorRow[]
    sewingColorRows: ColorRow[]
    tailReceivedQuantitiesByColor: ColorRow[]
  }>({
    visible: false,
    submitting: false,
    formLoading: false,
    row: null,
    headers: [],
    sizeHeaders: [],
    orderRow: [],
    cutRow: [],
    sewingRow: [],
    planColorRows: [],
    cutColorRows: [],
    sewingColorRows: [],
    tailReceivedQuantitiesByColor: [],
  })

  const receiveSizeTableRows = computed(() => {
    const h = receiveDialog.headers
    if (!h.length) return []
    return [
      { key: 'order', label: '订单数量', values: receiveDialog.orderRow },
      { key: 'cut', label: '裁床数量', values: receiveDialog.cutRow },
      { key: 'sewing', label: '车缝数量', values: receiveDialog.sewingRow },
    ]
  })

  const receiveTailReceivedTotal = computed(() => sumColorRowsTotal(receiveDialog.tailReceivedQuantitiesByColor))

  /** 每格上限：等于该颜色对应尺码的车缝数（收货数不能超过车缝数） */
  function receiveCellMax(rowIdx: number, colIdx: number): number | undefined {
    const v = receiveDialog.sewingColorRows[rowIdx]?.quantities?.[colIdx]
    return v != null && Number.isFinite(Number(v)) ? Number(v) : undefined
  }

  function resetReceiveForm() {
    receiveDialog.row = null
    receiveDialog.headers = []
    receiveDialog.sizeHeaders = []
    receiveDialog.orderRow = []
    receiveDialog.cutRow = []
    receiveDialog.sewingRow = []
    receiveDialog.planColorRows = []
    receiveDialog.cutColorRows = []
    receiveDialog.sewingColorRows = []
    receiveDialog.tailReceivedQuantitiesByColor = []
  }

  async function openReceiveDialog() {
    const rows = selectedRows.value.filter((r) => r.finishingStatus === 'pending_receive')
    if (rows.length === 0) return
    const row = rows[0]
    receiveDialog.row = row
    resetReceiveForm()
    receiveDialog.row = row
    receiveDialog.visible = true
    receiveDialog.formLoading = true
    try {
      const res = await getFinishingRegisterFormData(row.orderId)
      const data = res.data
      const headers = data?.headers ?? []
      const sizeHeaders = Array.isArray(data?.sizeHeaders) ? data.sizeHeaders : []
      const sizeLen = sizeHeaders.length
      const planColors = Array.isArray(data?.planColorRows) ? data.planColorRows.map((r) => r.colorName) : []
      const cutColorRows = Array.isArray(data?.cutColorRows) ? data.cutColorRows : emptyColorRows(planColors, sizeLen)
      const sewingColorRows = Array.isArray(data?.sewingColorRows) && data.sewingColorRows.length
        ? data.sewingColorRows
        : emptyColorRows(planColors, sizeLen)
      receiveDialog.headers = headers
      receiveDialog.sizeHeaders = sizeHeaders
      receiveDialog.orderRow = data?.orderRow ?? []
      receiveDialog.cutRow = data?.cutRow ?? []
      receiveDialog.sewingRow = data?.sewingRow ?? []
      receiveDialog.planColorRows = Array.isArray(data?.planColorRows) ? data.planColorRows : []
      receiveDialog.cutColorRows = cutColorRows
      receiveDialog.sewingColorRows = sewingColorRows
      // 默认：把"车缝按颜色×尺码"作为收货默认值（用户大概率收的就是车缝量）
      receiveDialog.tailReceivedQuantitiesByColor = sewingColorRows.map((r) => ({
        colorName: r.colorName,
        quantities: [...r.quantities],
      }))
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
      ElMessage.warning('请填写尾部收货数（按颜色×尺码）')
      return
    }
    receiveDialog.submitting = true
    try {
      await registerFinishingReceive({
        orderId: receiveDialog.row.orderId,
        tailReceivedQty: total,
        tailReceivedQuantitiesByColor: receiveDialog.tailReceivedQuantitiesByColor,
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
    receiveCellMax,
    resetReceiveForm,
    openReceiveDialog,
    submitReceive,
  }
}

import { reactive, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getFinishingRegisterFormData,
  registerFinishingPackagingComplete,
  type FinishingListItem,
} from '@/api/production-finishing'
import { getErrorMessage, isErrorHandled } from '@/api/request'

export interface PackagingCompleteItem {
  row: FinishingListItem
  headers: string[]
  orderRow: (number | null)[]
  cutRow: (number | null)[]
  sewingRow: (number | null)[]
  tailReceivedRow: (number | null)[]
  inboundQuantities: number[]
  defectQuantities: number[]
  remark: string
}

interface UseFinishingPackagingParams {
  selectedRows: Ref<FinishingListItem[]>
  reloadList: () => Promise<void>
  reloadTabCounts: () => Promise<void>
}

export function useFinishingPackaging(params: UseFinishingPackagingParams) {
  const { selectedRows, reloadList, reloadTabCounts } = params

  const packagingCompleteDialog = reactive<{
    visible: boolean
    mode: 'register' | 'amend'
    submitting: boolean
    formLoading: boolean
    items: PackagingCompleteItem[]
  }>({ visible: false, mode: 'register', submitting: false, formLoading: false, items: [] })

  function resetPackagingCompleteDialog() {
    packagingCompleteDialog.items = []
    packagingCompleteDialog.mode = 'register'
  }

  function defectTotal(item: PackagingCompleteItem): number {
    return (item.defectQuantities ?? []).reduce((a, b) => a + (Number(b) || 0), 0)
  }

  function packagingSizeTableRows(item: PackagingCompleteItem) {
    const received = item.row.tailReceivedQty ?? 0
    const i = item.inboundQuantities
    const sumI = i.reduce((a, b) => a + b, 0)
    const sumD = defectTotal(item)
    const valuesReceived =
      Array.isArray(item.tailReceivedRow) && item.tailReceivedRow.length === item.headers.length
        ? item.tailReceivedRow
        : item.headers.length === 1
          ? [received]
          : [...Array(item.headers.length - 1).fill(null), received]
    const valuesInbound = item.headers.length === 1 ? [...i] : [...i, sumI]
    return [
      { key: 'tail_received', label: '尾部收货数', values: valuesReceived },
      { key: 'inbound', label: '入库数', values: valuesInbound },
      { key: 'defect', label: '次品数', values: item.headers.length === 1 ? [...item.defectQuantities] : [...item.defectQuantities, sumD] },
    ]
  }

  function packagingSetZero(item: PackagingCompleteItem) {
    item.inboundQuantities.fill(0)
    item.defectQuantities.fill(0)
  }

  function packagingSetInboundToReceived(item: PackagingCompleteItem) {
    const total = item.row.tailReceivedQty ?? 0
    const len = item.inboundQuantities.length
    if (len === 0) return
    const sizeValues = Array.isArray(item.tailReceivedRow) && item.tailReceivedRow.length === item.headers.length
      ? item.tailReceivedRow.slice(0, len).map((v) => (v != null ? Number(v) : 0))
      : null
    if (sizeValues) {
      for (let i = 0; i < len; i++) item.inboundQuantities[i] = Math.max(0, Number(sizeValues[i]) || 0)
    } else {
      item.inboundQuantities[0] = total
      for (let i = 1; i < len; i++) item.inboundQuantities[i] = 0
    }
    item.defectQuantities.fill(0)
  }

  function maxPackagingQtyForSize(item: PackagingCompleteItem, hIdx: number): number {
    const tr = item.tailReceivedRow
    if (Array.isArray(tr) && tr.length > hIdx && tr[hIdx] != null && Number.isFinite(Number(tr[hIdx]))) {
      return Number(tr[hIdx]) || 0
    }
    return item.row.tailReceivedQty ?? 0
  }

  function maxDefectQtyForSize(item: PackagingCompleteItem, hIdx: number): number {
    return maxPackagingQtyForSize(item, hIdx)
  }

  function assertPackagingPerSize(item: PackagingCompleteItem): string | null {
    const h = item.headers
    if (h.length <= 1) return null
    const tr = item.tailReceivedRow
    if (!Array.isArray(tr) || tr.length !== h.length) return null
    const sizeCount = h.length - 1
    for (let i = 0; i < sizeCount; i++) {
      if (tr[i] == null || !Number.isFinite(Number(tr[i]))) return null
    }
    for (let i = 0; i < sizeCount; i++) {
      const a = Number(item.inboundQuantities[i]) || 0
      const b = Number(item.defectQuantities[i]) || 0
      const r = Number(tr[i]) || 0
      if (a + b !== r) {
        return `订单 ${item.row.orderNo}：尺码 ${h[i]} 入库数+次品数须等于该码尾部收货数(${r})`
      }
    }
    return null
  }

  function hydratePackagingQtyFromSaved(
    item: PackagingCompleteItem,
    inbRow: (number | null)[] | null | undefined,
    defRow: (number | null)[] | null | undefined,
    inbTotal: number,
    defTotal: number,
  ) {
    const headers = item.headers
    const sizeCount = headers.length > 1 ? headers.length - 1 : 1
    const takePerSize = (r: (number | null)[] | null | undefined): number[] | null => {
      if (!r || r.length === 0) return null
      if (r.length >= headers.length) return r.slice(0, sizeCount).map((v) => Number(v) || 0)
      if (r.length === sizeCount) return r.map((v) => Number(v) || 0)
      return null
    }
    const perIn = takePerSize(inbRow)
    const perDef = takePerSize(defRow)
    if (perIn && perDef && perIn.length === sizeCount && perDef.length === sizeCount) {
      const sumI = perIn.reduce((a, b) => a + b, 0)
      const sumD = perDef.reduce((a, b) => a + b, 0)
      if (sumI === inbTotal && sumD === defTotal) {
        for (let i = 0; i < sizeCount; i++) {
          item.inboundQuantities[i] = perIn[i]
          item.defectQuantities[i] = perDef[i]
        }
        return
      }
    }
    item.inboundQuantities[0] = inbTotal
    for (let i = 1; i < sizeCount; i++) item.inboundQuantities[i] = 0
    item.defectQuantities[0] = defTotal
    for (let i = 1; i < sizeCount; i++) item.defectQuantities[i] = 0
  }

  async function openPackagingCompleteDialog() {
    const rows = selectedRows.value.filter((r) => r.finishingStatus === 'pending_assign')
    if (rows.length === 0) return
    packagingCompleteDialog.mode = 'register'
    packagingCompleteDialog.visible = true
    packagingCompleteDialog.formLoading = true
    packagingCompleteDialog.items = []
    try {
      for (const row of rows) {
        const res = await getFinishingRegisterFormData(row.orderId)
        const data = res.data
        const headers = data?.headers ?? ['合计']
        const orderRow = data?.orderRow ?? []
        const cutRow = data?.cutRow ?? []
        const sewingRow = data?.sewingRow ?? []
        const tailReceivedRow = data?.tailReceivedRow ?? []
        const sizeCount = headers.length > 1 ? headers.length - 1 : 1
        const item: PackagingCompleteItem = {
          row,
          headers,
          orderRow,
          cutRow,
          sewingRow,
          tailReceivedRow,
          inboundQuantities: Array(sizeCount).fill(0),
          defectQuantities: Array(sizeCount).fill(0),
          remark: '',
        }
        packagingSetInboundToReceived(item)
        packagingCompleteDialog.items.push(item)
      }
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载尺寸细数失败'))
      packagingCompleteDialog.visible = false
    } finally {
      packagingCompleteDialog.formLoading = false
    }
  }

  async function openPackagingAmendDialog() {
    const rows = selectedRows.value.filter((r) => r.finishingStatus === 'inbound')
    if (rows.length === 0) return
    packagingCompleteDialog.mode = 'amend'
    packagingCompleteDialog.visible = true
    packagingCompleteDialog.formLoading = true
    packagingCompleteDialog.items = []
    try {
      for (const row of rows) {
        const res = await getFinishingRegisterFormData(row.orderId)
        const data = res.data
        const headers = data?.headers ?? ['合计']
        const orderRow = data?.orderRow ?? []
        const cutRow = data?.cutRow ?? []
        const sewingRow = data?.sewingRow ?? []
        const tailReceivedRow = data?.tailReceivedRow ?? []
        const sizeCount = headers.length > 1 ? headers.length - 1 : 1
        const item: PackagingCompleteItem = {
          row,
          headers,
          orderRow,
          cutRow,
          sewingRow,
          tailReceivedRow,
          inboundQuantities: Array(sizeCount).fill(0),
          defectQuantities: Array(sizeCount).fill(0),
          remark: row.remark?.trim() ?? '',
        }
        const inb = row.tailInboundQty ?? 0
        const def = row.defectQuantity ?? 0
        hydratePackagingQtyFromSaved(item, data?.tailInboundRow, data?.defectRow, inb, def)
        packagingCompleteDialog.items.push(item)
      }
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载尺寸细数失败'))
      packagingCompleteDialog.visible = false
    } finally {
      packagingCompleteDialog.formLoading = false
    }
  }

  async function submitPackagingComplete() {
    if (packagingCompleteDialog.items.length === 0) return
    for (const item of packagingCompleteDialog.items) {
      const perMsg = assertPackagingPerSize(item)
      if (perMsg) {
        ElMessage.warning(perMsg)
        return
      }
      const received = item.row.tailReceivedQty ?? 0
      const sumInbound = item.inboundQuantities.reduce((a, b) => a + (Number(b) || 0), 0)
      const defect = defectTotal(item)
      if (sumInbound + defect !== received) {
        ElMessage.warning(`订单 ${item.row.orderNo}：入库数合计(${sumInbound})+次品数(${defect}) 须等于尾部收货数(${received})`)
        return
      }
    }
    packagingCompleteDialog.submitting = true
    try {
      for (const item of packagingCompleteDialog.items) {
        const sumInbound = item.inboundQuantities.reduce((a, b) => a + (Number(b) || 0), 0)
        const defect = defectTotal(item)
        await registerFinishingPackagingComplete({
          orderId: item.row.orderId,
          tailShippedQty: 0,
          tailInboundQty: sumInbound,
          defectQuantity: defect,
          remark: item.remark?.trim() || undefined,
          tailInboundQuantities: [...item.inboundQuantities],
          defectQuantities: [...item.defectQuantities],
        })
      }
      ElMessage.success(
        packagingCompleteDialog.mode === 'amend'
          ? '已更新入库/次品登记，待仓处理记录已按新数量重建'
          : '登记包装完成：已生成待仓处理记录，订单已完成',
      )
      packagingCompleteDialog.visible = false
      resetPackagingCompleteDialog()
      await reloadList()
      await reloadTabCounts()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '登记包装完成失败'))
    } finally {
      packagingCompleteDialog.submitting = false
    }
  }

  return {
    packagingCompleteDialog,
    resetPackagingCompleteDialog,
    packagingSizeTableRows,
    defectTotal,
    packagingSetZero,
    packagingSetInboundToReceived,
    maxPackagingQtyForSize,
    maxDefectQtyForSize,
    openPackagingCompleteDialog,
    openPackagingAmendDialog,
    submitPackagingComplete,
  }
}

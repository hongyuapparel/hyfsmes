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

  function inboundTotal(item: PackagingCompleteItem): number {
    return (item.inboundQuantities ?? []).reduce((a, b) => a + (Number(b) || 0), 0)
  }

  /** 该订单此前已登记的入库数 */
  function alreadyInboundQty(item: PackagingCompleteItem): number {
    return Number(item.row.tailInboundQty ?? 0)
  }

  /** 该订单此前已登记的次品数 */
  function alreadyDefectQty(item: PackagingCompleteItem): number {
    return Number(item.row.defectQuantity ?? 0)
  }

  /** 尾部收货数减去已登记入库/次品后，剩余可登记数 */
  function remainingQty(item: PackagingCompleteItem): number {
    return Number(item.row.tailReceivedQty ?? 0) - alreadyInboundQty(item) - alreadyDefectQty(item)
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
        // 分批入库：首次打开从 0 开始，由用户显式填入本批数量
        packagingSetZero(item)
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

  async function submitPackagingComplete(mode: 'partial' | 'full') {
    if (packagingCompleteDialog.items.length === 0) return
    const isAmend = packagingCompleteDialog.mode === 'amend'
    for (const item of packagingCompleteDialog.items) {
      const sumInbound = inboundTotal(item)
      const defect = defectTotal(item)
      if (isAmend) {
        // 修正模式：维持原校验——按尺码须等于该码尾部收货数（覆盖式）
        const perMsg = assertPackagingPerSize(item)
        if (perMsg) {
          ElMessage.warning(perMsg)
          return
        }
        // 修正模式：维持原校验——入库数+次品数须等于尾部收货数（覆盖式）
        const received = item.row.tailReceivedQty ?? 0
        if (sumInbound + defect !== received) {
          ElMessage.warning(`订单 ${item.row.orderNo}：入库数合计(${sumInbound})+次品数(${defect}) 须等于尾部收货数(${received})`)
          return
        }
      } else {
        const remaining = remainingQty(item)
        const sumThis = sumInbound + defect
        if (sumThis <= 0) {
          ElMessage.warning(`订单 ${item.row.orderNo}：本次入库数 + 次品数必须大于 0`)
          return
        }
        if (sumThis > remaining) {
          ElMessage.warning(`订单 ${item.row.orderNo}：本次合计(${sumThis})超过剩余可登记数(${remaining})`)
          return
        }
        if (mode === 'full' && sumThis !== remaining) {
          ElMessage.warning(`订单 ${item.row.orderNo}：「全部入库」需要填满剩余 ${remaining} 件，当前差 ${remaining - sumThis} 件`)
          return
        }
      }
    }
    packagingCompleteDialog.submitting = true
    try {
      for (const item of packagingCompleteDialog.items) {
        const sumInbound = inboundTotal(item)
        const defect = defectTotal(item)
        await registerFinishingPackagingComplete({
          orderId: item.row.orderId,
          mode: isAmend ? 'full' : mode,
          tailInboundQty: sumInbound,
          defectQuantity: defect,
          remark: item.remark?.trim() || undefined,
          tailInboundQuantities: [...item.inboundQuantities],
          defectQuantities: [...item.defectQuantities],
        })
      }
      ElMessage.success(
        isAmend
          ? '已更新入库/次品登记'
          : mode === 'full'
            ? '已登记全部入库，订单进入下一阶段'
            : '已登记本次入库，订单保留在「尾部中」继续等待下一批',
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
    inboundTotal,
    alreadyInboundQty,
    alreadyDefectQty,
    remainingQty,
    packagingSetZero,
    packagingSetInboundToReceived,
    maxPackagingQtyForSize,
    maxDefectQtyForSize,
    openPackagingCompleteDialog,
    openPackagingAmendDialog,
    submitPackagingComplete,
  }
}

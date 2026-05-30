import { reactive, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getFinishingRegisterFormData,
  registerFinishingPackagingComplete,
  type FinishingListItem,
} from '@/api/production-finishing'
import { getErrorMessage, isErrorHandled } from '@/api/request'

interface ColorRow {
  colorName: string
  quantities: number[]
}

export interface PackagingCompleteItem {
  row: FinishingListItem
  /** 含合计列（旧 UI 残留） */
  headers: string[]
  /** 不含合计列的尺码 headers，用于二维矩阵 */
  sizeHeaders: string[]
  /** 各只读参考行（旧表格用） */
  orderRow: (number | null)[]
  cutRow: (number | null)[]
  sewingRow: (number | null)[]
  tailReceivedRow: (number | null)[]
  /** 按颜色×尺码的尾部收货数（真值；用于限制每格最大值） */
  tailReceivedColorRows: ColorRow[]
  /** 此前累计入库（已登记，按颜色×尺码） */
  alreadyInboundColorRows: ColorRow[]
  /** 此前累计次品（已登记，按颜色×尺码） */
  alreadyDefectColorRows: ColorRow[]
  /** 本次入库按颜色×尺码（用户输入） */
  inboundQuantitiesByColor: ColorRow[]
  /** 本次次品按颜色×尺码（用户输入） */
  defectQuantitiesByColor: ColorRow[]
  remark: string
}

interface UseFinishingPackagingParams {
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

function sumColorRowsBySize(rows: ColorRow[], sizeLen: number): number[] {
  const out = Array(sizeLen).fill(0) as number[]
  for (const r of rows) {
    const q = Array.isArray(r?.quantities) ? r.quantities : []
    for (let i = 0; i < sizeLen; i++) out[i] += Math.max(0, Math.trunc(Number(q[i]) || 0))
  }
  return out
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
    return sumColorRowsTotal(item.defectQuantitiesByColor)
  }

  function inboundTotal(item: PackagingCompleteItem): number {
    return sumColorRowsTotal(item.inboundQuantitiesByColor)
  }

  function alreadyInboundQty(item: PackagingCompleteItem): number {
    return Number(item.row.tailInboundQty ?? 0)
  }

  function alreadyDefectQty(item: PackagingCompleteItem): number {
    return Number(item.row.defectQuantity ?? 0)
  }

  function remainingQty(item: PackagingCompleteItem): number {
    return Number(item.row.tailReceivedQty ?? 0) - alreadyInboundQty(item) - alreadyDefectQty(item)
  }

  /** 旧表格：保留尾部收货数 只读行（用于上方对照） */
  function packagingSizeTableRows(item: PackagingCompleteItem) {
    const received = item.row.tailReceivedQty ?? 0
    const valuesReceived =
      Array.isArray(item.tailReceivedRow) && item.tailReceivedRow.length === item.headers.length
        ? item.tailReceivedRow
        : item.headers.length === 1
          ? [received]
          : [...Array(item.headers.length - 1).fill(null), received]
    return [{ key: 'tail_received', label: '尾部收货数', values: valuesReceived }]
  }

  function packagingSetZero(item: PackagingCompleteItem) {
    const sizeLen = item.sizeHeaders.length
    item.inboundQuantitiesByColor = emptyColorRows(item.inboundQuantitiesByColor.map((r) => r.colorName), sizeLen)
    item.defectQuantitiesByColor = emptyColorRows(item.defectQuantitiesByColor.map((r) => r.colorName), sizeLen)
  }

  /** 一键把"剩余可登记的颜色×尺码"填给入库（用户最常用动作） */
  function packagingSetInboundToReceived(item: PackagingCompleteItem) {
    const sizeLen = item.sizeHeaders.length
    if (sizeLen <= 0) return
    item.inboundQuantitiesByColor = item.tailReceivedColorRows.map((r, ri) => {
      const already = item.alreadyInboundColorRows[ri]?.quantities ?? Array(sizeLen).fill(0)
      const def = item.alreadyDefectColorRows[ri]?.quantities ?? Array(sizeLen).fill(0)
      const quantities = Array.from({ length: sizeLen }, (_, ci) => {
        const remain = (Number(r.quantities[ci]) || 0) - (Number(already[ci]) || 0) - (Number(def[ci]) || 0)
        return Math.max(0, remain)
      })
      return { colorName: r.colorName, quantities }
    })
    item.defectQuantitiesByColor = emptyColorRows(
      item.tailReceivedColorRows.map((r) => r.colorName),
      sizeLen,
    )
  }

  /** 入库每格上限：颜色 ri 尺码 ci 剩余 = 尾部收货[ri][ci] − 已入库[ri][ci] − 已次品[ri][ci] − 本次次品[ri][ci] */
  function inboundCellMax(item: PackagingCompleteItem, ri: number, ci: number): number | undefined {
    const r = Number(item.tailReceivedColorRows[ri]?.quantities?.[ci] ?? 0)
    const a = Number(item.alreadyInboundColorRows[ri]?.quantities?.[ci] ?? 0)
    const d = Number(item.alreadyDefectColorRows[ri]?.quantities?.[ci] ?? 0)
    const td = Number(item.defectQuantitiesByColor[ri]?.quantities?.[ci] ?? 0)
    return Math.max(0, r - a - d - td)
  }

  /** 次品每格上限：同理但本次入库占用 */
  function defectCellMax(item: PackagingCompleteItem, ri: number, ci: number): number | undefined {
    const r = Number(item.tailReceivedColorRows[ri]?.quantities?.[ci] ?? 0)
    const a = Number(item.alreadyInboundColorRows[ri]?.quantities?.[ci] ?? 0)
    const d = Number(item.alreadyDefectColorRows[ri]?.quantities?.[ci] ?? 0)
    const ti = Number(item.inboundQuantitiesByColor[ri]?.quantities?.[ci] ?? 0)
    return Math.max(0, r - a - d - ti)
  }

  function assertPackagingPerCell(item: PackagingCompleteItem, mode: 'register' | 'amend'): string | null {
    const sizeLen = item.sizeHeaders.length
    if (sizeLen === 0) return null
    const rows = item.tailReceivedColorRows
    if (mode === 'amend') {
      // 覆盖式：每格 入库 + 次品 = 尾部收货
      for (let ri = 0; ri < rows.length; ri++) {
        for (let ci = 0; ci < sizeLen; ci++) {
          const r = Number(rows[ri]?.quantities?.[ci] ?? 0)
          const ti = Number(item.inboundQuantitiesByColor[ri]?.quantities?.[ci] ?? 0)
          const td = Number(item.defectQuantitiesByColor[ri]?.quantities?.[ci] ?? 0)
          if (ti + td !== r) {
            return `订单 ${item.row.orderNo}：${rows[ri].colorName}/${item.sizeHeaders[ci]} 入库+次品须等于该格尾部收货(${r})`
          }
        }
      }
      return null
    }
    // 分批：每格 已入库 + 已次品 + 本次入库 + 本次次品 ≤ 尾部收货
    for (let ri = 0; ri < rows.length; ri++) {
      for (let ci = 0; ci < sizeLen; ci++) {
        const r = Number(rows[ri]?.quantities?.[ci] ?? 0)
        const a = Number(item.alreadyInboundColorRows[ri]?.quantities?.[ci] ?? 0)
        const d = Number(item.alreadyDefectColorRows[ri]?.quantities?.[ci] ?? 0)
        const ti = Number(item.inboundQuantitiesByColor[ri]?.quantities?.[ci] ?? 0)
        const td = Number(item.defectQuantitiesByColor[ri]?.quantities?.[ci] ?? 0)
        if (a + d + ti + td > r) {
          return `订单 ${item.row.orderNo}：${rows[ri].colorName}/${item.sizeHeaders[ci]} 合计(${a + d + ti + td})超过尾部收货(${r})`
        }
      }
    }
    return null
  }

  async function buildItem(row: FinishingListItem, mode: 'register' | 'amend'): Promise<PackagingCompleteItem | null> {
    const res = await getFinishingRegisterFormData(row.orderId)
    const data = res.data
    const headers = data?.headers ?? ['合计']
    const sizeHeaders = Array.isArray(data?.sizeHeaders) ? data.sizeHeaders : []
    const sizeLen = sizeHeaders.length
    const planColors = Array.isArray(data?.planColorRows) ? data.planColorRows.map((r) => r.colorName) : []
    const tailReceivedColorRows = Array.isArray(data?.tailReceivedColorRows) && data.tailReceivedColorRows.length
      ? data.tailReceivedColorRows
      : planColors.map((name) => ({ colorName: name, quantities: Array(sizeLen).fill(0) }))
    const alreadyInboundColorRows = Array.isArray(data?.tailInboundColorRows) && data.tailInboundColorRows.length
      ? data.tailInboundColorRows
      : emptyColorRows(planColors, sizeLen)
    const alreadyDefectColorRows = Array.isArray(data?.defectColorRows) && data.defectColorRows.length
      ? data.defectColorRows
      : emptyColorRows(planColors, sizeLen)

    const item: PackagingCompleteItem = {
      row,
      headers,
      sizeHeaders,
      orderRow: data?.orderRow ?? [],
      cutRow: data?.cutRow ?? [],
      sewingRow: data?.sewingRow ?? [],
      tailReceivedRow: data?.tailReceivedRow ?? [],
      tailReceivedColorRows,
      alreadyInboundColorRows,
      alreadyDefectColorRows,
      inboundQuantitiesByColor: emptyColorRows(planColors, sizeLen),
      defectQuantitiesByColor: emptyColorRows(planColors, sizeLen),
      remark: mode === 'amend' ? row.remark?.trim() ?? '' : '',
    }

    if (mode === 'amend') {
      // 修正模式：把已累计入库/次品填入当前编辑值（覆盖式编辑）
      item.inboundQuantitiesByColor = alreadyInboundColorRows.map((r) => ({
        colorName: r.colorName,
        quantities: [...r.quantities],
      }))
      item.defectQuantitiesByColor = alreadyDefectColorRows.map((r) => ({
        colorName: r.colorName,
        quantities: [...r.quantities],
      }))
    }
    return item
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
        const item = await buildItem(row, 'register')
        if (item) packagingCompleteDialog.items.push(item)
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
        const item = await buildItem(row, 'amend')
        if (item) packagingCompleteDialog.items.push(item)
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
      const cellMsg = assertPackagingPerCell(item, isAmend ? 'amend' : 'register')
      if (cellMsg) {
        ElMessage.warning(cellMsg)
        return
      }
      if (isAmend) {
        const received = item.row.tailReceivedQty ?? 0
        if (sumInbound + defect !== received) {
          ElMessage.warning(`订单 ${item.row.orderNo}：入库合计(${sumInbound})+次品(${defect}) 须等于尾部收货数(${received})`)
          return
        }
      } else {
        const remaining = remainingQty(item)
        const sumThis = sumInbound + defect
        if (sumThis <= 0) {
          ElMessage.warning(`订单 ${item.row.orderNo}：本次入库 + 次品必须大于 0`)
          return
        }
        if (sumThis > remaining) {
          ElMessage.warning(`订单 ${item.row.orderNo}：本次合计(${sumThis})超过剩余可登记数(${remaining})`)
          return
        }
        if (mode === 'full' && sumThis !== remaining) {
          ElMessage.warning(`订单 ${item.row.orderNo}：「全部入库」需填满剩余 ${remaining}，当前差 ${remaining - sumThis}`)
          return
        }
      }
    }
    packagingCompleteDialog.submitting = true
    try {
      for (const item of packagingCompleteDialog.items) {
        const sizeLen = item.sizeHeaders.length
        const inbound1D = sumColorRowsBySize(item.inboundQuantitiesByColor, sizeLen)
        const defect1D = sumColorRowsBySize(item.defectQuantitiesByColor, sizeLen)
        const sumInbound = inboundTotal(item)
        const defect = defectTotal(item)
        await registerFinishingPackagingComplete({
          orderId: item.row.orderId,
          mode: isAmend ? 'full' : mode,
          tailInboundQty: sumInbound,
          defectQuantity: defect,
          remark: item.remark?.trim() || undefined,
          tailInboundQuantities: inbound1D,
          defectQuantities: defect1D,
          tailInboundQuantitiesByColor: item.inboundQuantitiesByColor,
          defectQuantitiesByColor: item.defectQuantitiesByColor,
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
    inboundCellMax,
    defectCellMax,
    openPackagingCompleteDialog,
    openPackagingAmendDialog,
    submitPackagingComplete,
  }
}

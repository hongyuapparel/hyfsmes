import { computed, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { finishedOutbound, getFinishedPickupUserOptions, type FinishedPickupUserOption } from '@/api/inventory'
import { getOrderColorSizeBreakdown, type OrderColorSizeBreakdownRes } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getSizeHeaderKey, normalizeSizeHeader, sortSizeHeaders } from '@/utils/sizeHeaders'

type StockSnapshot = {
  headers: string[]
  rows: Array<{ colorName?: string; values?: number[] }>
}

export type FinishedOutboundStockInfo = {
  id: number
  orderId: number | null
  orderNo: string
  skuCode: string
  customerName: string
  quantity: number
  imageUrl: string
  colorName: string
  sizeBreakdown: StockSnapshot | null
  colorImages: Array<{ colorName: string; imageUrl: string }>
}

export type FinishedOutboundDialogRow = {
  colorName: string
  imageUrl: string
  quantities: number[]
}

export type FinishedOutboundDialogItem = {
  stock: FinishedOutboundStockInfo
  headers: string[]
  rows: FinishedOutboundDialogRow[]
}

type OutboundPayloadItem = {
  id: number
  quantity: number
  sizeBreakdown: {
    headers: string[]
    rows: Array<{ colorName: string; quantities: number[] }>
  }
}

function normalizeColorName(value: unknown): string {
  return String(value ?? '').trim()
}

function getRowTotal(row: { quantities: unknown[] }): number {
  return row.quantities.reduce<number>((sum, qty) => sum + Math.max(0, Math.trunc(Number(qty) || 0)), 0)
}

function getColorImage(stock: FinishedOutboundStockInfo, colorName: string): string {
  const normalized = normalizeColorName(colorName)
  const matched = stock.colorImages.find(
    (item) => normalizeColorName(item.colorName) === normalized && String(item.imageUrl || '').trim(),
  )
  return String(matched?.imageUrl || stock.imageUrl || '').trim()
}

function toHeaders(headers: string[]): string[] {
  return sortSizeHeaders(headers.map(normalizeSizeHeader).filter(Boolean))
}

function remapQuantities(sourceHeaders: string[], values: unknown[], targetHeaders: string[]): number[] {
  const indexMap = new Map(sourceHeaders.map((header, index) => [getSizeHeaderKey(header), index]))
  return targetHeaders.map((header) => {
    const index = indexMap.get(getSizeHeaderKey(header))
    return index == null ? 0 : Math.max(0, Math.trunc(Number(values[index]) || 0))
  })
}

function mergeHeaders(left: string[], right: string[]): string[] {
  const merged = [...left]
  right.forEach((header) => {
    if (!merged.some((item) => getSizeHeaderKey(item) === getSizeHeaderKey(header))) merged.push(header)
  })
  return sortSizeHeaders(merged)
}

function toSnapshotRows(
  stock: FinishedOutboundStockInfo,
  sourceHeaders: string[],
  headers: string[],
  rows: Array<{ colorName?: string; values?: number[] }>,
): FinishedOutboundDialogRow[] {
  return rows.map((item) => ({
    colorName: normalizeColorName(item.colorName) || '-',
    imageUrl: getColorImage(stock, normalizeColorName(item.colorName)),
    quantities: remapQuantities(sourceHeaders, item.values ?? [], headers),
  }))
}

export function useFinishedOutboundDialog(emitSubmitted: () => void, closeDialog: () => void) {
  const outboundLoading = ref(false)
  const submitting = ref(false)
  const outboundFormRef = ref<FormInstance>()
  const pickupUserOptions = ref<FinishedPickupUserOption[]>([])
  const outboundForm = reactive({ pickupUserId: null as number | null })
  const outboundRules: FormRules = {
    pickupUserId: [{ required: true, message: '请选择领取人', trigger: 'change' }],
  }
  const outboundItems = ref<FinishedOutboundDialogItem[]>([])

  const outboundGrandTotal = computed(() =>
    outboundItems.value.reduce((sum, item) => sum + getOutboundItemTotal(item), 0),
  )

  async function loadPickupUsers() {
    try {
      const res = await getFinishedPickupUserOptions()
      pickupUserOptions.value = res.data ?? []
    } catch {
      pickupUserOptions.value = []
    }
  }

  function resetOutboundForm() {
    outboundForm.pickupUserId = null
    outboundItems.value = []
    outboundFormRef.value?.clearValidate()
  }

  async function buildDialogItem(stock: FinishedOutboundStockInfo): Promise<FinishedOutboundDialogItem> {
    const snapshot = stock.sizeBreakdown
    if (snapshot?.headers?.length && snapshot.rows?.length) {
      const sourceHeaders = snapshot.headers.map(normalizeSizeHeader).filter(Boolean)
      const headers = toHeaders(snapshot.headers)
      return { stock, headers, rows: toSnapshotRows(stock, sourceHeaders, headers, snapshot.rows) }
    }
    if (!stock.orderId) return { stock, headers: [], rows: [] }
    const res = await getOrderColorSizeBreakdown(stock.orderId)
    const data = (res.data ?? { headers: [], rows: [] }) as OrderColorSizeBreakdownRes
    const headers = toHeaders(Array.isArray(data.headers) ? data.headers : [])
    const sourceRows = Array.isArray(data.rows) ? data.rows : []
    return {
      stock,
      headers,
      rows: sourceRows.map((item) => ({
        colorName: normalizeColorName(item.colorName) || '-',
        imageUrl: getColorImage(stock, normalizeColorName(item.colorName)),
        quantities: headers.map(() => 0),
      })),
    }
  }

  async function initOutboundSizeList(stockItems: FinishedOutboundStockInfo[]) {
    resetOutboundForm()
    if (!stockItems.length) return
    outboundLoading.value = true
    try {
      outboundItems.value = await Promise.all(stockItems.map((item) => buildDialogItem(item)))
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
      outboundItems.value = []
    } finally {
      outboundLoading.value = false
    }
  }

  function getOutboundItemTotal(item: FinishedOutboundDialogItem): number {
    return item.rows.reduce((sum, row) => sum + getRowTotal(row), 0)
  }

  function buildPayloadItems(): OutboundPayloadItem[] {
    const map = new Map<number, OutboundPayloadItem>()
    outboundItems.value.forEach((item) => {
      const rows = item.rows
        .map((row) => ({
          colorName: normalizeColorName(row.colorName) || '-',
          quantities: row.quantities.map((qty) => Math.max(0, Math.trunc(Number(qty) || 0))),
        }))
        .filter((row) => row.quantities.some((qty) => qty > 0))
      if (!rows.length) return
      const existing = map.get(item.stock.id)
      if (!existing) {
        map.set(item.stock.id, {
          id: item.stock.id,
          quantity: rows.reduce((sum, row) => sum + getRowTotal(row), 0),
          sizeBreakdown: { headers: [...item.headers], rows },
        })
        return
      }
      const nextHeaders = mergeHeaders(existing.sizeBreakdown.headers, item.headers)
      existing.sizeBreakdown.rows = existing.sizeBreakdown.rows.map((row) => ({
        colorName: row.colorName,
        quantities: remapQuantities(existing.sizeBreakdown.headers, row.quantities, nextHeaders),
      }))
      rows.forEach((row) => {
        existing.sizeBreakdown.rows.push({
          colorName: row.colorName,
          quantities: remapQuantities(item.headers, row.quantities, nextHeaders),
        })
      })
      existing.sizeBreakdown.headers = nextHeaders
      existing.quantity = existing.sizeBreakdown.rows.reduce((sum, row) => sum + getRowTotal(row), 0)
    })
    return Array.from(map.values()).filter((item) => item.quantity > 0)
  }

  async function submitOutbound() {
    const valid = await outboundFormRef.value?.validate().then(() => true).catch(() => false)
    if (!valid) return
    if (!outboundItems.value.length) {
      ElMessage.warning('未选择可出库记录')
      return
    }
    const invalidItem = outboundItems.value.find((item) => {
      const total = getOutboundItemTotal(item)
      return !item.headers.length || !item.rows.length || total <= 0 || total > Math.max(0, Number(item.stock.quantity) || 0)
    })
    if (invalidItem) {
      const total = getOutboundItemTotal(invalidItem)
      if (!invalidItem.headers.length || !invalidItem.rows.length) ElMessage.warning('选中的库存暂无颜色尺码明细，无法出库')
      else if (total <= 0) ElMessage.warning('请填写出库数量')
      else ElMessage.warning(`库存 ${invalidItem.stock.skuCode || invalidItem.stock.id} 的出库数量不能大于当前库存`)
      return
    }
    const items = buildPayloadItems()
    if (!items.length) {
      ElMessage.warning('请填写出库数量')
      return
    }
    submitting.value = true
    try {
      await finishedOutbound({ items, pickupUserId: outboundForm.pickupUserId })
      ElMessage.success('出库成功')
      closeDialog()
      emitSubmitted()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      submitting.value = false
    }
  }

  return {
    outboundLoading, submitting, outboundFormRef, outboundForm, outboundRules,
    pickupUserOptions, outboundItems, outboundGrandTotal, loadPickupUsers,
    resetOutboundForm, initOutboundSizeList, getOutboundItemTotal, getRowTotal, submitOutbound,
  }
}

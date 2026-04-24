import { computed, reactive, ref, type Ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  doPendingInbound,
  doPendingOutbound,
  getPendingPickupUserOptions,
  type FinishedPickupUserOption,
  type PendingListItem,
} from '@/api/inventory'
import { getSystemOptionsList, type SystemOptionItem } from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import {
  distributePendingToColorSizeGrid,
  getInboundPreviewRowTotal,
  getOutboundItemTotal,
  getOutboundRowTotal,
  getOutboundTableSummaries,
  toInboundPreviewTableRows,
} from '@/composables/inventoryPendingDialogHelpers'

type PendingPageTab = 'pending' | 'shipped'

export type PendingColorSizeCache = Record<
  number,
  {
    loading: boolean
    error: boolean
    headers: string[]
    rows: Array<{ colorName: string; values: number[] }>
  }
>

export type PendingOutboundDialogItem = {
  row: PendingListItem
  headers: string[]
  rows: Array<{ colorName: string; quantities: number[] }>
}

export type InboundPreviewItem = {
  id: number
  orderId: number
  orderNo: string
  skuCode: string
  quantity: number
  headers: string[]
  rows: Array<{ colorName: string; values: number[] }>
}

type UseInventoryPendingDialogsParams = {
  selectedRows: Ref<PendingListItem[]>
  pageTab: Ref<PendingPageTab>
  load: () => Promise<void>
  ensureColorSizeBreakdown: (orderId: number) => Promise<void>
  colorSizeCache: PendingColorSizeCache
}

export function useInventoryPendingDialogs({
  selectedRows,
  pageTab,
  load,
  ensureColorSizeBreakdown,
  colorSizeCache,
}: UseInventoryPendingDialogsParams) {
  const inboundDialog = reactive<{ visible: boolean; submitting: boolean }>({
    visible: false,
    submitting: false,
  })
  const inboundFormRef = ref<FormInstance>()
  const inboundForm = reactive({
    warehouseId: null as number | null,
    inventoryTypeId: null as number | null,
    department: '',
    location: '',
  })
  const inboundRules: FormRules = {
    warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
    department: [{ required: true, message: '请选择部门', trigger: 'change' }],
    location: [{ required: true, message: '请输入存放地址', trigger: 'blur' }],
  }

  const warehouseOptions = ref<{ id: number; label: string }[]>([])
  const inventoryTypeOptions = ref<{ id: number; label: string }[]>([])
  const departmentOptions = ref<{ value: string; label: string }[]>([])

  const outboundDialog = reactive<{
    visible: boolean
    submitting: boolean
    items: PendingOutboundDialogItem[]
  }>({ visible: false, submitting: false, items: [] })
  const outboundFormRef = ref<FormInstance>()
  const outboundForm = reactive({
    pickupUserId: null as number | null,
  })
  const outboundRules: FormRules = {
    pickupUserId: [{ required: true, message: '请选择领取人', trigger: 'change' }],
  }
  const pickupUserOptions = ref<FinishedPickupUserOption[]>([])

  const outboundSelectedCustomer = computed(() => {
    const first = outboundDialog.items[0]?.row?.customerName?.trim()
    return first || '-'
  })
  const outboundGrandTotal = computed(() =>
    outboundDialog.items.reduce((sum, item) => sum + getOutboundItemTotal(item), 0),
  )
  const inboundPreviewItems = computed<InboundPreviewItem[]>(() =>
    selectedRows.value.map((row) => {
      const breakdown = row.orderId ? colorSizeCache[row.orderId] : undefined
      const headers = (breakdown?.headers ?? []).filter((h) => h !== '合计')
      return {
        id: row.id,
        orderId: row.orderId,
        orderNo: row.orderNo,
        skuCode: row.skuCode,
        quantity: row.quantity,
        headers,
        rows: breakdown?.rows ?? [],
      }
    }),
  )

  async function openInboundDialog() {
    if (!selectedRows.value.length) return
    await Promise.all(
      selectedRows.value
        .map((row) => row.orderId)
        .filter((orderId): orderId is number => Number.isInteger(orderId) && orderId > 0)
        .map((orderId) => ensureColorSizeBreakdown(orderId)),
    )
    inboundDialog.visible = true
  }

  function resetInboundForm() {
    inboundForm.warehouseId = null
    inboundForm.inventoryTypeId = null
    inboundForm.department = ''
    inboundForm.location = ''
    inboundFormRef.value?.clearValidate()
  }

  async function submitInbound() {
    await inboundFormRef.value?.validate().catch(() => {})
    const ids = selectedRows.value.map((r) => r.id)
    if (!ids.length) return
    inboundDialog.submitting = true
    try {
      await doPendingInbound({
        ids,
        warehouseId: inboundForm.warehouseId,
        inventoryTypeId: inboundForm.inventoryTypeId ?? undefined,
        department: inboundForm.department,
        location: inboundForm.location,
      })
      ElMessage.success('入库成功')
      inboundDialog.visible = false
      selectedRows.value = []
      await load()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      inboundDialog.submitting = false
    }
  }

  async function loadWarehouseOptions() {
    try {
      const res = await getSystemOptionsList('warehouses')
      const list = (res.data ?? []) as SystemOptionItem[]
      warehouseOptions.value = list.map((o) => ({ id: o.id, label: o.value }))
    } catch {
      warehouseOptions.value = []
    }
  }

  async function loadDepartmentOptions() {
    try {
      const res = await getSystemOptionsList('org_departments')
      const list = (res.data ?? []) as SystemOptionItem[]
      departmentOptions.value = list.map((o) => ({ value: o.value, label: o.value }))
    } catch {
      departmentOptions.value = []
    }
  }

  async function loadInventoryTypeOptions() {
    try {
      const res = await getSystemOptionsList('inventory_types')
      const list = (res.data ?? []) as SystemOptionItem[]
      inventoryTypeOptions.value = list.map((o) => ({ id: o.id, label: o.value }))
    } catch {
      inventoryTypeOptions.value = []
    }
  }

  async function loadPickupUserOptions() {
    try {
      const res = await getPendingPickupUserOptions()
      pickupUserOptions.value = res.data ?? []
    } catch {
      pickupUserOptions.value = []
    }
  }

  async function loadDialogOptions() {
    await Promise.all([
      loadWarehouseOptions(),
      loadInventoryTypeOptions(),
      loadDepartmentOptions(),
      loadPickupUserOptions(),
    ])
  }

  async function openOutboundDialog() {
    if (pageTab.value !== 'pending') return
    if (!selectedRows.value.length) return
    const rows = selectedRows.value
    if (rows.some((row) => row.sourceType === 'defect')) {
      ElMessage.warning('次品记录不支持直接发货')
      return
    }
    const customerNames = Array.from(new Set(rows.map((row) => row.customerName?.trim() || '__EMPTY__')))
    if (customerNames.length > 1) {
      ElMessage.warning('批量发货请只选择同一客户的记录')
      return
    }
    outboundForm.pickupUserId = null
    await Promise.all(
      rows
        .map((row) => row.orderId)
        .filter((orderId): orderId is number => Number.isInteger(orderId) && orderId > 0)
        .map((orderId) => ensureColorSizeBreakdown(orderId)),
    )
    outboundDialog.items = rows.map((row) => {
      const breakdown = row.orderId ? colorSizeCache[row.orderId] : undefined
      const headers = (breakdown?.headers ?? []).filter((h) => h !== '合计')
      const br = breakdown?.rows ?? []
      const dialogRows = br.map((r) => ({
        colorName: r.colorName,
        quantities: headers.map(() => 0),
      }))
      distributePendingToColorSizeGrid(dialogRows, br, headers.length, Number(row.quantity) || 0)
      return {
        row,
        headers,
        rows: dialogRows,
      }
    })
    outboundDialog.visible = true
  }

  function resetOutboundForm() {
    outboundDialog.items = []
    outboundForm.pickupUserId = null
    outboundFormRef.value?.clearValidate()
  }

  async function submitOutbound() {
    if (!outboundDialog.items.length) return
    const valid = await outboundFormRef.value?.validate().catch(() => false)
    if (!valid) return
    const invalidItem = outboundDialog.items.find((item) => {
      const qty = getOutboundItemTotal(item)
      return item.headers.length === 0 || qty <= 0 || qty > item.row.quantity
    })
    if (invalidItem) {
      const qty = getOutboundItemTotal(invalidItem)
      if (invalidItem.headers.length === 0) {
        ElMessage.warning(`订单 ${invalidItem.row.orderNo} / ${invalidItem.row.skuCode} 暂无颜色尺码明细，无法发货`)
      } else if (qty <= 0) {
        ElMessage.warning(`订单 ${invalidItem.row.orderNo} / ${invalidItem.row.skuCode} 请填写发货数量`)
      } else {
        ElMessage.warning(`订单 ${invalidItem.row.orderNo} / ${invalidItem.row.skuCode} 的发货数量不能大于当前待处理数量`)
      }
      return
    }
    outboundDialog.submitting = true
    try {
      await doPendingOutbound({
        items: outboundDialog.items.map((item) => ({
          id: item.row.id,
          quantity: getOutboundItemTotal(item),
          sizeBreakdown: {
            headers: item.headers,
            rows: item.rows.map((row) => ({
              colorName: row.colorName,
              quantities: row.quantities.map((q) => Number(q) || 0),
            })),
          },
        })),
        pickupUserId: outboundForm.pickupUserId,
      })
      ElMessage.success('发货成功')
      outboundDialog.visible = false
      selectedRows.value = []
      await load()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      outboundDialog.submitting = false
    }
  }

  return {
    inboundDialog,
    inboundFormRef,
    inboundForm,
    inboundRules,
    inboundPreviewItems,
    warehouseOptions,
    inventoryTypeOptions,
    departmentOptions,
    outboundDialog,
    outboundFormRef,
    outboundForm,
    outboundRules,
    pickupUserOptions,
    outboundSelectedCustomer,
    outboundGrandTotal,
    openInboundDialog,
    resetInboundForm,
    submitInbound,
    openOutboundDialog,
    resetOutboundForm,
    submitOutbound,
    getOutboundItemTotal,
    getOutboundRowTotal,
    getOutboundTableSummaries,
    toInboundPreviewTableRows,
    getInboundPreviewRowTotal,
    loadDialogOptions,
  }
}

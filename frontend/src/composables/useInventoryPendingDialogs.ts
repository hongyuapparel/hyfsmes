import { computed, reactive, ref, type Ref } from 'vue'
import { ElMessage, type FormRules } from 'element-plus'
import {
  doPendingInbound,
  doPendingOutbound,
  type PendingListItem,
} from '@/api/inventory'
import { useInventoryPendingOptions } from '@/composables/useInventoryPendingOptions'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import {
  buildInboundPreviewItem,
  buildOutboundDialogItem,
  getInboundPreviewRowTotal,
  getOutboundItemTotal,
  getOutboundRowTotal,
  getOutboundTableSummaries,
  getOutboundValidationMessage,
  toInboundPreviewTableRows,
} from '@/composables/inventoryPendingDialogHelpers'

type PendingPageTab = 'pending' | 'shipped'

export type PendingOutboundDialogItem = {
  row: PendingListItem
  headers: string[]
  rows: Array<{ colorName: string; quantities: number[]; availableQuantities: number[] }>
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
}

export function useInventoryPendingDialogs({
  selectedRows,
  pageTab,
  load,
}: UseInventoryPendingDialogsParams) {
  const inboundDialog = reactive<{ visible: boolean; submitting: boolean }>({
    visible: false,
    submitting: false,
  })
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

  const { warehouseOptions, inventoryTypeOptions, departmentOptions, pickupUserOptions, loadDialogOptions } = useInventoryPendingOptions()

  const outboundDialog = reactive<{
    visible: boolean
    submitting: boolean
    items: PendingOutboundDialogItem[]
  }>({ visible: false, submitting: false, items: [] })
  const outboundForm = reactive({
    pickupUserId: null as number | null,
  })
  const outboundRules: FormRules = {
    pickupUserId: [{ required: true, message: '请选择领取人', trigger: 'change' }],
  }

  const outboundSelectedCustomer = computed(() => {
    const first = outboundDialog.items[0]?.row?.customerName?.trim()
    return first || '-'
  })
  const outboundGrandTotal = computed(() =>
    outboundDialog.items.reduce((sum, item) => sum + getOutboundItemTotal(item), 0),
  )
  const inboundPreviewItems = ref<InboundPreviewItem[]>([])

  async function openInboundDialog() {
    if (!selectedRows.value.length) return
    const missing = selectedRows.value.find((row) => row.detailStatus === 'missing')
    if (missing) {
      ElMessage.warning(`订单 ${missing.orderNo} / ${missing.skuCode} 未留存本批颜色尺码明细，请先在尾部纠错中按实际数据补录`)
      return
    }
    inboundPreviewItems.value = selectedRows.value.map(buildInboundPreviewItem)
    inboundDialog.visible = true
  }

  function resetInboundForm() {
    inboundForm.warehouseId = null
    inboundForm.inventoryTypeId = null
    inboundForm.department = ''
    inboundForm.location = ''
  }

  async function submitInbound() {
    if (inboundDialog.submitting) return
    const ids = inboundPreviewItems.value.map((r) => r.id)
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
    outboundDialog.submitting = true
    try {
      const warnings: string[] = []
      outboundDialog.items = rows.map((row) => {
        const { item, warning } = buildOutboundDialogItem(row)
        if (warning) warnings.push(warning)
        return item
      })
      if (warnings.length) {
        ElMessage.warning(warnings[0] + (warnings.length > 1 ? `（另有 ${warnings.length - 1} 条）` : ''))
      }
      if (outboundDialog.items.some((item) => item.headers.length === 0 || item.rows.length === 0)) {
        outboundDialog.items = []
        return
      }
      outboundDialog.visible = true
    } catch (e: unknown) {
      outboundDialog.items = []
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      outboundDialog.submitting = false
    }
  }

  function resetOutboundForm() {
    outboundDialog.items = []
    outboundForm.pickupUserId = null
  }

  async function submitOutbound() {
    if (outboundDialog.submitting) return
    if (!outboundDialog.items.length) return
    if (outboundForm.pickupUserId == null) {
      ElMessage.warning('请选择领取人')
      return
    }
    const warning = outboundDialog.items.map(getOutboundValidationMessage).find(Boolean)
    if (warning) {
      ElMessage.warning(warning)
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
    inboundForm,
    inboundRules,
    inboundPreviewItems,
    warehouseOptions,
    inventoryTypeOptions,
    departmentOptions,
    outboundDialog,
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

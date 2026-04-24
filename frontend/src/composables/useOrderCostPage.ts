import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { formatDisplayNumber } from '@/utils/display-number'
import { buildSnapshotPayload } from '@/utils/order-cost'
import { createProcessQuoteTemplate, setProcessQuoteTemplateItems } from '@/api/process-quote-templates'
import { confirmOrderCost, saveOrderCost } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useOrderCostData } from './useOrderCostData'

const LOAD_RETRY_DELAY_MS = 300
const PERF_TAG = '[orders-cost-perf]'
const waitMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface OrderCostAuthLike {
  hasPermission: (code: string) => boolean
  user?: {
    displayName?: string
    username?: string
  } | null
}

export function useOrderCostPage(authStore: OrderCostAuthLike) {
  const route = useRoute()
  const router = useRouter()
  const orderId = computed(() => {
    const num = Number(route.params.id)
    return Number.isNaN(num) ? 0 : num
  })
  const {
    order,
    materialRows,
    processItemRows,
    productionRows,
    productionProcesses,
    materialTypeOptions,
    supplierOptions,
    supplierLoading,
    processOptions,
    productionPickerVisible,
    selectedProductionRows,
    productionCostMultiplier,
    profitMargin,
    importTemplateDialog,
    importTemplateOptions,
    quoteConfirmedAt,
    quoteConfirmedBy,
    quoteNeedsReconfirm,
    productionAddedIdsSignature,
    departmentOptions,
    materialTotal,
    processItemTotal,
    productionProcessBaseTotal,
    productionProcessTotal,
    totalCost,
    computedExFactoryPrice,
    materialRowsSorted,
    productionRowsSorted,
    materialSpanMethod,
    productionSpanMethod,
    getJobTypeGroupAmountByRowIndex,
    getDepartmentGroupAmountByRowIndex,
    getJobTypeOptions,
    getProductionProcessSelectOptions,
    getJobTypeLabel,
    loadOrder,
    loadCostSnapshot,
    loadProcesses,
    loadMaterialTypes,
    syncMaterialTypeIdsFromLabel,
    syncProductionIdsFromName,
    searchSuppliers,
    onSupplierSelectVisibleChange,
    onProcessOptionsVisibleChange,
    addMaterialRow,
    removeMaterialRow,
    addProcessItemRow,
    removeProcessItemRow,
    openProductionPickerDialog,
    onProductionPickerAppend,
    removeProductionRow,
    onProductionSelectionChange,
    batchRemoveProductionRows,
    onProductionProcessChange,
    onProductionDepartmentChange,
    onProductionJobTypeChange,
    openImportTemplateDialog,
    applyImportTemplate,
    loadImportTemplateOptions,
  } = useOrderCostData(orderId.value)

  const savingDraft = ref(false)
  const confirmingQuote = ref(false)
  const saveTemplateDialog = ref<{ visible: boolean; name: string; submitting: boolean }>({
    visible: false,
    name: '',
    submitting: false,
  })
  const hasLocalDraftChanges = ref(false)
  const suppressDirtyTracking = ref(true)
  const mountStartAt = performance.now()
  const canSubmitCost = computed(() => authStore.hasPermission('orders_cost_submit'))

  function formatMoney(num: number): string {
    return Number.isFinite(num) ? formatDisplayNumber(num) : formatDisplayNumber(0)
  }
  function formatTimeLabel(iso: string): string {
    if (!iso) return ''
    const time = new Date(iso)
    return Number.isNaN(time.getTime()) ? '' : time.toLocaleString()
  }
  function logPerf(message: string, extra?: Record<string, unknown>) {
    if (extra) console.info(PERF_TAG, message, extra)
    else console.info(PERF_TAG, message)
  }

  const costNotice = computed(() => {
    if (!canSubmitCost.value) return '你没有“订单成本可提交”权限：可在页面试算，但不能保存草稿或确认报价。'
    if (quoteConfirmedAt.value && hasLocalDraftChanges.value) return '当前成本已被修改但尚未确认报价，订单卡片仍显示上次已确认出厂价。'
    if (quoteNeedsReconfirm.value) return '当前为草稿版本，尚未确认报价，不会同步到订单卡片。'
    if (quoteConfirmedAt.value) {
      const by = quoteConfirmedBy.value || '未知用户'
      const at = formatTimeLabel(quoteConfirmedAt.value)
      return `最近一次确认报价：${by}${at ? `（${at}）` : ''}`
    }
    return '当前尚未确认报价，订单卡片将继续显示上次已确认价格。'
  })

  function buildCurrentSnapshot() {
    return buildSnapshotPayload({
      materialRows: materialRows.value,
      processItemRows: processItemRows.value,
      productionRows: productionRows.value,
      productionCostMultiplier: productionCostMultiplier.value,
      profitMargin: profitMargin.value,
    })
  }

  function onAnyFieldInput() { if (!suppressDirtyTracking.value) hasLocalDraftChanges.value = true }
  function onAnyFieldChange() { if (!suppressDirtyTracking.value) hasLocalDraftChanges.value = true }

  async function saveDraft() {
    if (!orderId.value || !order.value) return
    if (!canSubmitCost.value) return ElMessage.warning('你没有“订单成本可提交”权限，当前仅可试算')
    savingDraft.value = true
    try {
      await saveOrderCost(orderId.value, { snapshot: buildCurrentSnapshot() })
      quoteNeedsReconfirm.value = true
      hasLocalDraftChanges.value = false
      ElMessage.success('草稿已保存（未同步订单卡片出厂价）')
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '保存失败'))
    } finally {
      savingDraft.value = false
    }
  }

  async function confirmQuote() {
    if (!orderId.value || !order.value) return
    if (!canSubmitCost.value) return ElMessage.warning('你没有“订单成本可提交”权限，当前仅可试算')
    const price = computedExFactoryPrice.value
    if (price <= 0) return ElMessage.warning('请先填写成本并计算得出有效出厂价')
    confirmingQuote.value = true
    try {
      await confirmOrderCost(orderId.value, { snapshot: buildCurrentSnapshot() })
      order.value.exFactoryPrice = price.toFixed(2)
      quoteNeedsReconfirm.value = false
      quoteConfirmedBy.value = authStore.user?.displayName || authStore.user?.username || ''
      quoteConfirmedAt.value = new Date().toISOString()
      hasLocalDraftChanges.value = false
      ElMessage.success('已确认报价并同步订单卡片出厂价')
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '确认报价失败'))
    } finally {
      confirmingQuote.value = false
    }
  }

  function openSaveTemplateDialog() {
    const hasValid = productionRows.value.some((row) => Number(row.processId) > 0)
    if (!hasValid) return ElMessage.warning('请先至少选择一条有效工序，再保存为模板')
    const orderNo = (order.value?.orderNo ?? '').trim()
    const skuCode = (order.value?.skuCode ?? '').trim()
    const fallback = [orderNo, skuCode].filter(Boolean).join('-')
    saveTemplateDialog.value = { visible: true, name: fallback ? `${fallback}-报价模板` : '', submitting: false }
  }

  async function saveCurrentProcessesAsTemplate() {
    const name = saveTemplateDialog.value.name.trim()
    if (!name) return ElMessage.warning('请填写模板名称')
    const processIds = Array.from(new Set(productionRowsSorted.value.map((row) => Number(row.processId)).filter((id) => Number.isInteger(id) && id > 0)))
    if (!processIds.length) return ElMessage.warning('当前没有可保存的工序')
    saveTemplateDialog.value.submitting = true
    try {
      const created = await createProcessQuoteTemplate({ name })
      const templateId = created.data?.id
      if (!templateId) throw new Error('模板创建失败')
      await setProcessQuoteTemplateItems(templateId, processIds)
      saveTemplateDialog.value.visible = false
      saveTemplateDialog.value.name = ''
      await loadImportTemplateOptions()
      ElMessage.success(`已保存模板：${name}`)
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '保存模板失败'))
    } finally {
      saveTemplateDialog.value.submitting = false
    }
  }

  function goBack() { void router.push('/orders/list') }

  onMounted(async () => {
    const w = window as Window & { __ordersCostMountCount?: number }
    w.__ordersCostMountCount = (w.__ordersCostMountCount ?? 0) + 1
    logPerf('页面 mount 次数', { mountCount: w.__ordersCostMountCount })
    suppressDirtyTracking.value = true
    await Promise.all([loadOrder(), loadCostSnapshot()])
    if (!order.value) { await waitMs(LOAD_RETRY_DELAY_MS); await loadOrder() }
    if (!materialRows.value.length && !processItemRows.value.length) { await waitMs(LOAD_RETRY_DELAY_MS); await loadCostSnapshot() }
    await loadProcesses()
    syncProductionIdsFromName()
    await loadMaterialTypes()
    syncMaterialTypeIdsFromLabel()
    suppressDirtyTracking.value = false
    await nextTick()
    logPerf('首屏渲染时间(ms)', { elapsedMs: Math.round(performance.now() - mountStartAt) })
  })

  watch([materialTotal, processItemTotal, productionProcessTotal, totalCost, computedExFactoryPrice], () => {
    if (!suppressDirtyTracking.value && !productionPickerVisible.value) hasLocalDraftChanges.value = true
  })

  return {
    order,
    materialRowsSorted,
    processItemRows,
    productionRowsSorted,
    productionProcesses,
    materialTypeOptions,
    supplierOptions,
    supplierLoading,
    processOptions,
    productionPickerVisible,
    productionAddedIdsSignature,
    selectedProductionRows,
    productionCostMultiplier,
    profitMargin,
    savingDraft,
    confirmingQuote,
    importTemplateDialog,
    importTemplateOptions,
    saveTemplateDialog,
    canSubmitCost,
    costNotice,
    departmentOptions,
    materialTotal,
    processItemTotal,
    productionProcessBaseTotal,
    productionProcessTotal,
    totalCost,
    computedExFactoryPrice,
    materialSpanMethod,
    productionSpanMethod,
    getJobTypeGroupAmountByRowIndex,
    getDepartmentGroupAmountByRowIndex,
    getJobTypeOptions,
    getProductionProcessSelectOptions,
    getJobTypeLabel,
    formatMoney,
    onSupplierSelectVisibleChange,
    searchSuppliers,
    onProcessOptionsVisibleChange,
    addMaterialRow,
    removeMaterialRow,
    addProcessItemRow,
    removeProcessItemRow,
    openProductionPickerDialog,
    onProductionPickerAppend,
    removeProductionRow,
    onProductionSelectionChange,
    batchRemoveProductionRows,
    onProductionProcessChange,
    onProductionDepartmentChange,
    onProductionJobTypeChange,
    onAnyFieldInput,
    onAnyFieldChange,
    saveDraft,
    confirmQuote,
    goBack,
    openImportTemplateDialog,
    openSaveTemplateDialog,
    saveCurrentProcessesAsTemplate,
    applyImportTemplate,
  }
}

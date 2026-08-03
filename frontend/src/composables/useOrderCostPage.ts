import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { formatDisplayNumber } from '@/utils/display-number'
import { buildSnapshotPayload } from '@/utils/order-cost'
import { useOrderCostData } from './useOrderCostData'
import { useOrderCostInitialization } from './useOrderCostInitialization'
import { useOrderCostQuoteActions } from './useOrderCostQuoteActions'
import { useOrderCostTemplateActions } from './useOrderCostTemplateActions'
import { useOrderQuoteQueueNavigation } from './useOrderQuoteQueueNavigation'

interface OrderCostAuthLike {
  hasPermission: (code: string) => boolean
  user?: {
    displayName?: string
    username?: string
  } | null
}

export function useOrderCostPage(authStore: OrderCostAuthLike) {
  const route = useRoute()
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
    importOrderDialog,
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
    reconcileCostRowsFromOrder,
    ensureCostRowsBase,
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
    openImportOrderDialog,
    closeImportOrderDialog,
    searchImportOrders,
    applyImportOrder: applyImportOrderFromData,
    getImportOrderStatusLabel,
    getImportOrderStatusTagType,
    resetOrderCostState,
  } = useOrderCostData(orderId)

  const hasLocalDraftChanges = ref(false)
  const suppressDirtyTracking = ref(true)
  const canSubmitCost = computed(() => authStore.hasPermission('orders_cost_submit'))
  const { isQuoteQueue, goAfterQuoteConfirm, goBackFromCost } = useOrderQuoteQueueNavigation(orderId)

  function formatMoney(num: number): string {
    return Number.isFinite(num) ? formatDisplayNumber(num) : formatDisplayNumber(0)
  }

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

  const { savingDraft, confirmingQuote, costNotice, saveDraft, confirmQuote } = useOrderCostQuoteActions({
    authStore,
    orderId,
    order,
    canSubmitCost,
    computedExFactoryPrice,
    quoteConfirmedAt,
    quoteConfirmedBy,
    quoteNeedsReconfirm,
    hasLocalDraftChanges,
    isQuoteQueue,
    buildCurrentSnapshot,
    goAfterQuoteConfirm,
  })

  const { saveTemplateDialog, openSaveTemplateDialog, saveCurrentProcessesAsTemplate } = useOrderCostTemplateActions({
    order,
    productionRows,
    productionRowsSorted,
    loadImportTemplateOptions,
  })

  async function applyImportOrder() {
    const imported = await applyImportOrderFromData()
    if (imported && !suppressDirtyTracking.value) hasLocalDraftChanges.value = true
  }

  function goBack() { goBackFromCost() }

  useOrderCostInitialization({
    orderId,
    order,
    materialRows,
    processItemRows,
    selectedProductionRows,
    hasLocalDraftChanges,
    suppressDirtyTracking,
    resetOrderCostState,
    loadOrder,
    loadCostSnapshot,
    reconcileCostRowsFromOrder,
    ensureCostRowsBase,
    loadProcesses,
    syncProductionIdsFromName,
    loadMaterialTypes,
    syncMaterialTypeIdsFromLabel,
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
    importOrderDialog,
    saveTemplateDialog,
    canSubmitCost,
    isQuoteQueue,
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
    openImportOrderDialog,
    closeImportOrderDialog,
    searchImportOrders,
    openSaveTemplateDialog,
    saveCurrentProcessesAsTemplate,
    applyImportTemplate,
    applyImportOrder,
    getImportOrderStatusLabel,
    getImportOrderStatusTagType,
  }
}

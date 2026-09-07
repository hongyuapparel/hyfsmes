import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { formatDisplayNumber } from '@/utils/display-number'
import { buildSnapshotPayload } from '@/utils/order-cost'
import { useOrderCostData } from './useOrderCostData'
import { useOrderCostInitialization } from './useOrderCostInitialization'
import { useOrderCostQuoteActions } from './useOrderCostQuoteActions'
import { useOrderCostTemplateActions } from './useOrderCostTemplateActions'
import { useOrderQuoteQueueNavigation } from './useOrderQuoteQueueNavigation'
import { useOrderCostRouteIdentity } from './useOrderCostRouteIdentity'
import { useOrderCostSession } from './useOrderCostSession'
import { useOrderCostReview } from './useOrderCostReview'

interface OrderCostAuthLike {
  hasPermission: (code: string) => boolean
  user?: {
    displayName?: string
    username?: string
  } | null
}

export function useOrderCostPage(authStore: OrderCostAuthLike) {
  const route = useRoute()
  const orderId = useOrderCostRouteIdentity(route)
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

  const { hasLocalDraftChanges, markSaved } = useOrderCostSession(buildCurrentSnapshot, (snapshot) => {
    materialRows.value = snapshot.materialRows
    processItemRows.value = snapshot.processItemRows
    productionRows.value = snapshot.productionRows
    productionCostMultiplier.value = snapshot.productionCostMultiplier
    profitMargin.value = snapshot.profitMargin
  }, suppressDirtyTracking, () => blockingSubmission.value)
  const review = useOrderCostReview(order, materialRows, processItemRows, productionRows, productionCostMultiplier)

  const { savingDraft, confirmingQuote, blockingSubmission, costNotice, saveDraft, confirmQuote } = useOrderCostQuoteActions({
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
    markSaved,
    costIssues: review.costIssues,
    structureDifferences: review.structureDifferences,
    goAfterQuoteConfirm,
  })

  const { saveTemplateDialog, openSaveTemplateDialog, saveCurrentProcessesAsTemplate } = useOrderCostTemplateActions({
    order,
    productionRows,
    productionRowsSorted,
    loadImportTemplateOptions,
  })

  async function applyImportOrder() {
    await applyImportOrderFromData()
  }

  function goBack() { goBackFromCost() }

  const initialization = useOrderCostInitialization({
    orderId,
    order,
    materialRows,
    processItemRows,
    selectedProductionRows,
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

  return {
    ...initialization,
    ...review,
    hasLocalDraftChanges,
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

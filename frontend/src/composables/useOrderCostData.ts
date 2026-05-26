/**
 * useOrderCostData — 入口聚合
 *
 * 拆分后的子 composable：
 *   useOrderCostLoader       — 数据加载（订单、快照、物料类型、生产工序）
 *   useOrderCostMaterialRows — 材料行 / 工艺项目行 / 供应商 / 工艺选项
 *   useOrderCostProductionRows — 生产工序行 CRUD 与字段联动
 *   useOrderCostImport       — 导入订单工序成本 / 导入模板
 *   useOrderCostCalculations — 成本汇总计算（已有）
 */
import { getJobTypeLabel } from '@/utils/order-cost'
import { useOrderCostCalculations } from './useOrderCostCalculations'
import { useOrderCostLoader } from './useOrderCostLoader'
import { useOrderCostMaterialRows } from './useOrderCostMaterialRows'
import { useOrderCostProductionRows } from './useOrderCostProductionRows'
import { useOrderCostImport } from './useOrderCostImport'

export function useOrderCostData(orderId: number) {
  const loader = useOrderCostLoader(orderId)

  const {
    materialRows,
    processItemRows,
    productionRows,
    productionProcesses,
    materialTypeOptions,
    productionCostMultiplier,
    profitMargin,
  } = loader

  const materialRowsOps = useOrderCostMaterialRows(materialRows, processItemRows)

  const productionRowsOps = useOrderCostProductionRows(productionRows, productionProcesses, loader.loadProcesses)

  const importOps = useOrderCostImport(productionRows, productionRowsOps.selectedProductionRows, productionCostMultiplier)

  const calculations = useOrderCostCalculations({
    materialRows,
    processItemRows,
    productionRows,
    materialTypeOptions,
    productionCostMultiplier,
    profitMargin,
  })

  return {
    // loader state
    order: loader.order,
    materialRows,
    processItemRows,
    productionRows,
    productionProcesses,
    materialTypeOptions,
    productionCostMultiplier,
    profitMargin,
    quoteConfirmedAt: loader.quoteConfirmedAt,
    quoteConfirmedBy: loader.quoteConfirmedBy,
    quoteNeedsReconfirm: loader.quoteNeedsReconfirm,

    // loader actions
    loadOrder: loader.loadOrder,
    loadCostSnapshot: loader.loadCostSnapshot,
    reconcileCostRowsFromOrder: loader.reconcileCostRowsFromOrder,
    ensureCostRowsBase: loader.ensureCostRowsBase,
    loadProcesses: loader.loadProcesses,
    loadMaterialTypes: loader.loadMaterialTypes,
    syncMaterialTypeIdsFromLabel: loader.syncMaterialTypeIdsFromLabel,
    syncProductionIdsFromName: loader.syncProductionIdsFromName,

    // material rows state & actions
    supplierOptions: materialRowsOps.supplierOptions,
    supplierLoading: materialRowsOps.supplierLoading,
    processOptions: materialRowsOps.processOptions,
    searchSuppliers: materialRowsOps.searchSuppliers,
    onSupplierSelectVisibleChange: materialRowsOps.onSupplierSelectVisibleChange,
    onProcessOptionsVisibleChange: materialRowsOps.onProcessOptionsVisibleChange,
    addMaterialRow: materialRowsOps.addMaterialRow,
    removeMaterialRow: materialRowsOps.removeMaterialRow,
    addProcessItemRow: materialRowsOps.addProcessItemRow,
    removeProcessItemRow: materialRowsOps.removeProcessItemRow,

    // production rows state & actions
    productionPickerVisible: productionRowsOps.productionPickerVisible,
    selectedProductionRows: productionRowsOps.selectedProductionRows,
    productionAddedIdsSignature: productionRowsOps.productionAddedIdsSignature,
    departmentOptions: productionRowsOps.departmentOptions,
    getJobTypeOptions: productionRowsOps.getJobTypeOptions,
    getProductionProcessSelectOptions: productionRowsOps.getProductionProcessSelectOptions,
    openProductionPickerDialog: productionRowsOps.openProductionPickerDialog,
    onProductionPickerAppend: productionRowsOps.onProductionPickerAppend,
    removeProductionRow: productionRowsOps.removeProductionRow,
    onProductionSelectionChange: productionRowsOps.onProductionSelectionChange,
    batchRemoveProductionRows: productionRowsOps.batchRemoveProductionRows,
    onProductionProcessChange: productionRowsOps.onProductionProcessChange,
    onProductionDepartmentChange: productionRowsOps.onProductionDepartmentChange,
    onProductionJobTypeChange: productionRowsOps.onProductionJobTypeChange,

    // import state & actions
    importTemplateDialog: importOps.importTemplateDialog,
    importTemplateOptions: importOps.importTemplateOptions,
    importOrderDialog: importOps.importOrderDialog,
    openImportOrderDialog: importOps.openImportOrderDialog,
    closeImportOrderDialog: importOps.closeImportOrderDialog,
    searchImportOrders: importOps.searchImportOrders,
    applyImportOrder: importOps.applyImportOrder,
    loadImportTemplateOptions: importOps.loadImportTemplateOptions,
    openImportTemplateDialog: importOps.openImportTemplateDialog,
    applyImportTemplate: importOps.applyImportTemplate,
    getImportOrderStatusLabel: importOps.getImportOrderStatusLabel,
    getImportOrderStatusTagType: importOps.getImportOrderStatusTagType,

    // utils
    getJobTypeLabel,

    // calculations
    ...calculations,
  }
}

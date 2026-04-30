<template>
  <div class="page-card page-card--fill inventory-finished-page">
    <el-tabs v-model="pageTab" class="inventory-tabs list-page-tabs" @tab-change="onPageTabChange">
      <el-tab-pane label="库存" name="stock">
        <div class="tab-pane-scroll">
        <FinishedStockTab
          :filter="filter"
          :order-no-label-visible="orderNoLabelVisible"
          :sku-code-label-visible="skuCodeLabelVisible"
          :inbound-date-range="inboundDateRange"
          :customer-options="customerOptions"
          :inventory-type-options="inventoryTypeOptions"
          :active-filter-color="ACTIVE_FILTER_COLOR"
          :has-pending-selection="hasPendingSelection"
          :has-stored-selection="hasStoredSelection"
          :selected-rows="selectedRows"
          :loading="loading"
          :stock-table-data="pagedStockTableData"
          :table-ref="finishedStockTableRef"
          :compact-header-cell-style="compactHeaderCellStyle"
          :compact-cell-style="compactCellStyle"
          :compact-row-style="compactRowStyle"
          :compact-image-size="compactImageSize"
          :compact-image-column-min-width="compactImageColumnMinWidth"
          :stock-list-footer-quantity="stockListFooterQuantity"
          :stock-list-footer-amount="stockListFooterAmount"
          :pagination="pagination"
          :find-inventory-type-label-by-id="findInventoryTypeLabelById"
          :find-warehouse-label-by-id="findWarehouseLabelById"
          :get-table-color-text="getTableColorText"
          :get-table-image-url="getTableImageUrl"
          :get-stock-table-row-key="getStockTableRowKey"
          :get-finished-stock-row-class-name="getFinishedStockRowClassName"
          :is-selectable-stock-row="isSelectableStockRow"
          :qty-tooltip-enabled="qtyTooltipEnabled"
          :on-qty-tooltip-show="onQtyTooltipShow"
          :is-qty-tooltip-loading="isQtyTooltipLoading"
          :is-qty-tooltip-error="isQtyTooltipError"
          :get-preview-headers="getPreviewHeaders"
          :get-preview-rows="getPreviewRows"
          @update:inbound-date-range="inboundDateRange = $event"
          @search="onSearch"
          @debounced-search="debouncedSearch"
          @reset="onReset"
          @open-create="openCreateDialog"
          @open-inbound="openInboundDialog"
          @open-outbound="openOutboundDialog"
          @selection-change="onSelectionChange"
          @open-detail="openDetail"
          @current-change="onCurrentPageChange"
          @page-size-change="onPageSizeChange"
          @header-dragend="onFinishedStockHeaderDragEnd"
        />
        </div>
      </el-tab-pane>
      <el-tab-pane label="出库记录" name="outbounds">
        <div class="tab-pane-scroll">
        <FinishedOutboundTab
          :outbound-filter="outboundFilter"
          :customer-options="customerOptions"
          :loading="outboundLoading2"
          :outbound-list="outboundList"
          :outbound-pagination="outboundPagination"
          :table-ref="finishedOutboundTableRef"
          :compact-header-cell-style="compactHeaderCellStyle"
          :compact-cell-style="compactCellStyle"
          :compact-row-style="compactRowStyle"
          :compact-image-size="compactImageSize"
          :compact-image-column-min-width="compactImageColumnMinWidth"
          :find-inventory-type-label-by-id="findInventoryTypeLabelById"
          :find-warehouse-label-by-id="findWarehouseLabelById"
          @update:date-range="outboundFilter.dateRange = $event"
          @search="onOutboundSearch"
          @reset="onOutboundReset"
          @current-change="onOutboundCurrentChange"
          @page-size-change="onOutboundSizeChange"
          @header-dragend="onFinishedOutboundHeaderDragEnd"
        />
        </div>
      </el-tab-pane>
    </el-tabs>
    <FinishedInboundDialog v-model="inboundDialog.visible" :stock-id="inboundDialog.stockId" :stock-label="inboundDialog.stockLabel" @submitted="load()" />
    <FinishedOutboundDialog v-model="outboundDialog.visible" :stock-id="outboundDialog.stockId" :stock-info="outboundDialog.stockInfo" @submitted="load()" />
    <FinishedCreateDialog
      v-model="createDialogVisible"
      :warehouse-options="warehouseOptions"
      :inventory-type-options="inventoryTypeOptions"
      :department-options="departmentOptions"
      @created="load()"
    />
    <FinishedDetailDrawer
      v-model="detailDrawer.visible"
      :stock-id="detailDrawer.stockId"
      :initial-color-name="detailDrawer.selectedColorName"
      :initial-quantity="detailDrawer.selectedQuantity"
      :group-product-image="detailDrawer.groupProductImage"
      :group-size-headers="detailDrawer.groupSizeHeaders"
      :inventory-type-options="inventoryTypeOptions"
      :warehouse-options="warehouseOptions"
      :department-options="departmentOptions"
      @color-images-synced="onColorImagesSynced"
      @color-image-saved="onColorImageSaved"
      @meta-saved="onMetaSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import '@/styles/inventory-finished.css'
import FinishedDetailDrawer from '@/components/inventory/FinishedDetailDrawer.vue'
import FinishedInboundDialog from '@/components/inventory/FinishedInboundDialog.vue'
import FinishedOutboundDialog from '@/components/inventory/FinishedOutboundDialog.vue'
import FinishedCreateDialog from '@/components/inventory/FinishedCreateDialog.vue'
import FinishedStockTab from '@/components/inventory/FinishedStockTab.vue'
import FinishedOutboundTab from '@/components/inventory/FinishedOutboundTab.vue'
import { getFinishedStockList, type FinishedStockRow } from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import { useFinishedOptions } from '@/composables/useFinishedOptions'
import { useFinishedOutboundRecords } from '@/composables/useFinishedOutboundRecords'
import { useFinishedStockTable } from '@/composables/useFinishedStockTable'
import { ACTIVE_FILTER_COLOR } from '@/composables/useFilterBarHelpers'
import { useFinishedViewStockFilter } from '@/composables/useFinishedViewStockFilter'
import { type StockTableRow } from '@/utils/finishedStockTableUtils'
import { useFinishedViewStockInteractions } from '@/composables/useFinishedViewStockInteractions'

const pageTab = ref<'stock' | 'outbounds'>('stock')
const list = ref<FinishedStockRow[]>([])
const finishedStockTableRef = ref()
const {
  compactHeaderCellStyle,
  compactCellStyle,
  compactRowStyle,
  compactImageSize,
  compactImageColumnMinWidth,
} = useCompactTableStyle()
const {
  customerOptions, warehouseOptions, inventoryTypeOptions, departmentOptions,
  loadWarehouseOptions, loadInventoryTypeOptions, loadDepartmentOptions, loadCustomerOptions,
  findWarehouseLabelById, findInventoryTypeLabelById,
} = useFinishedOptions()
const {
  outboundFilter,
  outboundList,
  outboundLoading2,
  outboundPagination,
  finishedOutboundTableRef,
  loadOutbounds,
  onOutboundSearch,
  onOutboundReset,
} = useFinishedOutboundRecords()
const {
  stockTableData,
  getGroupSizeHeaders,
  buildPreviewData,
  getSharedProductImageUrl,
  getProductImageUrl,
  prefetchStoredRowBreakdowns,
  isQtyTooltipLoading,
  isQtyTooltipError,
  qtyTooltipEnabled,
  onQtyTooltipShow,
} = useFinishedStockTable(list)
const loading = ref(false)
/** 当前筛选下全量匹配的总件数（接口返回）；有表格勾选时底部改为已选行的件数合计 */
const stockTotalQuantity = ref(0)
const stockTotalAmount = ref(0)
const {
  selectedRows,
  hasPendingSelection,
  hasStoredSelection,
  detailDrawer,
  inboundDialog,
  outboundDialog,
  createDialogVisible,
  onSelectionChange,
  openDetail,
  openInboundDialog,
  openOutboundDialog,
  openCreateDialog,
  onColorImagesSynced,
  onColorImageSaved,
  onMetaSaved,
  clearSelection,
} = useFinishedViewStockInteractions({
  list,
  getSharedProductImageUrl,
  getGroupSizeHeaders,
  load,
})
const { currentTab, filter, orderNoLabelVisible, skuCodeLabelVisible, inboundDateRange, pagination, onSearch, debouncedSearch, onReset, onPageSizeChange, onCurrentPageChange } =
  useFinishedViewStockFilter(load, clearSelection)

/**
 * 成品库存表格的 pageSize 只约束顶层父行数量。
 * stockTableData 本身就是顶层行数组；子行挂在父行的 _children 上，
 * 所以这里按 pageSize 截断不会影响展开后的子行展示。
 */
const pagedStockTableData = computed(() => stockTableData.value.slice(0, pagination.pageSize))

const stockListFooterQuantity = computed(() => {
  if (selectedRows.value.length > 0) {
    return selectedRows.value.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
  }
  return stockTotalQuantity.value
})

const stockListFooterAmount = computed(() => {
  if (selectedRows.value.length > 0) {
    return selectedRows.value.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0), 0)
  }
  return stockTotalAmount.value
})

function getTableImageUrl(row: StockTableRow): string {
  return row._effectiveImageUrl || getProductImageUrl(row)
}

function getTableColorText(row: StockTableRow): string {
  return row._displayColor || '-'
}

function getStockTableRowKey(row: StockTableRow): string {
  return row._uiKey
}

function getFinishedStockRowClassName({ row }: { row: StockTableRow }): string {
  return row._rowKind === 'parent' ? 'stock-parent-row' : 'stock-child-row'
}

function isSelectableStockRow(row: StockTableRow): boolean {
  return row._rowKind === 'leaf'
}

function getPreviewHeaders(row: StockTableRow): string[] {
  return buildPreviewData(row)?.headers ?? []
}

function getPreviewRows(row: StockTableRow) {
  return buildPreviewData(row)?.rows ?? []
}

const { onHeaderDragEnd: onFinishedStockHeaderDragEnd, restoreColumnWidths: restoreFinishedStockColumnWidths } =
  useTableColumnWidthPersist('inventory-finished-stock')
const { onHeaderDragEnd: onFinishedOutboundHeaderDragEnd } =
  useTableColumnWidthPersist('inventory-finished-outbounds')

async function load() {
  loading.value = true
  try {
    const [startDate, endDate] =
      inboundDateRange.value && inboundDateRange.value.length === 2 ? inboundDateRange.value : ['', '']
    const res = await getFinishedStockList({
      tab: currentTab.value,
      orderNo: filter.orderNo || undefined,
      skuCode: filter.skuCode || undefined,
      customerName: filter.customerName || undefined,
      inventoryTypeId: filter.inventoryTypeId ?? undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
      paginateByVisibleGroup: currentTab.value === 'stored',
    })
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      stockTotalQuantity.value = Number(data.totalQuantity ?? 0) || 0
      stockTotalAmount.value = Number(data.totalAmount ?? 0) || 0
      restoreFinishedStockColumnWidths(finishedStockTableRef.value)
      void prefetchStoredRowBreakdowns(list.value)
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function onPageTabChange() {
  if (pageTab.value === 'outbounds') {
    outboundPagination.page = 1
    void loadOutbounds()
  }
}

function onOutboundCurrentChange(page: number) {
  outboundPagination.page = page
  void loadOutbounds()
}

function onOutboundSizeChange(pageSize: number) {
  outboundPagination.pageSize = pageSize
  outboundPagination.page = 1
  void loadOutbounds()
}

onMounted(async () => {
  await Promise.all([
    loadWarehouseOptions(),
    loadInventoryTypeOptions(),
    loadCustomerOptions(),
    loadDepartmentOptions(),
  ])
  await load()
})
</script>

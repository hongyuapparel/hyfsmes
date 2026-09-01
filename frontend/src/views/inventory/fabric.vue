<template>
  <div class="page-card page-card--fill inventory-fabric-page">
    <el-tabs v-model="pageTab" class="inventory-tabs list-page-tabs">
      <el-tab-pane label="库存" name="stock">
        <div class="tab-pane-scroll">
        <el-form class="filter-bar has-filter-collapse" @submit.prevent>
          <el-input
            v-model="filter.name"
            placeholder="面料名称"
            clearable
            class="filter-bar-item"
            :style="getTextFilterStyle('名称：', filter.name, nameLabelVisible)"
            :input-style="getFilterInputStyle(filter.name)"
            @input="debouncedSearch"
            @keyup.enter="onSearch(true)"
          >
            <template #prefix>
              <span
                v-if="filter.name && nameLabelVisible"
                :style="{ color: ACTIVE_FILTER_COLOR }"
              >
                名称：
              </span>
            </template>
          </el-input>
          <el-select
            v-model="filter.customerName"
            placeholder="客户"
            filterable
            clearable
            class="filter-bar-item"
            :style="getAdaptiveSelectStyle(filter.customerName ? `客户：${filter.customerName}` : '', '客户', 42)"
            @change="onSearch(true)"
          >
            <template #label="{ label }">
              <span v-if="filter.customerName">客户：{{ label }}</span>
              <span v-else>{{ label }}</span>
            </template>
            <el-option
              v-for="opt in customerOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <FilterCollapseToggle v-model:collapsed="collapsed" :active-count="activeFilterCount" />
          <div class="filter-rest" v-show="!isMobile || !collapsed">
          <el-select
            v-model="filter.supplierId"
            placeholder="供应商"
            filterable
            clearable
            class="filter-bar-item"
            :loading="fabricSupplierOptionsLoading"
            :style="getAdaptiveSelectStyle(filter.supplierId ? `供应商：${selectedSupplierLabel}` : '', '供应商', 42)"
            @change="onSearch(true)"
          >
            <template #label="{ label }">
              <span v-if="filter.supplierId">供应商：{{ label }}</span>
              <span v-else>{{ label }}</span>
            </template>
            <el-option
              v-for="opt in fabricSupplierOptions"
              :key="opt.id"
              :label="opt.name"
              :value="opt.id"
            />
          </el-select>
          <el-select
            v-model="filter.inventoryTypeId"
            placeholder="库存类型"
            filterable
            clearable
            class="filter-bar-item"
            :style="getAdaptiveSelectStyle(filter.inventoryTypeId ? `库存类型：${selectedInventoryTypeLabel}` : '', '库存类型', 42)"
            @change="onSearch(true)"
          >
            <template #label="{ label }">
              <span v-if="filter.inventoryTypeId">库存类型：{{ label }}</span>
              <span v-else>{{ label }}</span>
            </template>
            <el-option
              v-for="opt in inventoryTypeOptions"
              :key="opt.id"
              :label="opt.label"
              :value="opt.id"
            />
          </el-select>
          <div
            class="filter-bar-item filter-date-box"
            :class="{ 'is-active': inboundDateRange }"
            :style="getFilterRangeStyle(inboundDateRange, '创建时间')"
          >
            <span v-if="inboundDateRange" class="filter-date-label-text" :style="{ color: ACTIVE_FILTER_COLOR }">创建时间：</span>
            <el-date-picker
              v-model="inboundDateRange"
              type="daterange"
              :name="['fabricInboundDateStart', 'fabricInboundDateEnd']"
              :range-separator="inboundDateRange ? '~' : ''"
              start-placeholder="创建时间"
              end-placeholder=""
              value-format="YYYY-MM-DD"
              :shortcuts="rangeShortcuts"
              unlink-panels
              clearable
              :class="['filter-range', { 'range-single': !inboundDateRange }]"
              @change="onSearch(true)"
            />
          </div>
          </div>
          <div class="filter-bar-actions">
            <el-button type="primary" @click="onSearch(true)">搜索</el-button>
            <el-button @click="onReset">清空</el-button>
            <el-button :loading="exporting" @click="onExport">{{ exportButtonText }}</el-button>
            <el-button :disabled="!selectedRows.length" @click="batchPricing.open">批量补价</el-button>
            <el-button type="primary" @click="openForm(null)">新增面料</el-button>
            <el-button
              v-if="selectedRows.length"
              type="warning"
              :disabled="selectedRows.length !== 1"
              @click="openOutboundDialog()"
            >
              出库
            </el-button>
          </div>
        </el-form>

        <div v-if="selectedRows.length" class="table-selection-count">已选 {{ selectedRows.length }} 条库存记录</div>

        <div ref="fabricStockShellRef" class="list-page-table-shell">
        <el-table
          ref="fabricStockTableRef"
          v-loading="loading"
          :data="list"
          border
          stripe
          class="fabric-table"
          :height="fabricStockTableHeight"
          :row-style="compactRowStyle"
          :cell-style="compactCellStyle"
          :header-cell-style="compactHeaderCellStyle"
          @header-dragend="onFabricStockHeaderDragEnd"
          @selection-change="onSelectionChange"
          @sort-change="onSortChange"
          @row-click="onRowClick"
        >
          <el-table-column type="selection" width="48" align="center" header-align="center" />
          <el-table-column label="图片" :width="compactImageColumnMinWidth" align="center" header-align="center">
            <template #default="{ row }">
              <AppImageThumb
                v-if="row.imageUrl"
                :raw-url="row.imageUrl"
                :width="compactImageSize"
                :height="compactImageSize"
              />
              <span v-else class="text-placeholder">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="面料名称" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="supplierName" label="供应商" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="inventoryTypeLabel" label="库存类型" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="warehouseLabel" label="仓库" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="storageLocation" label="存放地址" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="quantity" label="数量" width="100" align="center" header-align="center" sortable="custom">
            <template #default="{ row }">{{ formatDisplayNumber(row.quantity) }}</template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="70" align="center" header-align="center" />
          <el-table-column prop="unitPrice" label="实际成本单价" width="130" align="right" header-align="center" sortable="custom">
            <template #default="{ row }">{{ row.unitPrice == null ? '未计价' : formatMoneyAligned(row.unitPrice) }}</template>
          </el-table-column>
          <el-table-column prop="amount" label="库存金额" width="130" align="right" header-align="center" sortable="custom">
            <template #default="{ row }">{{ row.amount == null ? '未计价' : formatMoneyAligned(row.amount) }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="createdAt" label="创建时间" width="160" align="center" header-align="center">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="90" align="center" header-align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click.stop="openForm(row, 'view')">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
        </div>

        <AppPaginationBar
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :total-quantity="stockTotalQuantity"
          :secondary-quantity="stockUnpricedQuantityDisplay"
          :secondary-label="`未计价（${stockUnpricedCountDisplay}条）`"
          :total-amount="stockTotalAmountDisplay"
          summary-label="总数量"
          total-amount-label="已计价金额"
          @current-change="load"
          @size-change="onPageSizeChange"
        />
        </div>
      </el-tab-pane>

      <el-tab-pane label="出库记录" name="outbounds">
        <FabricOutboundTab
          ref="fabricOutboundTabRef"
          :customer-options="customerOptions"
          :inventory-type-options="inventoryTypeOptions"
        />
      </el-tab-pane>
    </el-tabs>

    <FabricFormDrawer
      ref="fabricFormDialogRef"
      :visible="formDialog.visible"
      :submitting="formDialog.submitting"
      :mode="formDialog.mode"
      :quick-add-source="quickAddSource"
      :form="form"
      :form-rules="formRules"
      :customer-options="customerOptions"
      :fabric-supplier-options="fabricSupplierOptions"
      :fabric-supplier-select-key="fabricSupplierSelectKey"
      :fabric-supplier-options-loading="fabricSupplierOptionsLoading"
      :warehouse-options="warehouseOptions"
      :inventory-type-options="inventoryTypeOptions"
      :logs="logs"
      :logs-loading="formDialog.logsLoading"
      :format-log-action="formatLogAction"
      @update:visible="formDialog.visible = $event"
      @confirm="submitForm"
      @close="resetForm"
      @edit="enterEdit"
      @exit-edit="exitEdit"
    />

    <FabricOutboundDialog
      :visible="outboundDialog.visible"
      :submitting="outboundDialog.submitting"
      :outbound-form="outboundForm"
      :outbound-rules="outboundRules"
      :outbound-max-qty="outboundMaxQty"
      :outbound-unit-price="outboundUnitPrice"
      :outbound-amount="outboundAmount"
      :fabric-pickup-user-options="fabricPickupUserOptions"
      @update:visible="outboundDialog.visible = $event"
      @confirm="submitOutbound"
      @closed="resetOutboundForm"
    />

    <FabricBatchPriceDialog
      v-model:visible="batchPricing.visible.value"
      :submitting="batchPricing.submitting.value"
      :rows="batchPricing.rows"
      @confirm="batchPricing.submit"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import { useFabricInventoryStock } from '@/composables/useFabricInventoryStock'
import { useFabricFormDialog, type FabricFormDialogExpose } from '@/composables/useFabricFormDialog'
import { useFabricInventoryOutbound } from '@/composables/useFabricInventoryOutbound'
import { useFabricBatchPricing } from '@/composables/useFabricBatchPricing'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getTextFilterStyle,
  getFilterRangeStyle,
  getAdaptiveSelectStyle,
} from '@/composables/useFilterBarHelpers'
import type { FabricItem } from '@/api/inventory'
import { formatDateTime as formatDate } from '@/utils/date-format'
import { formatDisplayNumber, formatMoneyAligned } from '@/utils/display-number'
import FabricFormDrawer from '@/components/inventory/FabricFormDrawer.vue'
import FabricOutboundDialog from '@/components/inventory/FabricOutboundDialog.vue'
import FabricOutboundTab from '@/components/inventory/FabricOutboundTab.vue'
import FabricBatchPriceDialog from '@/components/inventory/FabricBatchPriceDialog.vue'
import AppPaginationBar from '@/components/AppPaginationBar.vue'
import FilterCollapseToggle from '@/components/common/FilterCollapseToggle.vue'
import { useFilterCollapse } from '@/composables/useFilterCollapse'
const {
  compactHeaderCellStyle,
  compactCellStyle,
  compactRowStyle,
  compactImageSize,
  compactImageColumnMinWidth,
} = useCompactTableStyle()
const pageTab = ref<'stock' | 'outbounds'>('stock')
const stock = useFabricInventoryStock()
const fabricOutboundTabRef = ref<InstanceType<typeof FabricOutboundTab>>()
const outbound = useFabricInventoryOutbound({
  selectedRows: stock.selectedRows,
  reloadStock: stock.load,
  reloadOutbounds: () => fabricOutboundTabRef.value?.load(),
  clearSelection: () => stock.fabricStockTableRef.value?.clearSelection(),
})

const {
  filter,
  inboundDateRange,
  nameLabelVisible,
  list,
  loading,
  stockTotalQuantity: stockGrandTotalQuantity,
  stockTotalAmount: stockGrandTotalAmount,
  stockUnpricedCount: stockGrandUnpricedCount,
  stockUnpricedQuantity: stockGrandUnpricedQuantity,
  pagination,
  selectedRows,
  exporting,
  onExport,
  customerOptions,
  fabricSupplierOptions,
  fabricSupplierOptionsLoading,
  warehouseOptions,
  inventoryTypeOptions,
  fabricStockTableRef,
  fabricStockShellRef,
  fabricStockTableHeight,
  onFabricStockHeaderDragEnd,
  onSortChange,
  load,
  onSearch,
  debouncedSearch,
  onReset,
  onPageSizeChange,
  onSelectionChange,
  loadCustomerOptions,
  loadFabricSupplierOptions,
  loadWarehouseOptions,
  loadInventoryTypeOptions,
} = stock

const fabricFormDialogRef = ref<FabricFormDialogExpose>()
const {
  formDialog,
  quickAddSource,
  fabricSupplierSelectKey,
  form,
  formRules,
  logs,
  openForm,
  enterEdit,
  exitEdit,
  resetForm,
  submitForm,
  formatLogAction,
} = useFabricFormDialog(selectedRows, load, fabricFormDialogRef, loadFabricSupplierOptions)

const batchPricing = useFabricBatchPricing({
  selectedRows,
  reload: load,
  clearSelection: () => fabricStockTableRef.value?.clearSelection(),
})

function onRowClick(row: FabricItem, column?: { type?: string; label?: string }) {
  if (column?.type === 'selection' || column?.label === '操作') return
  openForm(row, 'view')
}

const {
  outboundDialog,
  outboundForm,
  outboundRules,
  outboundMaxQty,
  outboundUnitPrice,
  outboundAmount,
  fabricPickupUserOptions,
  loadFabricPickupUserOptions,
  openOutboundDialog,
  resetOutboundForm,
  submitOutbound,
} = outbound

const stockTotalQuantity = computed(() => {
  if (selectedRows.value.length > 0) {
    return selectedRows.value.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
  }
  return stockGrandTotalQuantity.value
})
const stockTotalAmountDisplay = computed(() => {
  if (!selectedRows.value.length) return stockGrandTotalAmount.value
  return selectedRows.value.reduce((sum, row) => sum + (row.amount == null ? 0 : Number(row.amount) || 0), 0)
})
const stockUnpricedCountDisplay = computed(() => selectedRows.value.length
  ? selectedRows.value.filter((row) => row.unitPrice == null).length
  : stockGrandUnpricedCount.value)
const stockUnpricedQuantityDisplay = computed(() => selectedRows.value.length
  ? selectedRows.value.reduce((sum, row) => sum + (row.unitPrice == null ? Number(row.quantity) || 0 : 0), 0)
  : stockGrandUnpricedQuantity.value)
const exportButtonText = computed(() =>
  selectedRows.value.length > 0 ? `导出已选（${selectedRows.value.length}）` : '导出筛选结果',
)
const selectedInventoryTypeLabel = computed(() => {
  const id = filter.inventoryTypeId
  if (id == null) return ''
  return inventoryTypeOptions.value.find((o) => o.id === id)?.label ?? ''
})
const selectedSupplierLabel = computed(() => {
  const id = filter.supplierId
  if (id == null) return ''
  return fabricSupplierOptions.value.find((option) => option.id === id)?.name ?? ''
})
const { collapsed, isMobile } = useFilterCollapse('inventory-fabric-stock')
const activeFilterCount = computed(() => {
  let n = 0
  if (filter.name) n++
  if (filter.customerName) n++
  if (filter.supplierId != null) n++
  if (filter.inventoryTypeId != null) n++
  if (inboundDateRange.value) n++
  return n
})

onMounted(() => {
  loadCustomerOptions()
  loadFabricSupplierOptions()
  loadWarehouseOptions()
  loadInventoryTypeOptions()
  loadFabricPickupUserOptions()
  load()
})

</script>

<style scoped>
.inventory-fabric-page {
  display: flex;
  flex-direction: column;
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
  overflow: hidden;
}

.inventory-fabric-page .fabric-table {
  flex: 1;
  min-height: 0;
}

.fabric-table :deep(.cell) {
  padding-left: 6px;
  padding-right: 6px;
  line-height: 20px;
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-caption);
}

/* 统一行高：compactRowStyle 的 min-height 对 <tr> 无效，改在 td 上固定高度，
   避免「有照片行被缩略图撑高、无照片行很矮」造成的行高参差 */
.fabric-table :deep(td.el-table__cell) {
  height: 52px;
}


</style>

<template>
  <div class="page-card page-card--fill inventory-fabric-page">
    <el-tabs v-model="pageTab" class="inventory-tabs list-page-tabs" @tab-change="onPageTabChange">
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
            :style="getFilterRangeStyle(inboundDateRange, '入库时间')"
          >
            <span v-if="inboundDateRange" class="filter-date-label-text" :style="{ color: ACTIVE_FILTER_COLOR }">入库时间：</span>
            <el-date-picker
              v-model="inboundDateRange"
              type="daterange"
              :name="['fabricInboundDateStart', 'fabricInboundDateEnd']"
              :range-separator="inboundDateRange ? '~' : ''"
              start-placeholder="入库时间"
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
          <el-table-column label="数量" width="100" align="center" header-align="center">
            <template #default="{ row }">{{ formatDisplayNumber(row.quantity) }}</template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="70" align="center" header-align="center" />
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
          summary-label="总数量"
          @current-change="load"
          @size-change="onPageSizeChange"
        />
        </div>
      </el-tab-pane>

      <el-tab-pane label="出库记录" name="outbounds">
        <div class="tab-pane-scroll">
        <el-form class="filter-bar" @submit.prevent>
          <el-input
            v-model="outboundFilter.name"
            placeholder="面料名称"
            clearable
            class="filter-bar-item"
            :style="getTextFilterStyle('面料名称', outboundFilter.name, false)"
            :input-style="getFilterInputStyle(outboundFilter.name)"
            @keyup.enter="onOutboundSearch(true)"
          />
          <el-select
            v-model="outboundFilter.customerName"
            placeholder="客户"
            filterable
            clearable
            class="filter-bar-item"
            :style="getAdaptiveSelectStyle(outboundFilter.customerName ? `客户：${outboundFilter.customerName}` : '', '客户', 42)"
            @change="onOutboundSearch(true)"
          >
            <template #label="{ label }">
              <span v-if="outboundFilter.customerName">客户：{{ label }}</span>
              <span v-else>{{ label }}</span>
            </template>
            <el-option v-for="opt in customerOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <div
            class="filter-bar-item filter-date-box"
            :class="{ 'is-active': outboundFilter.dateRange && outboundFilter.dateRange.length === 2 }"
            :style="getFilterRangeStyle(outboundFilter.dateRange as [string, string] | [], '出库时间')"
          >
            <span v-if="outboundFilter.dateRange && outboundFilter.dateRange.length === 2" class="filter-date-label-text" :style="{ color: ACTIVE_FILTER_COLOR }">出库时间：</span>
            <el-date-picker
              v-model="outboundFilter.dateRange"
              type="daterange"
              :name="['fabricOutboundDateStart', 'fabricOutboundDateEnd']"
              :range-separator="outboundFilter.dateRange && outboundFilter.dateRange.length === 2 ? '~' : ''"
              start-placeholder="出库时间"
              end-placeholder=""
              unlink-panels
              clearable
              value-format="YYYY-MM-DD"
              :shortcuts="rangeShortcuts"
              :class="['filter-range', { 'range-single': !(outboundFilter.dateRange && outboundFilter.dateRange.length === 2) }]"
              @change="onOutboundSearch(true)"
            />
          </div>
          <div class="filter-bar-actions">
            <el-button type="primary" @click="onOutboundSearch(true)">搜索</el-button>
            <el-button @click="onOutboundReset">清空</el-button>
          </div>
        </el-form>

        <div ref="fabricOutboundShellRef" class="list-page-table-shell">
        <el-table
          ref="fabricOutboundTableRef"
          v-loading="outboundLoading2"
          :data="outboundList"
          border
          stripe
          class="fabric-table"
          :height="fabricOutboundTableHeight"
          :row-style="compactRowStyle"
          :cell-style="compactCellStyle"
          :header-cell-style="compactHeaderCellStyle"
          @header-dragend="onFabricOutboundHeaderDragEnd"
        >
          <el-table-column prop="createdAt" label="时间" width="160" align="center" header-align="center" />
          <el-table-column prop="name" label="面料名称" min-width="140" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="pickupUserName" label="领取人" min-width="100" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="出库数量" width="110" align="center" header-align="center">
            <template #default="{ row }">{{ formatDisplayNumber(row.quantity) }} {{ row.unit }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="照片" :width="compactImageColumnMinWidth" align="center" header-align="center">
            <template #default="{ row }">
              <AppImageThumb
                v-if="row.photoUrl"
                :raw-url="row.photoUrl"
                :width="compactImageSize"
                :height="compactImageSize"
              />
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
        </div>

        <AppPaginationBar
          v-model:current-page="outboundPagination.page"
          v-model:page-size="outboundPagination.pageSize"
          :total="outboundPagination.total"
          :total-quantity="outboundTotalQuantity"
          summary-label="出库数量"
          @current-change="loadOutbounds"
          @size-change="onOutboundPageSizeChange"
        />
        </div>
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
      :fabric-pickup-user-options="fabricPickupUserOptions"
      @update:visible="outboundDialog.visible = $event"
      @confirm="submitOutbound"
      @close="resetOutboundForm"
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
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getTextFilterStyle,
  getFilterRangeStyle,
  getAdaptiveSelectStyle,
} from '@/composables/useFilterBarHelpers'
import type { FabricItem } from '@/api/inventory'
import { formatDateTime as formatDate } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import FabricFormDrawer from '@/components/inventory/FabricFormDrawer.vue'
import FabricOutboundDialog from '@/components/inventory/FabricOutboundDialog.vue'
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
const outbound = useFabricInventoryOutbound({
  selectedRows: stock.selectedRows,
  reloadStock: stock.load,
})

const {
  filter,
  inboundDateRange,
  nameLabelVisible,
  list,
  loading,
  stockTotalQuantity: stockGrandTotalQuantity,
  pagination,
  selectedRows,
  customerOptions,
  fabricSupplierOptions,
  fabricSupplierOptionsLoading,
  warehouseOptions,
  inventoryTypeOptions,
  fabricStockTableRef,
  fabricStockShellRef,
  fabricStockTableHeight,
  onFabricStockHeaderDragEnd,
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

function onRowClick(row: FabricItem, column?: { type?: string; label?: string }) {
  if (column?.type === 'selection' || column?.label === '操作') return
  openForm(row, 'view')
}

const {
  outboundFilter,
  outboundList,
  outboundLoading2,
  outboundPagination,
  fabricOutboundTableRef,
  fabricOutboundShellRef,
  fabricOutboundTableHeight,
  onFabricOutboundHeaderDragEnd,
  outboundDialog,
  outboundForm,
  outboundRules,
  outboundMaxQty,
  fabricPickupUserOptions,
  loadOutbounds,
  onOutboundSearch,
  onOutboundReset,
  onOutboundPageSizeChange,
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
const selectedInventoryTypeLabel = computed(() => {
  const id = filter.inventoryTypeId
  if (id == null) return ''
  return inventoryTypeOptions.value.find((o) => o.id === id)?.label ?? ''
})
const outboundTotalQuantity = computed(() => outboundList.value.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0))

const { collapsed, isMobile } = useFilterCollapse('inventory-fabric-stock')
const activeFilterCount = computed(() => {
  let n = 0
  if (filter.name) n++
  if (filter.customerName) n++
  if (filter.inventoryTypeId != null) n++
  if (inboundDateRange.value) n++
  return n
})

function onPageTabChange() {
  if (pageTab.value === 'outbounds') {
    outboundPagination.page = 1
    loadOutbounds()
  }
}

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

/* 统一行高：compactRowStyle 的 min-height 对 <tr> 无效，改在 td 上固定高度，
   避免「有照片行被缩略图撑高、无照片行很矮」造成的行高参差 */
.fabric-table :deep(td.el-table__cell) {
  height: 52px;
}


</style>

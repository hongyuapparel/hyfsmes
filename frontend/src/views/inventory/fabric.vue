<template>
  <div class="page-card page-card--fill inventory-fabric-page">
    <el-tabs v-model="pageTab" class="inventory-tabs list-page-tabs" @tab-change="onPageTabChange">
      <el-tab-pane label="库存" name="stock">
        <div class="tab-pane-scroll">
        <el-form class="filter-bar" @submit.prevent>
          <el-input
            v-model="filter.name"
            placeholder="面料名称"
            clearable
            size="large"
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
            size="large"
            class="filter-bar-item"
            @change="onSearch(true)"
          >
            <el-option
              v-for="opt in customerOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <el-date-picker
            v-model="inboundDateRange"
            type="daterange"
            range-separator=""
            start-placeholder="入库时间"
            end-placeholder=""
            value-format="YYYY-MM-DD"
            :shortcuts="rangeShortcuts"
            unlink-panels
            clearable
            size="large"
            :class="['filter-bar-item', 'filter-range', { 'range-single': !inboundDateRange }]"
            :style="getFilterRangeStyle(inboundDateRange)"
            @change="onSearch(true)"
          />
          <div class="filter-bar-actions">
            <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
            <el-button size="large" @click="onReset">清空</el-button>
            <el-button type="primary" size="large" @click="openForm(null)">新增面料</el-button>
            <el-button
              v-if="selectedRows.length"
              type="warning"
              size="large"
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
          <el-table-column label="操作" width="120" align="center" header-align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="info" size="small" @click="openDetail(row)">详情</el-button>
              <el-button link type="primary" size="small" @click="openForm(row)">编辑</el-button>
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
          <el-input v-model="outboundFilter.name" placeholder="面料名称" clearable size="large" class="filter-bar-item" @keyup.enter="onOutboundSearch(true)" />
          <el-select v-model="outboundFilter.customerName" placeholder="客户" filterable clearable size="large" class="filter-bar-item" @change="onOutboundSearch(true)">
            <el-option v-for="opt in customerOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <el-date-picker
            v-model="outboundFilter.dateRange"
            type="daterange"
            start-placeholder="出库时间"
            end-placeholder=""
            range-separator=""
            unlink-panels
            value-format="YYYY-MM-DD"
            :shortcuts="rangeShortcuts"
            size="large"
            :class="['filter-bar-item', { 'range-single': !(outboundFilter.dateRange && outboundFilter.dateRange.length === 2) }]"
            :style="getInventoryOutboundRangeStyle(outboundFilter.dateRange)"
            @change="onOutboundSearch(true)"
          />
          <div class="filter-bar-actions">
            <el-button type="primary" size="large" @click="onOutboundSearch(true)">搜索</el-button>
            <el-button size="large" @click="onOutboundReset">清空</el-button>
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

    <FabricFormDialog
      :visible="formDialog.visible"
      :submitting="formDialog.submitting"
      :is-edit="formDialog.isEdit"
      :quick-add-source="quickAddSource"
      :form="form"
      :form-rules="formRules"
      :customer-options="customerOptions"
      :fabric-supplier-options="fabricSupplierOptions"
      :fabric-supplier-select-key="fabricSupplierSelectKey"
      :fabric-supplier-options-loading="fabricSupplierOptionsLoading"
      :warehouse-options="warehouseOptions"
      @update:visible="formDialog.visible = $event"
      @confirm="submitForm"
      @close="resetForm"
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

    <FabricDetailDrawer
      :visible="detailDrawer.visible"
      :row="detailDrawer.row"
      :loading="detailDrawer.loading"
      :logs="detailDrawer.logs"
      @update:model-value="detailDrawer.visible = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import { useFabricInventoryStock } from '@/composables/useFabricInventoryStock'
import { useFabricInventoryOutbound } from '@/composables/useFabricInventoryOutbound'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getTextFilterStyle,
  getFilterRangeStyle,
} from '@/composables/useFilterBarHelpers'
import { formatDateTime as formatDate } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import FabricFormDialog from '@/components/inventory/FabricFormDialog.vue'
import FabricOutboundDialog from '@/components/inventory/FabricOutboundDialog.vue'
import FabricDetailDrawer from '@/components/inventory/FabricDetailDrawer.vue'
import AppPaginationBar from '@/components/AppPaginationBar.vue'
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
  pagination,
  selectedRows,
  customerOptions,
  fabricSupplierOptions,
  fabricSupplierSelectKey,
  fabricSupplierOptionsLoading,
  warehouseOptions,
  fabricStockTableRef,
  fabricStockShellRef,
  fabricStockTableHeight,
  onFabricStockHeaderDragEnd,
  formDialog,
  quickAddSource,
  form,
  formRules,
  detailDrawer,
  load,
  onSearch,
  debouncedSearch,
  onReset,
  onPageSizeChange,
  onSelectionChange,
  loadCustomerOptions,
  loadFabricSupplierOptions,
  loadWarehouseOptions,
  openForm,
  resetForm,
  submitForm,
  openDetail,
} = stock

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
  getInventoryOutboundRangeStyle,
  loadOutbounds,
  onOutboundSearch,
  onOutboundReset,
  onOutboundPageSizeChange,
  loadFabricPickupUserOptions,
  openOutboundDialog,
  resetOutboundForm,
  submitOutbound,
} = outbound

const stockTotalQuantity = computed(() => list.value.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0))
const outboundTotalQuantity = computed(() => outboundList.value.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0))

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


</style>

<template>
  <div class="page-card page-card--fill purchase-page">
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" @change="onTabChange">
          <el-radio-button
            v-for="tab in PURCHASE_TABS"
            :key="tab.value"
            :value="tab.value"
          >
            {{ getTabLabel(tab) }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="filter-bar has-filter-collapse">
      <el-input
        v-model="filter.orderNo"
        placeholder="订单号"
        clearable
        class="filter-bar-item"
        :style="getOrderNoFilterStyle(filter.orderNo, orderNoLabelVisible)"
        :input-style="getFilterInputStyle(filter.orderNo)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span
            v-if="filter.orderNo && orderNoLabelVisible"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            订单号：
          </span>
        </template>
      </el-input>
      <el-input
        v-model="filter.skuCode"
        placeholder="SKU编号"
        clearable
        class="filter-bar-item"
        :style="getSkuCodeFilterStyle(filter.skuCode, skuCodeLabelVisible)"
        :input-style="getFilterInputStyle(filter.skuCode)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span
            v-if="filter.skuCode && skuCodeLabelVisible"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            SKU编号：
          </span>
        </template>
      </el-input>
      <FilterCollapseToggle v-model:collapsed="collapsed" :active-count="activeFilterCount" />
      <div class="filter-rest" v-show="!isMobile || !collapsed">
      <el-input
        v-model="filter.supplier"
        placeholder="供应商"
        clearable
        class="filter-bar-item"
        :style="getAdaptiveSelectStyle(filter.supplier ? `供应商：${filter.supplier}` : '', '供应商')"
        :input-style="getFilterInputStyle(filter.supplier)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span v-if="filter.supplier" :style="{ color: ACTIVE_FILTER_COLOR }">供应商：</span>
        </template>
      </el-input>
      <el-tree-select
        v-model="filter.orderTypeId"
        :data="orderTypeTreeSelectData"
        placeholder="订单类型"
        popper-class="purchase-order-type-tree-popper"
        filterable
        clearable
        check-strictly
        default-expand-all
        :render-after-expand="false"
        node-key="value"
        :props="{ label: 'label', value: 'value', children: 'children', disabled: 'disabled' }"
        class="filter-bar-item"
        :style="getAdaptiveSelectStyle(filter.orderTypeId && `订单类型：${findOrderTypeLabelById(filter.orderTypeId)}`, '订单类型')"
        @change="onSearch"
        @visible-change="(v: boolean) => v && adjustTreePopperWidth('purchase-order-type-tree-popper')"
      >
        <template #prefix>
          <span v-if="filter.orderTypeId" :style="{ color: ACTIVE_FILTER_COLOR }">订单类型：</span>
        </template>
      </el-tree-select>
      <div
        class="filter-bar-item filter-date-box"
        :class="{ 'is-active': orderDateRange }"
        :style="getFilterRangeStyle(orderDateRange, '下单时间')"
      >
        <span v-if="orderDateRange" class="filter-date-label-text" :style="{ color: ACTIVE_FILTER_COLOR }">下单时间：</span>
        <el-date-picker
          v-model="orderDateRange"
          type="daterange"
          :name="['purchaseOrderDateStart', 'purchaseOrderDateEnd']"
          :range-separator="orderDateRange ? '~' : ''"
          start-placeholder="下单时间"
          end-placeholder=""
          value-format="YYYY-MM-DD"
          :shortcuts="rangeShortcuts"
          unlink-panels
          clearable
          :class="['filter-range', { 'range-single': !orderDateRange }]"
          @change="onSearch"
        />
      </div>
      <div
        class="filter-bar-item filter-date-box"
        :class="{ 'is-active': completedRange }"
        :style="getFilterRangeStyle(completedRange, '完成时间')"
      >
        <span v-if="completedRange" class="filter-date-label-text" :style="{ color: ACTIVE_FILTER_COLOR }">完成时间：</span>
        <el-date-picker
          v-model="completedRange"
          type="daterange"
          :name="['purchaseCompletedDateStart', 'purchaseCompletedDateEnd']"
          :range-separator="completedRange ? '~' : ''"
          start-placeholder="完成时间"
          end-placeholder=""
          value-format="YYYY-MM-DD"
          :shortcuts="rangeShortcuts"
          unlink-panels
          clearable
          :class="['filter-range', { 'range-single': !completedRange }]"
          @change="onSearch"
        />
      </div>
      </div>
      <div class="filter-bar-actions">
        <el-button type="primary" @click="onSearch(true)">搜索</el-button>
        <el-button @click="onReset">清空</el-button>
        <el-button :loading="exporting" @click="onExport">导出表格</el-button>
        <el-button
          v-if="canHandleSelection && canRegisterPurchase"
          type="primary"
          @click="onBatchHandle"
        >
          {{ batchButtonLabel }}
        </el-button>
        <el-button
          v-if="canCompleteSelection && canRegisterPurchase"
          type="primary"
          :loading="completing"
          @click="completeSelection"
        >到货完成</el-button>
        <el-button
          v-if="hasSelection && canEditCompletedPurchaseSelection && canAdminEditSubmitted"
          type="primary"
          @click="openEditCompletedDialog"
        >
          编辑采购
        </el-button>
        <el-button
          v-if="hasSelection && canEditCompletedPickSelection && canAdminEditSubmitted"
          type="primary"
          @click="openEditCompletedPickDialog"
        >
          编辑领料
        </el-button>
      </div>
    </div>

    <div v-if="hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <PurchaseTable
      ref="purchaseTableHostRef"
      :loading="loading"
      :list="list"
      :material-progress-column-label="materialProgressColumnLabel"
      :row-selectable="isPurchaseRowSelectable"
      @header-dragend="onHeaderDragEnd"
      @selection-change="onSelectionChange"
      @open-detail="openPurchaseBriefDrawer"
      @sort-change="onSortChange"
    />

    <AppPaginationBar
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :page-sizes="[20, 50, 100]"
      @current-change="load"
      @size-change="onPageSizeChange"
    />

    <PurchaseBriefDrawer
      v-model="purchaseBriefDrawer.visible"
      :row="purchaseBriefDrawer.row"
      :brief="purchaseBriefDrawer.row ? purchaseBriefFromRow(purchaseBriefDrawer.row) : null"
      :order-type-label="purchaseBriefDrawer.row ? orderTypeDisplay(purchaseBriefDrawer.row) : ''"
      :logs="purchaseDrawerLogs"
      @closed="purchaseBriefDrawer.row = null"
    />

    <PurchaseRegisterDialog
      v-model="registerDialog.visible"
      :rows="registerDialog.rows"
      :mode="registerDialog.mode"
      :submitting="registerDialog.submitting"
      :supplier-options="registerSupplierOptions"
      :supplier-loading="registerSupplierLoading"
      @closed="resetRegisterForm"
      @submit="submitRegister"
      @search-suppliers="searchRegisterSuppliers"
      @supplier-visible-change="onRegisterSupplierVisibleChange"
    />

    <PurchasePickDialog
      v-model="pickDialog.visible"
      :dialog="pickDialog"
      :form="pickForm"
      :rules="pickRules"
      :inventory-options="pickInventoryOptions"
      :inventory-loading="pickInventoryLoading"
      :display-material-type="displayMaterialType"
      @closed="resetPickForm"
      @submit="submitPick"
      @source-type-change="onPickSourceTypeChange"
      @inventory-search="onPickInventorySearch"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { formatDateTime } from '@/utils/date-format'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
  getFilterRangeStyle,
  getAdaptiveSelectStyle,
} from '@/composables/useFilterBarHelpers'
import { useTreeSelectAdjust } from '@/composables/useTreeSelectAdjust'
import { useFilterCollapse } from '@/composables/useFilterCollapse'
import FilterCollapseToggle from '@/components/common/FilterCollapseToggle.vue'

const { adjustTreePopperWidth } = useTreeSelectAdjust()
const { collapsed, isMobile } = useFilterCollapse('production-purchase')
import { PURCHASE_TABS, usePurchaseList } from '@/composables/usePurchaseList'
import { usePurchaseDialogs } from '@/composables/usePurchaseDialogs'
import type { PurchaseItemRow } from '@/api/production-purchase'
import { fetchOrderOperationLogs, toLogSectionItems } from '@/api/operation-logs'
import PurchaseBriefDrawer from '@/components/production/PurchaseBriefDrawer.vue'
import PurchaseTable from '@/components/production/PurchaseTable.vue'
import PurchaseRegisterDialog from '@/components/production/PurchaseRegisterDialog.vue'
import PurchasePickDialog from '@/components/production/PurchasePickDialog.vue'
import { useAuthStore } from '@/stores/auth'
import AppPaginationBar from '@/components/AppPaginationBar.vue'

const authStore = useAuthStore()
const canRegisterPurchase = computed(() => authStore.hasPermission('production_purchase_register'))
const canAdminEditSubmitted = computed(() => authStore.hasPermission('production_admin_edit'))

const {
  filter,
  orderDateRange,
  completedRange,
  orderNoLabelVisible,
  skuCodeLabelVisible,
  currentTab,
  list,
  loading,
  exporting,
  pagination,
  selectedRows,
  hasSelection,
  orderTypeTreeSelectData,
  materialProgressColumnLabel,
  purchaseTableHostRef,
  purchaseBriefDrawer,
  getTabLabel,
  findOrderTypeLabelById,
  load,
  onExport,
  onSearch,
  debouncedSearch,
  onReset,
  onTabChange,
  onPageSizeChange,
  onSelectionChange,
  onSortChange,
  onHeaderDragEnd,
  loadOptions,
  orderTypeDisplay,
  openPurchaseBriefDrawer,
  purchaseBriefFromRow,
  displayMaterialType,
} = usePurchaseList()

const activeFilterCount = computed(() => {
  let n = 0
  if (filter.orderNo) n++
  if (filter.skuCode) n++
  if (filter.supplier) n++
  if (filter.orderTypeId != null) n++
  if (orderDateRange.value) n++
  if (completedRange.value) n++
  return n
})

const {
  registerDialog,
  completing,
  canCompleteSelection,
  canHandleSelection,
  completeSelection,
  registerSupplierOptions,
  registerSupplierLoading,
  pickDialog,
  pickForm,
  pickInventoryOptions,
  pickInventoryLoading,
  pickRules,
  batchButtonLabel,
  isPurchaseRowSelectable,
  onRegisterSupplierVisibleChange,
  searchRegisterSuppliers,
  onBatchHandle,
  onPickSourceTypeChange,
  onPickInventorySearch,
  resetPickForm,
  submitPick,
  resetRegisterForm,
  submitRegister,
  openEditCompletedDialog,
  openEditCompletedPickDialog,
} = usePurchaseDialogs({
  currentTab,
  hasSelection,
  selectedRows,
  canAdminEditSubmitted,
  reload: load,
  clearSelection: () => {
    selectedRows.value = []
  },
})

const canEditCompletedPurchaseSelection = computed(
  () =>
    selectedRows.value.length > 0
    && selectedRows.value.every((r) => r.processRoute === 'purchase' && ['purchasing', 'completed'].includes(r.purchaseStatus)),
)

const canEditCompletedPickSelection = computed(
  () =>
    selectedRows.value.length > 0
    && selectedRows.value.every((r) => r.processRoute === 'picking' && r.pickStatus === 'completed'),
)

const purchaseDrawerLogs = ref<ReturnType<typeof toLogSectionItems>>([])

async function loadPurchaseDrawerLogs(row: PurchaseItemRow | null) {
  if (!row) {
    purchaseDrawerLogs.value = []
    return
  }
  const logs = await fetchOrderOperationLogs(row.orderId, {
    module: 'production_purchase',
    targetType: 'purchase_item',
    targetRef: `${row.orderId}_${row.materialIndex}`,
  })
  purchaseDrawerLogs.value = toLogSectionItems(logs).map((log) => ({
    ...log, createdAt: formatDateTime(log.createdAt),
  }))
}

watch(
  () => purchaseBriefDrawer.row,
  (row) => {
    void loadPurchaseDrawerLogs(row)
  },
)

onMounted(() => {
  void loadOptions()
  void load()
})
</script>

<style scoped>
.purchase-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
}

.status-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.status-tabs-left {
  flex-shrink: 0;
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-body);
}

</style>

<style>
.purchase-order-type-tree-popper.el-popper {
  max-width: 440px;
}
</style>

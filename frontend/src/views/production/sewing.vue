<template>
  <div class="page-card page-card--fill sewing-page">
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
          <el-radio-button v-for="tab in SEWING_TABS" :key="tab.value" :value="tab.value">
            {{ getTabLabel(tab) }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="filter-bar">
      <el-input
        v-model="filter.orderNo"
        placeholder="订单号"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getOrderNoFilterStyle(filter.orderNo, orderNoLabelVisible)"
        :input-style="getFilterInputStyle(filter.orderNo)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span v-if="filter.orderNo && orderNoLabelVisible" :style="{ color: ACTIVE_FILTER_COLOR }">
            订单号：
          </span>
        </template>
      </el-input>
      <el-input
        v-model="filter.skuCode"
        placeholder="SKU编号"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getSkuCodeFilterStyle(filter.skuCode, skuCodeLabelVisible)"
        :input-style="getFilterInputStyle(filter.skuCode)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span v-if="filter.skuCode && skuCodeLabelVisible" :style="{ color: ACTIVE_FILTER_COLOR }">
            SKU编号：
          </span>
        </template>
      </el-input>
      <div
        class="filter-bar-item filter-date-box"
        :class="{ 'is-active': completedRange }"
        :style="getFilterRangeStyle(completedRange, '完成时间')"
      >
        <span v-if="completedRange" class="filter-date-label-text" :style="{ color: ACTIVE_FILTER_COLOR }">完成时间：</span>
        <el-date-picker
          v-model="completedRange"
          type="daterange"
          :name="['sewingCompletedDateStart', 'sewingCompletedDateEnd']"
          :range-separator="completedRange ? '~' : ''"
          start-placeholder="完成时间"
          end-placeholder=""
          value-format="YYYY-MM-DD"
          :shortcuts="rangeShortcuts"
          unlink-panels
          clearable
          size="large"
          :class="['filter-range', { 'range-single': !completedRange }]"
          @change="onSearch"
        />
      </div>
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button size="large" :loading="exporting" @click="onExport">导出表格</el-button>
        <el-button v-if="hasSelection && canAssignSelection && canAssignSewingAction" type="primary" size="large" @click="openAssignDialog">
          分单
        </el-button>
        <el-button
          v-if="hasSelection && canAssignCompletedSelection && canAssignSewingAction"
          type="primary"
          size="large"
          @click="openAssignDialog"
        >
          补录分单
        </el-button>
        <el-button v-if="hasSelection && canRegisterSelection && canCompleteSewingAction" type="primary" size="large" @click="openRegisterDialog">
          登记车缝完成
        </el-button>
      </div>
    </div>

    <div v-if="hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <div ref="tableShellRef" class="list-page-table-shell">
      <SewingTable
        ref="sewingTableRef"
        :list="list"
        :loading="loading"
        :table-height="tableHeight"
        :compact-row-style="compactRowStyle"
        :compact-cell-style="compactCellStyle"
        :compact-header-cell-style="compactHeaderCellStyle"
        :compact-image-size="compactImageSize"
        :compact-image-column-min-width="compactImageColumnMinWidth"
        :size-breakdown-cache="sizeBreakdownCache"
        :size-popover-loading-id="sizePopoverLoadingId"
        :qty-popover-blocks="qtyPopoverBlocks"
        :qty-popover-width="qtyPopoverWidth"
        @header-dragend="onHeaderDragEnd"
        @selection-change="onSelectionChange"
        @show-qty-popover="onShowQtyPopover"
        @open-detail="openSewingBriefDrawer"
      />
    </div>

    <AppPaginationBar
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :total-quantity="totalQuantity"
      summary-label="订单数量合计"
      unit="件"
      :page-sizes="[20, 50, 100]"
      @current-change="load"
      @size-change="onPageSizeChange"
    />

    <SewingAssignDialog
      ref="assignDialogComp"
      :dialog="assignDialog"
      :form="assignForm"
      :rules="assignRules"
      :factory-suppliers="factorySuppliers"
      @update:dialog="assignDialog.visible = $event.visible"
      @close="resetAssignForm"
      @submit="submitAssign"
    />

    <SewingRegisterDialog
      ref="registerDialogComp"
      :dialog="registerDialog"
      :form="registerForm"
      :rules="registerRules"
      :complete-loading="registerFormCompleteLoading"
      :size-table-rows="registerSizeTableRows"
      :sewing-total="registerSewingTotal"
      @update:dialog="registerDialog.visible = $event.visible"
      @close="resetRegisterForm"
      @submit="submitRegister"
    />

    <SewingDetailDrawer
      :drawer="sewingBriefDrawer"
      :logs="sewingDrawerLogs"
      :brief-from-row="sewingBriefFromRow"
      @update:drawer="sewingBriefDrawer.row = $event.row; sewingBriefDrawer.visible = $event.visible"
      @closed="sewingBriefDrawer.row = null"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, onMounted, ref, watch, watchEffect } from 'vue'
import { type SewingListItem } from '@/api/production-sewing'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getFilterRangeStyle,
  getSkuCodeFilterStyle,
} from '@/composables/useFilterBarHelpers'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { useSewingList } from '@/composables/useSewingList'
import { useSewingDialogs } from '@/composables/useSewingDialogs'
import { fetchOrderOperationLogs, toLogSectionItems } from '@/api/operation-logs'
import SewingTable from '@/components/production/SewingTable.vue'
import SewingAssignDialog from '@/components/production/SewingAssignDialog.vue'
import SewingRegisterDialog from '@/components/production/SewingRegisterDialog.vue'
import SewingDetailDrawer from '@/components/production/SewingDetailDrawer.vue'
import type { ProductionOrderBriefModel } from '@/components/production/ProductionOrderBriefPanel.vue'
import { useAuthStore } from '@/stores/auth'
import AppPaginationBar from '@/components/AppPaginationBar.vue'
import type { FormInstance } from 'element-plus'

const authStore = useAuthStore()
const canAssignSewingAction = computed(() => authStore.hasPermission('production_sewing_assign'))
const canCompleteSewingAction = computed(() => authStore.hasPermission('production_sewing_complete'))

const {
  SEWING_TABS,
  filter,
  completedRange,
  orderNoLabelVisible,
  skuCodeLabelVisible,
  currentTab,
  list,
  loading,
  exporting,
  pagination,
  totalQuantity,
  selectedRows,
  hasSelection,
  canAssignSelection,
  canAssignCompletedSelection,
  canRegisterSelection,
  tableShellRef,
  tableHeight,
  compactHeaderCellStyle,
  compactCellStyle,
  compactRowStyle,
  compactImageSize,
  compactImageColumnMinWidth,
  sewingTableRef,
  sizeBreakdownCache,
  sizePopoverLoadingId,
  onHeaderDragEnd,
  qtyPopoverBlocks,
  qtyPopoverWidth,
  getTabLabel,
  load,
  loadTabCounts,
  refreshAfterMutation,
  onExport,
  onShowQtyPopover,
  onSearch,
  debouncedSearch,
  onReset,
  onTabChange,
  onPageSizeChange,
  onSelectionChange,
} = useSewingList()

const {
  factorySuppliers,
  assignDialog,
  assignFormRef,
  assignForm,
  assignRules,
  registerDialog,
  registerFormCompleteLoading,
  registerFormRef,
  registerForm,
  registerSizeTableRows,
  registerSewingTotal,
  registerRules,
  loadFactorySuppliers,
  openAssignDialog,
  resetAssignForm,
  submitAssign,
  openRegisterDialog,
  resetRegisterForm,
  submitRegister,
} = useSewingDialogs(selectedRows, refreshAfterMutation)

// Sync form refs exposed by dialog components back to composable refs.
// Each dialog exposes { formRef: Ref<FormInstance | undefined> }; access .value to get the instance.
const assignDialogComp = ref<{ formRef: { value: FormInstance | undefined } } | null>(null)
const registerDialogComp = ref<{ formRef: { value: FormInstance | undefined } } | null>(null)

watchEffect(() => {
  assignFormRef.value = assignDialogComp.value?.formRef?.value
  registerFormRef.value = registerDialogComp.value?.formRef?.value
})

const sewingBriefDrawer = reactive<{ visible: boolean; row: SewingListItem | null }>({
  visible: false,
  row: null,
})

function openSewingBriefDrawer(row: SewingListItem) {
  sewingBriefDrawer.row = row
  sewingBriefDrawer.visible = true
}

const sewingDrawerLogs = ref<ReturnType<typeof toLogSectionItems>>([])

async function loadSewingDrawerLogs(row: SewingListItem | null) {
  if (!row) {
    sewingDrawerLogs.value = []
    return
  }
  const logs = await fetchOrderOperationLogs(row.orderId, { module: 'production_sewing' })
  sewingDrawerLogs.value = toLogSectionItems(logs)
}

watch(
  () => sewingBriefDrawer.row,
  (row) => {
    void loadSewingDrawerLogs(row)
  },
)

function sewingBriefFromRow(row: SewingListItem): ProductionOrderBriefModel {
  return {
    orderNo: row.orderNo,
    skuCode: row.skuCode,
    imageUrl: row.imageUrl,
    customerName: row.customerName,
    merchandiser: row.merchandiser,
    customerDueDate: row.customerDueDate,
    orderQuantity: row.quantity,
  }
}

onMounted(() => {
  void loadFactorySuppliers()
  void (async () => {
    await load()
    await loadTabCounts()
  })()
})
</script>

<style scoped>
.sewing-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
}

.status-tabs {
  display: flex;
  align-items: center;
  margin-bottom: var(--space-md);
}

.status-tabs-left {
  flex-shrink: 0;
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>

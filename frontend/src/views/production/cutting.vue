<template>
  <div class="page-card page-card--fill cutting-page">
    <!-- Tab：全部 / 等待裁床 / 裁床完成 -->
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" @change="onTabChange">
          <el-radio-button
            v-for="tab in CUTTING_TABS"
            :key="tab.value"
            :value="tab.value"
          >
            {{ getTabLabel(tab) }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 筛选区 -->
    <div class="filter-bar">
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
      <div
        class="filter-bar-item filter-date-box"
        :class="{ 'is-active': completedRange }"
        :style="getFilterRangeStyle(completedRange, '完成时间')"
      >
        <span v-if="completedRange" class="filter-date-label-text" :style="{ color: ACTIVE_FILTER_COLOR }">完成时间：</span>
        <el-date-picker
          v-model="completedRange"
          type="daterange"
          :name="['cuttingCompletedDateStart', 'cuttingCompletedDateEnd']"
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
      <div class="filter-bar-actions">
        <el-button type="primary" @click="onSearch(true)">搜索</el-button>
        <el-button @click="onReset">清空</el-button>
        <el-button :loading="exporting" @click="onExport">导出表格</el-button>
        <el-button
          v-if="hasSelection && canRegisterSelection && canCompleteCuttingAction"
          type="primary"
          @click="openRegisterDialog"
        >
          裁床登记
        </el-button>
      </div>
    </div>

    <div v-if="hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <div ref="tableShellRef" class="list-page-table-shell">
      <CuttingTable
        :loading="loading"
        :list="list"
        :current-tab="currentTab"
        :table-height="tableHeight"
        :compact-header-cell-style="compactHeaderCellStyle"
        :compact-cell-style="compactCellStyle"
        :compact-row-style="compactRowStyle"
        :compact-image-size="compactImageSize"
        :compact-image-column-min-width="compactImageColumnMinWidth"
        :size-breakdown-cache="sizeBreakdownCache"
        :size-popover-loading-id="sizePopoverLoadingId"
        :qty-popover-width="qtyPopoverWidth"
        :qty-popover-blocks="qtyPopoverBlocks"
        @selection-change="onSelectionChange"
        @show-qty-popover="onShowQtyPopover"
        @open-detail="openCuttingDetailDrawer"
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

    <CuttingRegisterDialog
      :dialog="registerDialog"
      :form="registerForm"
      :self-department-label="SELF_DEPARTMENT_LABEL"
      :cutting-department-options="cuttingDepartmentOptions"
      :is-self-cutting="isSelfCutting"
      :cutter-options="cutterOptions"
      :actual-cut-grand-total="actualCutGrandTotal"
      :cutting-unit-price-num="cuttingUnitPriceNum"
      :cutting-total-cost-display="cuttingTotalCostDisplay"
      :fabric-net-grand-total="fabricNetGrandTotal"
      :format-fabric-grand="formatFabricGrand"
      @update:dialog="registerDialog.visible = $event.visible"
      @update:cutting-unit-price-num="cuttingUnitPriceNum = $event"
      @close="resetRegisterForm"
      @submit="submitRegister"
      @department-change="onCuttingDepartmentChange"
    />

    <CuttingDetailDrawer
      :drawer="detailDrawer"
      :detail-payload="detailPayload"
      :detail-grand-pieces="detailGrandPieces"
      :logs="cuttingDrawerLogs"
      :brief-from-row="cuttingBriefFromRow"
      :display-dash="displayDash"
      :money-display="moneyDisplay"
      :fabric-meters-display="fabricMetersDisplay"
      @update:drawer="detailDrawer.visible = $event.visible"
      @closed="onDetailDrawerClosed"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { type CuttingListItem } from '@/api/production-cutting'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getFilterRangeStyle,
  getSkuCodeFilterStyle,
} from '@/composables/useFilterBarHelpers'
import { useCuttingListData } from '@/composables/useCuttingListData'
import { useCuttingSelection } from '@/composables/useCuttingSelection'
import { useCuttingSizePopover } from '@/composables/useCuttingSizePopover'
import { useCuttingDetail } from '@/composables/useCuttingDetail'
import { useCuttingRegister } from '@/composables/useCuttingRegister'
import { fetchOrderOperationLogs, toLogSectionItems } from '@/api/operation-logs'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import CuttingTable from '@/components/production/CuttingTable.vue'
import CuttingRegisterDialog from '@/components/production/CuttingRegisterDialog.vue'
import CuttingDetailDrawer from '@/components/production/CuttingDetailDrawer.vue'
import { useAuthStore } from '@/stores/auth'
import AppPaginationBar from '@/components/AppPaginationBar.vue'

const authStore = useAuthStore()
const canCompleteCuttingAction = computed(() => authStore.hasPermission('production_cutting_complete'))

const CUTTING_TABS = [
  { label: '全部', value: 'all' },
  { label: '等待裁床', value: 'pending' },
  { label: '裁床完成', value: 'completed' },
] as const

type CuttingTabConfig = (typeof CUTTING_TABS)[number]

const tableShellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(tableShellRef)
const {
  compactHeaderCellStyle,
  compactCellStyle,
  compactRowStyle,
  compactImageSize,
  compactImageColumnMinWidth,
} = useCompactTableStyle()
const {
  selectedRows,
  hasSelection,
  canRegisterSelection,
  onSelectionChange,
  clearSelection,
} = useCuttingSelection()
const {
  filter,
  completedRange,
  orderNoLabelVisible,
  skuCodeLabelVisible,
  currentTab,
  tabCounts,
  tabTotal,
  list,
  loading,
  exporting,
  pagination,
  totalQuantity,
  load,
  loadTabCounts,
  onExport,
  onSearch,
  debouncedSearch,
  onReset,
  onTabChange,
  onPageSizeChange,
} = useCuttingListData({
  tabs: CUTTING_TABS,
  clearSelection,
})
const {
  sizeBreakdownCache,
  sizePopoverLoadingId,
  qtyPopoverBlocks,
  qtyPopoverWidth,
  onShowQtyPopover,
} = useCuttingSizePopover()
const {
  detailDrawer,
  detailPayload,
  cuttingBriefFromRow,
  detailGrandPieces,
  onDetailDrawerClosed,
  displayDash,
  moneyDisplay,
  fabricMetersDisplay,
  openCuttingDetailDrawer,
} = useCuttingDetail()
const {
  SELF_DEPARTMENT_LABEL,
  registerDialog,
  registerForm,
  cuttingDepartmentOptions,
  isSelfCutting,
  cutterOptions,
  actualCutGrandTotal,
  cuttingUnitPriceNum,
  cuttingTotalCostDisplay,
  fabricNetGrandTotal,
  formatFabricGrand,
  openRegisterDialog,
  resetRegisterForm,
  submitRegister,
  loadCuttingDepartments,
  loadCutterOptions,
  onCuttingDepartmentChange,
} = useCuttingRegister({
  selectedRows,
  reloadList: load,
  reloadTabCounts: loadTabCounts,
})

const cuttingDrawerLogs = ref<ReturnType<typeof toLogSectionItems>>([])

async function loadCuttingDrawerLogs(row: CuttingListItem | null) {
  if (!row) {
    cuttingDrawerLogs.value = []
    return
  }
  const logs = await fetchOrderOperationLogs(row.orderId, { module: 'production_cutting' })
  cuttingDrawerLogs.value = toLogSectionItems(logs)
}

watch(
  () => detailDrawer.row,
  (row) => {
    void loadCuttingDrawerLogs(row)
  },
)

function getTabLabel(tab: CuttingTabConfig): string {
  const counts = tabCounts.value
  const count = tab.value === 'all' ? tabTotal.value : counts[tab.value] ?? 0
  return `${tab.label}(${count})`
}

onMounted(() => {
  void loadCuttingDepartments()
  void loadCutterOptions()
  void (async () => {
    await load()
    await loadTabCounts()
  })()
})
</script>

<style scoped>
.cutting-page {
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

<template>
  <div class="page-card page-card--fill finishing-page">
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" @change="onTabChange">
          <el-radio-button
            v-for="tab in FINISHING_TABS"
            :key="tab.value"
            :value="tab.value"
          >
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
          :name="['finishingCompletedDateStart', 'finishingCompletedDateEnd']"
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
          v-if="hasSelection && canRegisterReceiveSelection && canRegisterReceiveAction"
          type="primary"
          @click="openReceiveDialog"
        >
          登记收货
        </el-button>
        <el-button
          v-if="hasSelection && canPackagingCompleteSelection && canPackagingAction"
          type="primary"
          @click="openPackagingCompleteDialog"
        >
          登记入库
        </el-button>
        <el-button
          v-if="hasSelection && canAmendPackagingSelection && canPackagingAction"
          type="primary"
          @click="openPackagingAmendDialog"
        >
          修改入库/次品
        </el-button>
      </div>
    </div>

    <div v-if="hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <div ref="tableShellRef" class="list-page-table-shell">
      <FinishingTable
        :loading="loading"
        :list="list"
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
        @open-detail="openFinishingBriefDrawer"
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

    <FinishingDetailDrawer
      v-model="finishingBriefDrawer.visible"
      :row="finishingBriefDrawer.row"
      :brief="finishingBriefDrawer.row ? finishingBriefFromRow(finishingBriefDrawer.row) : emptyBrief"
      :logs="finishingDrawerLogs"
      @closed="finishingBriefDrawer.row = null"
    />

    <FinishingReceiveDialog
      v-model="receiveDialog.visible"
      :dialog="receiveDialog"
      :size-table-rows="receiveSizeTableRows"
      :tail-total="receiveTailReceivedTotal"
      @close="resetReceiveForm"
      @submit="submitReceive"
    />

    <FinishingPackagingDialog
      v-model="packagingCompleteDialog.visible"
      :dialog="packagingCompleteDialog"
      :packaging-size-table-rows="packagingSizeTableRows"
      :defect-total="defectTotal"
      :already-inbound-qty="alreadyInboundQty"
      :remaining-qty="remainingQty"
      :max-packaging-qty-for-size="maxPackagingQtyForSize"
      :max-defect-qty-for-size="maxDefectQtyForSize"
      @close="resetPackagingCompleteDialog"
      @submit="submitPackagingComplete"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { type FinishingListItem } from '@/api/production-finishing'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getFilterRangeStyle,
  getSkuCodeFilterStyle,
} from '@/composables/useFilterBarHelpers'
import { useFinishingListData } from '@/composables/useFinishingListData'
import { useFinishingSelection } from '@/composables/useFinishingSelection'
import { useFinishingSizePopover } from '@/composables/useFinishingSizePopover'
import { useFinishingReceive } from '@/composables/useFinishingReceive'
import { useFinishingPackaging } from '@/composables/useFinishingPackaging'
import { fetchOrderOperationLogs, toLogSectionItems } from '@/api/operation-logs'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { useAuthStore } from '@/stores/auth'
import type { ProductionOrderBriefModel } from '@/components/production/ProductionOrderBriefPanel.vue'
import FinishingTable from '@/components/production/FinishingTable.vue'
import FinishingDetailDrawer from '@/components/production/FinishingDetailDrawer.vue'
import FinishingReceiveDialog from '@/components/production/FinishingReceiveDialog.vue'
import FinishingPackagingDialog from '@/components/production/FinishingPackagingDialog.vue'
import AppPaginationBar from '@/components/AppPaginationBar.vue'

const authStore = useAuthStore()
const canRegisterReceiveAction = computed(() => authStore.hasPermission('production_finishing_receive'))
const canPackagingAction = computed(() => authStore.hasPermission('production_finishing_packaging'))

const FINISHING_TABS = [
  { label: '全部', value: 'all' },
  { label: '待尾部', value: 'pending_receive' },
  { label: '尾部中', value: 'pending_assign' },
  { label: '尾部完成', value: 'inbound' },
] as const

type FinishingTabConfig = (typeof FINISHING_TABS)[number]

const emptyBrief: ProductionOrderBriefModel = {
  orderNo: '',
  skuCode: '',
  imageUrl: '',
  customerName: '',
  merchandiser: '',
  customerDueDate: '',
  orderQuantity: 0,
}

const finishingBriefDrawer = reactive<{ visible: boolean; row: FinishingListItem | null }>({
  visible: false,
  row: null,
})

function openFinishingBriefDrawer(row: FinishingListItem) {
  finishingBriefDrawer.row = row
  finishingBriefDrawer.visible = true
}

const finishingDrawerLogs = ref<ReturnType<typeof toLogSectionItems>>([])

async function loadFinishingDrawerLogs(row: FinishingListItem | null) {
  if (!row) {
    finishingDrawerLogs.value = []
    return
  }
  const logs = await fetchOrderOperationLogs(row.orderId, { module: 'production_finishing' })
  finishingDrawerLogs.value = toLogSectionItems(logs)
}

watch(
  () => finishingBriefDrawer.row,
  (row) => { void loadFinishingDrawerLogs(row) },
)

function finishingBriefFromRow(row: FinishingListItem): ProductionOrderBriefModel {
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
  canRegisterReceiveSelection,
  canPackagingCompleteSelection,
  canAmendPackagingSelection,
  onSelectionChange,
  clearSelection,
} = useFinishingSelection()
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
  loadTabCounts,
  load,
  onExport,
  onSearch,
  debouncedSearch,
  onReset,
  onTabChange,
  onPageSizeChange,
} = useFinishingListData({
  tabs: FINISHING_TABS,
  clearSelection,
})
const {
  sizeBreakdownCache,
  sizePopoverLoadingId,
  qtyPopoverBlocks,
  qtyPopoverWidth,
  onShowQtyPopover,
} = useFinishingSizePopover()

function getTabLabel(tab: FinishingTabConfig): string {
  const counts = tabCounts.value
  const count = tab.value === 'all' ? tabTotal.value : counts[tab.value] ?? 0
  return `${tab.label}(${count})`
}

const {
  receiveDialog,
  receiveSizeTableRows,
  receiveTailReceivedTotal,
  resetReceiveForm,
  openReceiveDialog,
  submitReceive,
} = useFinishingReceive({
  selectedRows,
  reloadList: load,
  reloadTabCounts: loadTabCounts,
})

const {
  packagingCompleteDialog,
  resetPackagingCompleteDialog,
  packagingSizeTableRows,
  defectTotal,
  maxPackagingQtyForSize,
  maxDefectQtyForSize,
  alreadyInboundQty,
  remainingQty,
  openPackagingCompleteDialog,
  openPackagingAmendDialog,
  submitPackagingComplete,
} = useFinishingPackaging({
  selectedRows,
  reloadList: load,
  reloadTabCounts: loadTabCounts,
})

onMounted(() => {
  void (async () => {
    await load()
    await loadTabCounts()
  })()
})
</script>

<style scoped src="./finishing.css"></style>

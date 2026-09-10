<template>
  <div class="page-card page-card--fill inventory-pending-page">
    <el-tabs v-model="pageTab" class="inventory-tabs" @tab-change="onPageTabChange">
      <el-tab-pane label="待处理" name="pending" />
      <el-tab-pane label="已发货" name="shipped" />
    </el-tabs>

    <el-form class="filter-bar" @submit.prevent>
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
      <div class="filter-bar-actions">
        <el-button type="primary" @click="onSearch(true)">搜索</el-button>
        <el-button @click="onReset">清空</el-button>
        <el-button
          v-if="pageTab === 'pending'"
          :disabled="!hasSelection || loading"
          type="primary"
          :loading="inboundLoading"
          @click="openInboundDialog"
        >
          入库
        </el-button>
        <el-button
          v-if="pageTab === 'pending'"
          :disabled="!canOutboundSelection || loading"
          type="warning"
          :loading="outboundDialog.submitting"
          @click="openOutboundDialog"
        >
          发货
        </el-button>
      </div>
    </el-form>

    <div v-if="pageTab === 'pending' && hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项，共 {{ formatDisplayNumber(selectedQuantity) }} 件<span v-if="!canOutboundSelection">；次品仅支持入库，不支持直接发货</span></div>

    <div ref="tableShellRef" class="list-page-table-shell">
    <el-table
      ref="pendingTableRef"
      v-loading="loading"
      :data="list"
      row-key="id"
      border
      stripe
      class="pending-table"
      :height="tableHeight"
      :row-style="compactRowStyle"
      :cell-style="compactCellStyle"
      :header-cell-style="compactHeaderCellStyle"
      @header-dragend="onPendingHeaderDragEnd"
      @selection-change="onSelectionChange"
    >
      <el-table-column v-if="pageTab === 'pending'" type="selection" width="48" align="center" />
      <el-table-column prop="orderNo" label="订单号" min-width="120" show-overflow-tooltip />
      <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip />
      <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip />
      <el-table-column label="图片" :width="compactImageColumnMinWidth" align="center">
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
      <el-table-column :label="pageTab === 'pending' ? '待处理数量' : '已发货数量'" width="140" align="right">
        <template #default="{ row }">
          <PendingQuantityCell :row="row" :shipped="pageTab === 'shipped'" />
        </template>
      </el-table-column>
      <el-table-column :label="pageTab === 'pending' ? '完成时间' : '发货时间'" prop="createdAt" width="160" align="center" />
      <el-table-column v-if="pageTab === 'shipped'" prop="pickupUserName" label="领取人/收货人" width="140" show-overflow-tooltip />
      <el-table-column v-if="pageTab === 'shipped'" prop="operatorUsername" label="操作人" width="120" show-overflow-tooltip />
      <el-table-column v-if="pageTab === 'shipped'" prop="remark" label="备注" min-width="140" show-overflow-tooltip />
    </el-table>
    </div>

    <AppPaginationBar
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :total-quantity="totalPageQuantity"
      unit="件"
      summary-label="本页件数"
      @current-change="load"
      @size-change="onPageSizeChange"
    />

    <PendingInboundDialog
      v-model:visible="inboundDialog.visible"
      :submitting="inboundDialog.submitting"
      :preview-items="inboundPreviewItems"
      :form="inboundForm"
      :rules="inboundRules"
      :department-options="departmentOptions"
      :inventory-type-options="inventoryTypeOptions"
      :warehouse-options="warehouseOptions"
      :format-display-number="formatDisplayNumber"
      :to-preview-table-rows="toInboundPreviewTableRows"
      :get-preview-row-total="getInboundPreviewRowTotal"
      @close="resetInboundForm"
      @submit="submitInbound"
    />

    <PendingOutboundDialog
      v-model:visible="outboundDialog.visible"
      :submitting="outboundDialog.submitting"
      :items="outboundDialog.items"
      :form="outboundForm"
      :rules="outboundRules"
      :pickup-user-options="pickupUserOptions"
      :outbound-selected-customer="outboundSelectedCustomer"
      :outbound-grand-total="outboundGrandTotal"
      :format-display-number="formatDisplayNumber"
      :get-outbound-row-total="getOutboundRowTotal"
      :get-outbound-item-total="getOutboundItemTotal"
      :get-outbound-table-summaries="getOutboundTableSummaries"
      @close="resetOutboundForm"
      @submit="submitOutbound"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getPendingList,
  type PendingListItem,
} from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
} from '@/composables/useFilterBarHelpers'
import { formatDisplayNumber } from '@/utils/display-number'
import PendingQuantityCell from '@/components/inventory/pending/PendingQuantityCell.vue'
import PendingInboundDialog from '@/components/inventory/pending/PendingInboundDialog.vue'
import PendingOutboundDialog from '@/components/inventory/pending/PendingOutboundDialog.vue'
import AppPaginationBar from '@/components/AppPaginationBar.vue'
import { useInventoryPendingDialogs } from '@/composables/useInventoryPendingDialogs'

const filter = reactive({ orderNo: '', skuCode: '' })
const pageTab = ref<'pending' | 'shipped'>('pending')
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)
const list = ref<PendingListItem[]>([])
const pendingTableRef = ref()
const tableShellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(tableShellRef)
const {
  compactHeaderCellStyle,
  compactCellStyle,
  compactRowStyle,
  compactImageSize,
  compactImageColumnMinWidth,
} = useCompactTableStyle()
const loading = ref(false)
const inboundLoading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<PendingListItem[]>([])
const hasSelection = computed(() => selectedRows.value.length > 0)
const selectedQuantity = computed(() => selectedRows.value.reduce((sum, row) => sum + Number(row.quantity), 0))
const totalPageQuantity = computed(() => list.value.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0))
const canOutboundSelection = computed(
  () => pageTab.value === 'pending' && selectedRows.value.length > 0 && selectedRows.value.every((r) => r.sourceType !== 'defect'),
)
const { onHeaderDragEnd: onPendingHeaderDragEnd, restoreColumnWidths: restorePendingColumnWidths } =
  useTableColumnWidthPersist('inventory-pending-main')

// 待仓 tooltip 严格只用 inbound_pending.color_size_snapshot（这一批登记时填的真值）。
// snapshot 缺失（老数据 byColor 未存）就显示"本批未留存颜色×尺码明细"，不再回退到
// 订单累计/订单计划，避免显示跟用户本批实际填写不符的数据。

const {
  inboundDialog,
  inboundForm,
  inboundRules,
  inboundPreviewItems,
  warehouseOptions,
  inventoryTypeOptions,
  departmentOptions,
  outboundDialog,
  outboundForm,
  outboundRules,
  pickupUserOptions,
  outboundSelectedCustomer,
  outboundGrandTotal,
  openInboundDialog,
  resetInboundForm,
  submitInbound,
  openOutboundDialog,
  resetOutboundForm,
  submitOutbound,
  getOutboundItemTotal,
  getOutboundRowTotal,
  getOutboundTableSummaries,
  toInboundPreviewTableRows,
  getInboundPreviewRowTotal,
  loadDialogOptions,
} = useInventoryPendingDialogs({
  selectedRows,
  pageTab,
  load,
})

let loadVersion = 0
async function load() {
  const version = ++loadVersion
  selectedRows.value = []
  pendingTableRef.value?.clearSelection()
  loading.value = true
  try {
    const res = await getPendingList({
      tab: pageTab.value,
      orderNo: filter.orderNo || undefined,
      skuCode: filter.skuCode || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    if (version !== loadVersion) return
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      restorePendingColumnWidths(pendingTableRef.value)
    }
  } catch (e: unknown) {
    if (version !== loadVersion) return
    list.value = []
    pagination.total = 0
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

function onSearch(byUser = false) {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = null
  if (byUser) {
    if (filter.orderNo && String(filter.orderNo).trim()) orderNoLabelVisible.value = true
    if (filter.skuCode && String(filter.skuCode).trim()) skuCodeLabelVisible.value = true
  }
  pagination.page = 1
  load()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    onSearch(false)
  }, 400)
}

function onReset() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = null
  orderNoLabelVisible.value = false
  skuCodeLabelVisible.value = false
  filter.orderNo = ''
  filter.skuCode = ''
  pagination.page = 1
  selectedRows.value = []
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function onSelectionChange(rows: PendingListItem[]) {
  if (pageTab.value !== 'pending') return
  selectedRows.value = rows
}

function onPageTabChange() {
  selectedRows.value = []
  pagination.page = 1
  load()
}

onMounted(() => {
  void loadDialogOptions()
  void load()
})
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
  loadVersion++
})
</script>

<style scoped>
.inventory-pending-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
}

.inventory-pending-page .pending-table {
  flex: 1;
  min-height: 0;
}

.pending-table :deep(.cell) {
  padding-left: 6px;
  padding-right: 6px;
  line-height: 20px;
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-body);
}

</style>

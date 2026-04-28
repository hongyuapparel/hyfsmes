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
        size="large"
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
        placeholder="SKU"
        clearable
        size="large"
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
            SKU：
          </span>
        </template>
      </el-input>
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button
          v-if="pageTab === 'pending' && hasSelection"
          type="primary"
          size="large"
          :loading="inboundLoading"
          @click="openInboundDialog"
        >
          入库
        </el-button>
        <el-button
          v-if="pageTab === 'pending' && canOutboundSelection"
          type="warning"
          size="large"
          :loading="outboundDialog.submitting"
          @click="openOutboundDialog"
        >
          发货
        </el-button>
      </div>
    </el-form>

    <div v-if="pageTab === 'pending' && hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <div ref="tableShellRef" class="list-page-table-shell">
    <el-table
      ref="pendingTableRef"
      v-loading="loading"
      :data="list"
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
          <el-tooltip
            v-if="pageTab === 'pending'"
            placement="top"
            effect="light"
            :show-after="250"
            :hide-after="0"
            :disabled="!row.orderId"
            popper-class="pending-qty-popper"
            @show="ensureColorSizeBreakdown(row.orderId)"
          >
            <template #content>
              <div class="qty-tooltip">
                <template v-if="colorSizeCache[row.orderId]?.loading">
                  <div class="qty-tooltip-loading">加载中...</div>
                </template>
                <template v-else-if="colorSizeCache[row.orderId]?.error">
                  <div class="qty-tooltip-error">明细加载失败</div>
                </template>
                <template v-else>
                  <div v-if="(colorSizeCache[row.orderId]?.headers?.length ?? 0) === 0" class="qty-tooltip-empty">
                    暂无明细
                  </div>
                  <div v-else class="qty-tooltip-grid">
                    <div class="qty-tooltip-row qty-tooltip-head">
                      <div class="qty-tooltip-cell qty-tooltip-color">颜色</div>
                      <div
                        v-for="(h, idx) in colorSizeCache[row.orderId].headers"
                        :key="idx"
                        class="qty-tooltip-cell"
                      >
                        {{ h }}
                      </div>
                    </div>
                    <div
                      v-for="(r, rIdx) in colorSizeCache[row.orderId].rows"
                      :key="rIdx"
                      class="qty-tooltip-row"
                    >
                      <div class="qty-tooltip-cell qty-tooltip-color">{{ r.colorName || '-' }}</div>
                      <div
                        v-for="(v, vIdx) in r.values"
                        :key="vIdx"
                        class="qty-tooltip-cell qty-tooltip-num"
                      >
                        {{ formatDisplayNumber(v) }}
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </template>
            <span class="qty-inline">
              <span class="qty-hover">{{ formatDisplayNumber(row.quantity) }}</span>
              <el-tag v-if="row.sourceType === 'defect'" type="danger" size="small" effect="light" class="defect-tag">
                次品
              </el-tag>
            </span>
          </el-tooltip>
          <span v-else>{{ formatDisplayNumber(row.quantity) }}</span>
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
      summary-label="总件数"
      @current-change="load"
      @size-change="onPageSizeChange"
    />

    <PendingInboundDialog
      v-model:visible="inboundDialog.visible"
      :submitting="inboundDialog.submitting"
      :preview-items="inboundPreviewItems"
      :form-ref="inboundFormRef"
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
      :form-ref="outboundFormRef"
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
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getPendingList,
  type PendingListItem,
} from '@/api/inventory'
import { getOrderColorSizeBreakdown, type OrderColorSizeBreakdownRes } from '@/api/orders'
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
const totalPageQuantity = computed(() => list.value.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0))
const canOutboundSelection = computed(
  () => pageTab.value === 'pending' && selectedRows.value.length > 0 && selectedRows.value.every((r) => r.sourceType !== 'defect'),
)
const { onHeaderDragEnd: onPendingHeaderDragEnd, restoreColumnWidths: restorePendingColumnWidths } =
  useTableColumnWidthPersist('inventory-pending-main')

const colorSizeCache = reactive<Record<
  number,
  {
    loading: boolean
    error: boolean
    headers: string[]
    rows: Array<{ colorName: string; values: number[] }>
  }
>>({})

const {
  inboundDialog,
  inboundFormRef,
  inboundForm,
  inboundRules,
  inboundPreviewItems,
  warehouseOptions,
  inventoryTypeOptions,
  departmentOptions,
  outboundDialog,
  outboundFormRef,
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
  ensureColorSizeBreakdown,
  colorSizeCache,
})

async function ensureColorSizeBreakdown(orderId: number) {
  if (!orderId) return
  const existing = colorSizeCache[orderId]
  if (existing && (existing.loading || existing.headers.length > 0 || existing.error)) return
  colorSizeCache[orderId] = { loading: true, error: false, headers: [], rows: [] }
  try {
    const res = await getOrderColorSizeBreakdown(orderId)
    const data = (res.data ?? { headers: [], rows: [] }) as OrderColorSizeBreakdownRes
    colorSizeCache[orderId] = {
      loading: false,
      error: false,
      headers: Array.isArray(data.headers) ? data.headers : [],
      rows: Array.isArray(data.rows) ? data.rows : [],
    }
  } catch {
    colorSizeCache[orderId] = { loading: false, error: true, headers: [], rows: [] }
  }
}

async function load() {
  loading.value = true
  try {
    const res = await getPendingList({
      tab: pageTab.value,
      orderNo: filter.orderNo || undefined,
      skuCode: filter.skuCode || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      restorePendingColumnWidths(pendingTableRef.value)
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function onSearch(byUser = false) {
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

onMounted(async () => {
  await loadDialogOptions()
  await load()
})
</script>

<style scoped>
.qty-hover {
  cursor: help;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}

.qty-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.defect-tag {
  transform: scale(0.92);
  transform-origin: right center;
}

.qty-tooltip {
  max-width: 520px;
}

.qty-tooltip-loading,
.qty-tooltip-error,
.qty-tooltip-empty {
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1.4;
}

.qty-tooltip-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.qty-tooltip-row {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(44px, auto);
  align-items: center;
  gap: 2px;
}

.qty-tooltip-cell {
  padding: 4px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.12);
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
}

.qty-tooltip-head .qty-tooltip-cell {
  background: rgba(255, 255, 255, 0.18);
  font-weight: 600;
}

.qty-tooltip-color {
  min-width: 72px;
  text-align: center;
}

.qty-tooltip-num {
  text-align: center;
}

</style>

<style>
/* tooltip 弹层在 body 下，需用全局样式；通过 popper-class 精确作用范围 */
.pending-qty-popper {
  padding: 0;
}

.pending-qty-popper .el-popper__arrow::before {
  border: 1px solid var(--el-border-color-lighter);
}

.pending-qty-popper .qty-tooltip {
  padding: 10px 12px;
}

.pending-qty-popper .qty-tooltip-cell {
  background: #f5f6f8;
  color: var(--el-text-color-regular);
  border: 1px solid var(--el-border-color-lighter);
  text-align: center;
}

.pending-qty-popper .qty-tooltip-head .qty-tooltip-cell {
  background: #eef1f6;
  font-weight: 600;
}

</style>

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
  font-size: 13px;
}

</style>

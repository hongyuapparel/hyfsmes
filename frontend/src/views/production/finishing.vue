<template>
  <div class="page-card page-card--fill finishing-page">
    <!-- Tab：全部 / 尾部完成 -->
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
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

    <!-- 筛选区：与订单列表同一设计（订单号、SKU） -->
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
          size="large"
          :class="['filter-range', { 'range-single': !completedRange }]"
          @change="onSearch"
        />
      </div>
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button size="large" :loading="exporting" @click="onExport">导出表格</el-button>
        <el-button
          v-if="hasSelection && canRegisterReceiveSelection && canRegisterReceiveAction"
          type="primary"
          size="large"
          @click="openReceiveDialog"
        >
          登记收货
        </el-button>
        <el-button
          v-if="hasSelection && canPackagingCompleteSelection && canPackagingAction"
          type="primary"
          size="large"
          @click="openPackagingCompleteDialog"
        >
          登记入库
        </el-button>
        <el-button
          v-if="hasSelection && canAmendPackagingSelection && canPackagingAction"
          type="primary"
          size="large"
          @click="openPackagingAmendDialog"
        >
          修改入库/次品
        </el-button>
        <!-- 新流程：尾部不再处理发货/入库/财务审批，交由仓库模块 -->
      </div>
    </div>

    <div v-if="hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <!-- 待尾部订单列表 -->
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

    <ProductionDetailDrawerShell
      v-model="finishingBriefDrawer.visible"
      title="尾部进度概要"
      :size="760"
      :resizable="true"
      @closed="finishingBriefDrawer.row = null"
    >
      <template v-if="finishingBriefDrawer.row">
        <ProductionDetailSection>
          <ProductionOrderBriefPanel :brief="finishingBriefFromRow(finishingBriefDrawer.row)" />
        </ProductionDetailSection>
        <ProductionDetailSection title="业务扩展信息">
          <el-descriptions :column="1" border size="small" class="finishing-brief-extra">
            <el-descriptions-item label="尾部状态">
              {{ finishingBriefDrawer.row.finishingStatus }}
            </el-descriptions-item>
            <el-descriptions-item label="裁床数量">
              {{
                finishingBriefDrawer.row.cutTotal != null
                  ? formatDisplayNumber(finishingBriefDrawer.row.cutTotal)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="车缝数量">
              {{
                finishingBriefDrawer.row.sewingQuantity != null
                  ? formatDisplayNumber(finishingBriefDrawer.row.sewingQuantity)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="尾部收货">
              {{
                finishingBriefDrawer.row.tailReceivedQty != null
                  ? formatDisplayNumber(finishingBriefDrawer.row.tailReceivedQty)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="尾部入库">
              {{
                finishingBriefDrawer.row.tailInboundQty != null
                  ? formatDisplayNumber(finishingBriefDrawer.row.tailInboundQty)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="次品数">
              {{
                finishingBriefDrawer.row.defectQuantity != null
                  ? formatDisplayNumber(finishingBriefDrawer.row.defectQuantity)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="包装备注">
              {{ (finishingBriefDrawer.row.remark ?? '').trim() || '—' }}
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection title="时效与节点">
          <el-descriptions :column="1" border size="small" class="finishing-brief-extra">
            <el-descriptions-item label="到尾部时间">
              {{ formatDateTime(finishingBriefDrawer.row.arrivedAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="完成时间">
              {{ formatDateTime(finishingBriefDrawer.row.completedAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="时效判定">
              <SlaJudgeTag :text="finishingBriefDrawer.row.timeRating" />
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection title="批次记录">
          <BatchTimelineSection
            :order-id="finishingBriefDrawer.row.orderId"
            :active="finishingBriefDrawer.visible"
          />
        </ProductionDetailSection>
        <ProductionDetailSection>
          <OperationLogsSection :logs="finishingDrawerLogs" />
        </ProductionDetailSection>
      </template>
    </ProductionDetailDrawerShell>

    <!-- 登记收货弹窗：待尾部 tab 使用，支持按尺码填写收货数量 -->
    <AppDialog
      v-model="receiveDialog.visible"
      title="登记收货"
      width="720"
      destroy-on-close
      @close="resetReceiveForm"
    >
      <template v-if="receiveDialog.row">
        <div class="register-brief">
          <div>订单号：{{ receiveDialog.row.orderNo }}</div>
          <div>SKU：{{ receiveDialog.row.skuCode }}</div>
        </div>
        <div v-if="receiveDialog.formLoading" class="register-loading">加载尺寸细数...</div>
        <template v-else-if="receiveDialog.headers?.length">
          <div class="register-qty-title">尺寸细数</div>
          <el-table :data="receiveSizeTableRows" border size="small" class="register-qty-table" style="width: 100%">
            <el-table-column prop="label" label="" width="90" align="right" />
            <el-table-column
              v-for="(h, idx) in receiveDialog.headers"
              :key="idx"
              :label="h"
              min-width="100"
              align="center"
            >
              <template #default="{ row }">
                <template v-if="row.key === 'order' || row.key === 'cut' || row.key === 'sewing'">
                  {{ row.values[idx] != null ? formatDisplayNumber(row.values[idx]) : '-' }}
                </template>
                <template v-else-if="row.key === 'tail' && idx === receiveDialog.headers.length - 1 && receiveDialog.headers.length > 1">
                  {{ receiveTailReceivedTotal }}
                </template>
                <template v-else>
                  <el-input-number
                    v-model="receiveDialog.tailReceivedQuantities[idx]"
                    :min="0"
                    :max="receiveDialog.sewingRow[idx] != null ? Number(receiveDialog.sewingRow[idx]) : undefined"
                    :precision="0"
                    controls-position="right"
                    size="small"
                    style="width: 100%"
                  />
                </template>
              </template>
            </el-table-column>
          </el-table>
          <p class="register-qty-sum">尾部收货数合计：{{ receiveTailReceivedTotal }}</p>
        </template>
      </template>
      <template #footer>
        <el-button @click="receiveDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="receiveDialog.submitting" @click="submitReceive">
          确定
        </el-button>
      </template>
    </AppDialog>

    <!-- 登记入库弹窗：支持「部分入库」分批登记 /「全部入库」补齐剩余；amend 模式为覆盖式修正 -->
    <AppDialog
      v-model="packagingCompleteDialog.visible"
      :title="packagingCompleteDialog.mode === 'amend' ? '修改入库/次品' : '登记入库'"
      width="800"
      destroy-on-close
      @close="resetPackagingCompleteDialog"
    >
      <p v-if="packagingCompleteDialog.mode === 'register'" class="dialog-tip">
        可分多次登记。「部分入库」保留在「尾部中」等待下一批；「全部入库」补齐剩余并推进到「尾部完成」。
      </p>
      <p v-else class="dialog-tip">
        在仓库尚未对「待仓处理」记录完成入库或发货前，可修正入库数与次品数；保存后将按新数量重建待仓记录。若待仓已处理，请改走仓库调整流程。
      </p>
      <div v-if="packagingCompleteDialog.formLoading" class="register-loading">加载尺寸细数...</div>
      <template v-else>
        <div
          v-for="(item, itemIdx) in packagingCompleteDialog.items"
          :key="item.row.orderId"
          class="packaging-block"
        >
          <div class="register-brief">
            <div>订单号：{{ item.row.orderNo }}</div>
            <div>SKU：{{ item.row.skuCode }}</div>
            <div>尾部收货数合计：{{ formatDisplayNumber(item.row.tailReceivedQty ?? 0) }}</div>
            <template v-if="packagingCompleteDialog.mode === 'register'">
              <div v-if="alreadyInboundQty(item) > 0">
                已登记入库：{{ formatDisplayNumber(alreadyInboundQty(item)) }}
                <el-tag size="small" type="warning">本次为分批续登</el-tag>
              </div>
              <div>剩余可登记：{{ formatDisplayNumber(remainingQty(item)) }}</div>
            </template>
          </div>
          <template v-if="item.headers?.length">
            <div class="register-qty-title">尾部收货数 / 入库数</div>
            <el-table :data="packagingSizeTableRows(item)" border size="small" class="register-qty-table" style="width: 100%">
              <el-table-column prop="label" label="" width="100" align="right" />
              <el-table-column
                v-for="(h, hIdx) in item.headers"
                :key="hIdx"
                :label="h"
                min-width="90"
                align="center"
              >
                <template #default="{ row }">
                  <template v-if="row.key === 'tail_received'">
                    {{ row.values[hIdx] != null ? formatDisplayNumber(row.values[hIdx]) : '-' }}
                  </template>
                  <template v-else-if="row.key === 'inbound'">
                    <template v-if="item.headers.length > 1 && hIdx === item.headers.length - 1">
                      {{ row.values[hIdx] != null ? formatDisplayNumber(row.values[hIdx]) : formatDisplayNumber(0) }}
                    </template>
                    <el-input-number
                      v-else
                      v-model="item.inboundQuantities[hIdx]"
                      :min="0"
                      :max="maxPackagingQtyForSize(item, hIdx)"
                      :precision="0"
                      controls-position="right"
                      size="small"
                      style="width: 100%"
                    />
                  </template>
                  <template v-else-if="row.key === 'defect'">
                    <template v-if="item.headers.length > 1 && hIdx === item.headers.length - 1">
                      {{ formatDisplayNumber(defectTotal(item)) }}
                    </template>
                    <el-input-number
                      v-else
                      v-model="item.defectQuantities[hIdx]"
                      :min="0"
                      :max="maxDefectQtyForSize(item, hIdx)"
                      :precision="0"
                      controls-position="right"
                      size="small"
                      style="width: 100%"
                    />
                  </template>
                  <template v-else>
                    {{ row.values[hIdx] != null ? formatDisplayNumber(row.values[hIdx]) : '-' }}
                  </template>
                </template>
              </el-table-column>
            </el-table>
            <div class="packaging-extra">
              <el-form-item label="备注" class="packaging-form-item">
                <el-input
                  v-model="item.remark"
                  type="textarea"
                  :rows="2"
                  placeholder="选填"
                  size="small"
                  maxlength="200"
                  show-word-limit
                  style="width: 360px"
                />
              </el-form-item>
            </div>
          </template>
        </div>
      </template>
      <template #footer>
        <el-button @click="packagingCompleteDialog.visible = false">取消</el-button>
        <template v-if="packagingCompleteDialog.mode === 'amend'">
          <el-button
            type="primary"
            :loading="packagingCompleteDialog.submitting"
            @click="submitPackagingComplete('full')"
          >
            保存修改
          </el-button>
        </template>
        <template v-else>
          <el-button
            :loading="packagingCompleteDialog.submitting"
            @click="submitPackagingComplete('partial')"
          >
            部分入库
          </el-button>
          <el-button
            type="primary"
            :loading="packagingCompleteDialog.submitting"
            @click="submitPackagingComplete('full')"
          >
            全部入库
          </el-button>
        </template>
      </template>
    </AppDialog>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
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
import OperationLogsSection from '@/components/common/OperationLogsSection.vue'
import { formatDate, formatDateTime } from '@/utils/date-format'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { formatDisplayNumber } from '@/utils/display-number'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import ProductionOrderBriefPanel, {
  type ProductionOrderBriefModel,
} from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionDetailDrawerShell from '@/components/production/ProductionDetailDrawerShell.vue'
import BatchTimelineSection from '@/components/production/BatchTimelineSection.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'
import FinishingTable from '@/components/production/FinishingTable.vue'
import { useAuthStore } from '@/stores/auth'
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
  (row) => {
    void loadFinishingDrawerLogs(row)
  },
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
  packagingSetZero,
  packagingSetInboundToReceived,
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

<style scoped>
.finishing-page {
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

.dialog-tip {
  margin: 0 0 var(--space-md);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.register-brief {
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  background: var(--el-fill-color-light);
  border-radius: var(--radius);
  font-size: var(--font-size-caption, 12px);
}

.register-brief > div + div {
  margin-top: 4px;
}

.register-loading {
  padding: var(--space-md);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.register-qty-title {
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 13px;
}

.register-qty-table {
  margin-bottom: 8px;
}

.packaging-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-bottom: 8px;
}

.packaging-block {
  margin-bottom: var(--space-md);
}

.packaging-block:last-child {
  margin-bottom: 0;
}

.packaging-extra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-md);
  margin-top: 8px;
}

.packaging-extra .packaging-form-item {
  margin-bottom: 0;
}

.register-qty-sum {
  margin: 0 0 var(--space-sm);
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.register-form {
  margin-top: var(--space-sm);
}

</style>

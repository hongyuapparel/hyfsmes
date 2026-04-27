<template>
  <div class="page-card page-card--fill cutting-page">
    <!-- Tab：全部 / 等待裁床 / 裁床完成 -->
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
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
      <el-date-picker
        v-model="completedRange"
        type="daterange"
        range-separator=""
        start-placeholder="完成时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        clearable
        size="large"
        :class="['filter-bar-item', 'filter-range', { 'range-single': !completedRange }]"
        :style="getFilterRangeStyle(completedRange)"
        @change="onSearch"
      />
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button size="large" :loading="exporting" @click="onExport">导出表格</el-button>
        <el-button
          v-if="hasSelection && canRegisterSelection && canCompleteCuttingAction"
          type="primary"
          size="large"
          @click="openRegisterDialog"
        >
          裁床登记
        </el-button>
      </div>
    </div>

    <div v-if="hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <!-- 待裁床订单列表 -->
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

    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="onPageSizeChange"
      />
    </div>

    <!-- 裁床登记弹窗 -->
    <el-dialog
      v-model="registerDialog.visible"
      title="裁床登记"
      class="cutting-register-dialog"
      width="1020px"
      align-center
      destroy-on-close
      @close="resetRegisterForm"
    >
      <template v-if="registerDialog.row">
        <CuttingBasicInfoBar :order-brief="registerForm.orderBrief" />
        <p class="register-hint">
          按颜色、尺码填写<strong>实际裁剪件数</strong>（与订单 B 区一致）；下方登记布料领用与裁剪单价。
        </p>
        <CuttingQuantityMatrix
          v-model="registerForm.actualCutRows"
          :headers="registerForm.colorSizeHeaders"
          :matrix-max-height="320"
        />
        <el-divider content-position="left">物料用量明细</el-divider>
        <CuttingMaterialUsageTable
          v-model="registerForm.materialUsageRows"
          :grand-pieces="actualCutGrandTotal"
        />
        <el-form :model="registerForm" label-width="132px" class="cut-cost-form">
          <el-form-item label="裁剪部门">
            <el-select
              v-model="registerForm.cuttingDepartment"
              placeholder="请选择"
              filterable
              clearable
              style="width: 240px"
              @change="onCuttingDepartmentChange"
            >
              <el-option :label="SELF_DEPARTMENT_LABEL" :value="SELF_DEPARTMENT_LABEL" />
              <el-option
                v-for="opt in cuttingDepartmentOptions"
                :key="opt"
                :label="opt"
                :value="opt"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="isSelfCutting" label="裁剪人">
            <el-select
              v-model="registerForm.cutterName"
              placeholder="请选择裁剪人"
              filterable
              clearable
              style="width: 240px"
            >
              <el-option
                v-for="opt in cutterOptions"
                :key="opt"
                :label="opt"
                :value="opt"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="isSelfCutting" label="本次净耗合计(米)">
            <span class="cut-readonly-num">{{ formatFabricGrand(fabricNetGrandTotal) }}</span>
            <span class="cut-readonly-hint">由上方物料明细自动汇总（领用 − 退回）</span>
          </el-form-item>
          <el-form-item label="裁剪单价（元/件）">
            <el-input-number
              v-model="cuttingUnitPriceNum"
              :min="0"
              :precision="2"
              :controls="false"
              placeholder="元/件"
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item label="裁剪总成本（元）">
            <span class="cut-readonly-num">{{ formatDisplayNumber(cuttingTotalCostDisplay) }}</span>
            <span class="cut-readonly-hint">裁剪单价 × 实际裁剪数量合计</span>
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="registerDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="registerDialog.submitting" @click="submitRegister">
          完成
        </el-button>
      </template>
    </el-dialog>

    <ProductionDetailDrawerShell
      v-model="detailDrawer.visible"
      title="裁床详情"
      :size="cuttingDetailDrawerSize"
      @closed="onDetailDrawerClosed"
    >
      <div v-loading="detailDrawer.loading" class="cutting-detail-drawer__body">
        <template v-if="detailDrawer.row">
          <ProductionDetailSection v-if="!detailPayload">
            <ProductionOrderBriefPanel :brief="cuttingBriefFromRow(detailDrawer.row)" />
          </ProductionDetailSection>
          <template v-if="detailPayload">
            <ProductionDetailSection>
              <CuttingBasicInfoBar :order-brief="detailPayload.orderBrief" show-extended />
              <p class="register-hint">以下为该订单裁床完成时登记的裁剪数量与物料用量（只读）。</p>
              <CuttingQuantityMatrix
                :model-value="detailPayload.actualCutRows"
                :headers="detailPayload.colorSizeHeaders"
                :matrix-max-height="360"
                readonly
              />
              <el-divider content-position="left">物料用量明细</el-divider>
              <CuttingMaterialUsageTable
                :model-value="detailPayload.materialUsageRows"
                :grand-pieces="detailGrandPieces"
                :table-max-height="420"
                readonly
              />
              <div class="cut-detail-meta">
                <div class="cut-detail-meta__row">
                  <span class="cut-detail-meta__label">到裁床时间</span>
                  <span>{{ formatDateTime(detailPayload.arrivedAt) }}</span>
                </div>
                <div class="cut-detail-meta__row">
                  <span class="cut-detail-meta__label">完成时间</span>
                  <span>{{ formatDateTime(detailPayload.completedAt) }}</span>
                </div>
                <div class="cut-detail-meta__row">
                  <span class="cut-detail-meta__label">裁剪部门</span>
                  <span>{{ displayDash(detailPayload.cuttingDepartment) }}</span>
                </div>
                <div class="cut-detail-meta__row">
                  <span class="cut-detail-meta__label">裁剪人</span>
                  <span>{{ displayDash(detailPayload.cutterName) }}</span>
                </div>
                <div class="cut-detail-meta__row">
                  <span class="cut-detail-meta__label">本次净耗合计(米)</span>
                  <span>{{ fabricMetersDisplay(detailPayload.actualFabricMeters) }}</span>
                </div>
                <div class="cut-detail-meta__row">
                  <span class="cut-detail-meta__label">裁剪单价(元/件)</span>
                  <span>{{ moneyDisplay(detailPayload.cuttingUnitPrice) }}</span>
                </div>
                <div class="cut-detail-meta__row">
                  <span class="cut-detail-meta__label">裁剪总成本(元)</span>
                  <span>{{ moneyDisplay(detailPayload.cuttingTotalCost ?? detailPayload.cuttingCost) }}</span>
                </div>
              </div>
            </ProductionDetailSection>
          </template>
          <ProductionDetailSection v-else title="时效与节点">
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="裁床状态">
                {{ detailDrawer.row.cuttingStatus === 'completed' ? '裁床完成' : '等待裁床' }}
              </el-descriptions-item>
              <el-descriptions-item label="到裁床时间">
                {{ formatDateTime(detailDrawer.row.arrivedAt) }}
              </el-descriptions-item>
              <el-descriptions-item label="完成时间">
                {{ formatDateTime(detailDrawer.row.completedAt) }}
              </el-descriptions-item>
              <el-descriptions-item label="时效判定">
                <SlaJudgeTag :text="detailDrawer.row.timeRating" />
              </el-descriptions-item>
            </el-descriptions>
          </ProductionDetailSection>
        </template>
      </div>
    </ProductionDetailDrawerShell>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { type CuttingListItem } from '@/api/production-cutting'
import CuttingBasicInfoBar from '@/components/production-cutting/CuttingBasicInfoBar.vue'
import CuttingQuantityMatrix from '@/components/production-cutting/CuttingQuantityMatrix.vue'
import CuttingMaterialUsageTable from '@/components/production-cutting/CuttingMaterialUsageTable.vue'
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
import { formatDate, formatDateTime } from '@/utils/date-format'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { formatDisplayNumber } from '@/utils/display-number'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import ProductionOrderBriefPanel from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionDetailDrawerShell from '@/components/production/ProductionDetailDrawerShell.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'
import CuttingTable from '@/components/production/CuttingTable.vue'
import { useAuthStore } from '@/stores/auth'

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
  cuttingDetailDrawerSize,
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

function getTabLabel(tab: CuttingTabConfig): string {
  const counts = tabCounts.value
  const count = tab.value === 'all' ? tabTotal.value : counts[tab.value] ?? 0
  return `${tab.label}(${count})`
}

onMounted(() => {
  load()
  void loadTabCounts()
  void loadCuttingDepartments()
  void loadCutterOptions()
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

.register-hint {
  margin-bottom: var(--space-sm);
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-caption, 12px);
}

.cut-grid {
  margin-bottom: var(--space-md);
}

.cut-cost-form {
  margin-top: var(--space-sm);
}

.cut-readonly-num {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  margin-right: 8px;
}

.cut-readonly-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.cutting-detail-drawer__body {
  min-height: 120px;
}

.cut-detail-meta {
  margin-top: var(--space-md);
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--radius);
  border: 1px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.cut-detail-meta__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}

.cut-detail-meta__label {
  color: var(--el-text-color-secondary);
  min-width: 9em;
  flex-shrink: 0;
}
</style>

<style>
/* 对话框 teleport 到 body，非 scoped */
.cutting-register-dialog.el-dialog {
  max-width: min(1020px, 96vw);
}
</style>

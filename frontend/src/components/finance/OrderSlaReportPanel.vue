<template>
  <div class="page-card page-card--fill order-sla-report-page">
    <el-tabs v-model="activeTab" class="report-tabs" @tab-change="onTabChange">
      <el-tab-pane label="时效报表" name="sla" />
      <el-tab-pane label="利润报表" name="profit" />
    </el-tabs>

    <p class="report-desc">
      {{ activeTab === 'sla' ? '用于查看订单整体交期与超期情况，支持按下单时间、完成时间、当前状态筛选，并支持勾选导出。' : '用于查看订单利润相关指标，支持同步筛选与导出。' }}
    </p>

    <div class="filter-bar">
      <el-date-picker
        v-model="filter.orderDateRange"
        type="daterange"
        range-separator=""
        start-placeholder="下单时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        clearable
        size="large"
        :class="['filter-bar-item', 'filter-range', { 'range-single': !filter.orderDateRange }]"
        :style="getFilterRangeStyle(filter.orderDateRange)"
        @change="onSearch"
      />
      <el-date-picker
        v-model="filter.completedRange"
        type="daterange"
        range-separator=""
        start-placeholder="完成时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        clearable
        size="large"
        :class="['filter-bar-item', 'filter-range', { 'range-single': !filter.completedRange }]"
        :style="getFilterRangeStyle(filter.completedRange)"
        @change="onSearch"
      />
      <el-select
        v-model="filter.statusId"
        placeholder="状态"
        clearable
        size="large"
        class="filter-bar-item"
        @change="onSearch"
      >
        <el-option v-for="s in statusOptions" :key="s.id" :label="s.label" :value="s.id" />
      </el-select>
      <el-select
        v-model="filter.collaborationTypeId"
        placeholder="合作方式"
        clearable
        size="large"
        class="filter-bar-item"
        @change="onSearch"
      >
        <el-option v-for="opt in collaborationOptions" :key="opt.id" :label="opt.value" :value="opt.id" />
      </el-select>
      <el-select
        v-model="filter.orderTypeId"
        placeholder="订单类型"
        clearable
        size="large"
        class="filter-bar-item"
        @change="onSearch"
      >
        <el-option v-for="opt in orderTypeOptions" :key="opt.id" :label="opt.value" :value="opt.id" />
      </el-select>

      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch">搜索</el-button>
        <el-button size="large" :disabled="activeTab === 'sla' ? !list.length : !profitList.length" @click="onExport(false)">导出当前</el-button>
        <el-button size="large" :disabled="currentSelectionCount === 0" @click="onExport(true)">导出选中</el-button>
      </div>
    </div>

    <div v-if="currentTotal > 0" class="summary-bar">
      <span>共 <strong>{{ currentTotal }}</strong> 条订单</span>
      <span v-if="activeTab === 'sla' && summary" class="summary-overdue">超期 <strong>{{ summary.overdue }}</strong> 条</span>
    </div>

    <div v-if="currentSelectionCount > 0" class="table-selection-count">已选 {{ currentSelectionCount }} 项</div>

    <template v-if="activeTab === 'sla'">
      <div class="report-section">
        <div ref="slaTableShellRef" class="list-page-table-shell">
          <el-table
            v-loading="loading"
            :data="list"
            :height="slaTableHeight ?? defaultTableHeight"
            :fit="false"
            border
            stripe
            size="small"
            class="report-table"
            scrollbar-always-on
            :header-cell-style="centerStyle"
            :cell-style="centerStyle"
            table-layout="fixed"
            @selection-change="onSelectionChange"
          >
        <el-table-column type="selection" width="46" />
        <el-table-column prop="orderNo" label="订单号" width="110" show-overflow-tooltip />
        <el-table-column prop="skuCode" label="sku" width="90" show-overflow-tooltip />
        <el-table-column prop="collaborationTypeLabel" label="合作方式" width="90" show-overflow-tooltip />
        <el-table-column prop="orderTypeLabel" label="订单类型" width="90" show-overflow-tooltip />
        <el-table-column label="数量" width="70" show-overflow-tooltip>
          <template #default="{ row }">{{ formatBizNumberForTable(row.quantity) }}</template>
        </el-table-column>
        <el-table-column prop="merchandiser" label="跟单员" width="80" show-overflow-tooltip />
        <el-table-column prop="salesperson" label="业务员" width="80" show-overflow-tooltip />
        <el-table-column prop="customerName" label="客户" width="110" show-overflow-tooltip />
        <el-table-column label="下单时间" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.orderDate) }}</template>
        </el-table-column>
        <el-table-column label="客户交期" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.customerDueDate) }}</template>
        </el-table-column>
        <el-table-column label="审单时间" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.reviewAt) }}</template>
        </el-table-column>
        <el-table-column label="审单耗时（小时）" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ formatBizNumberForTable(row.reviewDurationHours) }}</template>
        </el-table-column>
        <el-table-column label="审单判定" width="90" show-overflow-tooltip>
          <template #default="{ row }"><SlaJudgeTag :text="row.reviewJudge" /></template>
        </el-table-column>
        <el-table-column label="到采购时间" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.purchaseArrivedAt) }}</template>
        </el-table-column>
        <el-table-column label="采购完成时间" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.purchaseCompletedAt) }}</template>
        </el-table-column>
        <el-table-column label="采购判定" width="90" show-overflow-tooltip>
          <template #default="{ row }"><SlaJudgeTag :text="row.purchaseJudge" /></template>
        </el-table-column>
        <el-table-column label="到纸样时间" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.patternArrivedAt) }}</template>
        </el-table-column>
        <el-table-column label="纸样完成时间" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.patternCompletedAt) }}</template>
        </el-table-column>
        <el-table-column label="纸样判定" width="90" show-overflow-tooltip>
          <template #default="{ row }"><SlaJudgeTag :text="row.patternJudge" /></template>
        </el-table-column>
        <el-table-column label="到裁床时间" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.cuttingArrivedAt) }}</template>
        </el-table-column>
        <el-table-column label="裁床完成时间" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.cuttingCompletedAt) }}</template>
        </el-table-column>
        <el-table-column label="裁床判定" width="90" show-overflow-tooltip>
          <template #default="{ row }"><SlaJudgeTag :text="row.cuttingJudge" /></template>
        </el-table-column>
        <el-table-column label="到工艺时间" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.craftArrivedAt) }}</template>
        </el-table-column>
        <el-table-column label="工艺完成时间" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.craftCompletedAt) }}</template>
        </el-table-column>
        <el-table-column label="工艺判定" width="90" show-overflow-tooltip>
          <template #default="{ row }"><SlaJudgeTag :text="row.craftJudge" /></template>
        </el-table-column>
        <el-table-column label="到车缝时间" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.sewingArrivedAt) }}</template>
        </el-table-column>
        <el-table-column label="车缝完成时间" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.sewingCompletedAt) }}</template>
        </el-table-column>
        <el-table-column label="车缝判定" width="90" show-overflow-tooltip>
          <template #default="{ row }"><SlaJudgeTag :text="row.sewingJudge" /></template>
        </el-table-column>
        <el-table-column label="到尾部时间" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.finishingArrivedAt) }}</template>
        </el-table-column>
        <el-table-column label="尾部完成时间" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.finishingCompletedAt) }}</template>
        </el-table-column>
        <el-table-column label="尾部判定" width="90" show-overflow-tooltip>
          <template #default="{ row }"><SlaJudgeTag :text="row.finishingJudge" /></template>
        </el-table-column>
        <el-table-column label="完成时间" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.completedAt) }}</template>
        </el-table-column>
        <el-table-column prop="statusLabel" label="状态" width="80" show-overflow-tooltip />
        <el-table-column label="进入状态时间" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ formatMaybeDateTime(row.enteredAt) }}</template>
        </el-table-column>
        <el-table-column label="耗时（小时）" width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ formatBizNumberForTable(row.durationHours) }}</template>
        </el-table-column>
        <el-table-column label="时效判定" width="90" align="center" show-overflow-tooltip>
          <template #default="{ row }"><SlaJudgeTag :text="currentSegmentSlaLabel(row)" /></template>
        </el-table-column>
          </el-table>
        </div>

        <AppPaginationBar
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="summary?.total ?? 0"
          :page-sizes="[20, 50, 100]"
          @current-change="onPageChange"
          @size-change="onPageSizeChange"
        />
      </div>
    </template>

    <template v-else>
      <div class="report-section">
        <div ref="profitTableShellRef" class="list-page-table-shell">
          <el-table
            v-loading="loading"
            :data="profitList"
            :height="profitTableHeight ?? defaultTableHeight"
            :fit="false"
            border
            stripe
            size="small"
            class="profit-table report-table"
            scrollbar-always-on
            :header-cell-style="centerStyle"
            :cell-style="centerStyle"
            table-layout="fixed"
            @selection-change="onProfitSelectionChange"
          >
        <el-table-column type="selection" width="46" />
        <el-table-column prop="orderNo" label="订单号" width="110" />
        <el-table-column prop="skuCode" label="SKU" width="100" />
        <el-table-column prop="collaborationTypeLabel" label="合作方式" width="100" />
        <el-table-column prop="orderTypeLabel" label="订单类型" width="100" />
        <el-table-column label="出货数量" width="90">
          <template #default="{ row }">{{ formatBizNumberForTable(row.shipmentQty) }}</template>
        </el-table-column>
        <el-table-column prop="merchandiser" label="跟单" width="90" />
        <el-table-column prop="salesperson" label="业务员" width="90" />
        <el-table-column prop="customerName" label="客户" width="120" />
        <el-table-column label="销售价" width="90">
          <template #default="{ row }">{{ formatBizNumberForTable(row.salePrice) }}</template>
        </el-table-column>
        <el-table-column label="出厂价" width="90">
          <template #default="{ row }">{{ formatBizNumberForTable(row.factoryPrice) }}</template>
        </el-table-column>
        <el-table-column label="材料成本" width="150">
          <template #default="{ row }">{{ formatBizNumberForTable(row.materialCost) }}</template>
        </el-table-column>
        <el-table-column label="工艺项目" width="150">
          <template #default="{ row }">{{ formatBizNumberForTable(row.processCost) }}</template>
        </el-table-column>
        <el-table-column label="生产工序" width="150">
          <template #default="{ row }">{{ formatBizNumberForTable(row.productionCost) }}</template>
        </el-table-column>
        <el-table-column label="单件利润" width="130">
          <template #default="{ row }">{{ formatBizNumberForTable(row.unitProfit) }}</template>
        </el-table-column>
        <el-table-column label="工厂总利润" width="130">
          <template #default="{ row }">{{ formatBizNumberForTable(calcFactoryTotalProfit(row)) }}</template>
        </el-table-column>
          </el-table>
        </div>

        <AppPaginationBar
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="profitSummary?.total ?? 0"
          :page-sizes="[20, 50, 100]"
          @current-change="onPageChange"
          @size-change="onPageSizeChange"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import AppPaginationBar from '@/components/AppPaginationBar.vue'
import { useOrderSlaReport } from '@/composables/useOrderSlaReport'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { rangeShortcuts } from '@/utils/date-shortcuts'

const {
  loading,
  list,
  summary,
  profitList,
  profitSummary,
  statusOptions,
  collaborationOptions,
  orderTypeOptions,
  pagination,
  activeTab,
  filter,
  currentTotal,
  currentSelectionCount,
  getFilterRangeStyle,
  centerStyle,
  currentSegmentSlaLabel,
  onSelectionChange,
  onProfitSelectionChange,
  formatMaybeDateTime,
  formatBizNumberForTable,
  calcFactoryTotalProfit,
  onExport,
  onSearch,
  onTabChange,
  onPageChange,
  onPageSizeChange,
} = useOrderSlaReport()

const slaTableShellRef = ref<HTMLElement | null>(null)
const profitTableShellRef = ref<HTMLElement | null>(null)
const defaultTableHeight = 520
const { tableHeight: slaTableHeight } = useFlexShellTableHeight(slaTableShellRef)
const { tableHeight: profitTableHeight } = useFlexShellTableHeight(profitTableShellRef)
</script>

<style scoped>
.report-tabs {
  margin-bottom: var(--space-sm);
}

.report-desc {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
  margin: 0 0 var(--el-component-spacing);
}

.order-sla-report-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-sm);
  padding: var(--space-sm);
  margin-bottom: var(--space-md);
  border-radius: var(--radius-lg);
  background-color: var(--color-bg-subtle, #f5f6f8);
}

.range-single.el-date-editor--daterange :deep(.el-range-separator) {
  display: none;
}

.range-single.el-date-editor--daterange :deep(.el-range-input:last-child) {
  display: none;
}

.range-single.el-date-editor--daterange :deep(.el-range-input:first-child) {
  width: 100%;
}

.range-single.el-date-editor--daterange :deep(.el-range__close-icon) {
  margin-left: 0;
}

.filter-bar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-left: auto;
}

.summary-bar {
  margin-bottom: var(--el-component-spacing);
  font-size: var(--el-font-size-small);
}

.summary-overdue {
  margin-left: 16px;
  color: var(--el-color-danger);
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.report-table {
  margin-top: 8px;
}

.report-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

</style>

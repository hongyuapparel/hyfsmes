<template>
  <div class="page-card page-card--fill process-page">
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
          <el-radio-button
            v-for="tab in CRAFT_TABS"
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
        v-model="filter.supplier"
        placeholder="供应商"
        clearable
        size="large"
        class="filter-bar-item"
        :input-style="getFilterInputStyle(filter.supplier)"
        @input="debouncedSearch"
        @keyup.enter="onSearch"
      />
      <el-input
        v-model="filter.processItem"
        placeholder="工艺项目"
        clearable
        size="large"
        class="filter-bar-item"
        :input-style="getFilterInputStyle(filter.processItem)"
        @input="debouncedSearch"
        @keyup.enter="onSearch"
      />
      <el-tree-select
        v-model="filter.orderTypeId"
        :data="orderTypeTreeSelectData"
        placeholder="订单类型"
        filterable
        clearable
        default-expand-all
        :render-after-expand="false"
        node-key="value"
        :props="{ label: 'label', value: 'value', children: 'children', disabled: 'disabled' }"
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.orderTypeId && `订单类型：${findOrderTypeLabelById(filter.orderTypeId)}`,
          )
        "
        @change="onSearch"
      >
        <template #prefix>
          <span v-if="filter.orderTypeId" :style="{ color: ACTIVE_FILTER_COLOR }">订单类型：</span>
        </template>
      </el-tree-select>
      <el-select
        v-model="filter.collaborationTypeId"
        placeholder="合作方式"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.collaborationTypeId && `合作方式：${findCollaborationLabelById(filter.collaborationTypeId)}`,
          )
        "
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.collaborationTypeId">合作方式：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="opt in collaborationOptions"
          :key="opt.id"
          :label="opt.label"
          :value="opt.id"
        />
      </el-select>
      <el-date-picker
        v-model="orderDateRange"
        type="daterange"
        range-separator=""
        start-placeholder="下单时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        size="large"
        class="filter-bar-item"
        :style="getFilterRangeStyle(orderDateRange)"
        @change="onSearch"
      />
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
        <el-button type="primary" size="large" @click="onSearch">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button size="large" :loading="exporting" @click="onExport">导出表格</el-button>
        <el-button
          v-if="hasSelection && canCompleteSelection && canCompleteProcessAction"
          type="primary"
          size="large"
          :loading="completing"
          @click="onConfirmComplete"
        >
          确认完成
        </el-button>
      </div>
    </div>

    <div v-if="hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <div ref="tableShellRef" class="list-page-table-shell">
      <el-table
        ref="craftTableRef"
        v-loading="loading"
        :data="list"
        border
        stripe
        class="craft-table"
        :height="tableHeight"
        :row-style="compactRowStyle"
        :cell-style="compactCellStyle"
        :header-cell-style="compactHeaderCellStyle"
        @header-dragend="onHeaderDragEnd"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="48" align="center" />
        <el-table-column prop="orderNo" label="订单号" min-width="100" />
        <el-table-column prop="skuCode" label="SKU" min-width="100" />
        <el-table-column label="图片" :width="compactImageColumnMinWidth" align="center">
          <template #default="{ row }">
            <AppImageThumb
              v-if="row.imageUrl"
              :raw-url="row.imageUrl"
              :width="compactImageSize"
              :height="compactImageSize"
            />
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" min-width="90" show-overflow-tooltip />
        <el-table-column prop="merchandiser" label="跟单" width="80" show-overflow-tooltip />
        <el-table-column label="客户交期" width="110" align="center">
          <template #default="{ row }">{{ formatDate(row.customerDueDate) }}</template>
        </el-table-column>
        <el-table-column label="订单数量" width="88" align="right">
          <template #default="{ row }">{{ formatDisplayNumber(row.quantity) }}</template>
        </el-table-column>
        <el-table-column prop="arrivedAtCraft" label="到工艺时间" width="110" align="center">
          <template #default="{ row }">{{ formatDateTime(row.arrivedAtCraft) }}</template>
        </el-table-column>
        <el-table-column prop="completedAt" label="完成时间" width="110" align="center">
          <template #default="{ row }">{{ formatDateTime(row.completedAt) }}</template>
        </el-table-column>
        <el-table-column label="时效判定" width="96" align="center">
          <template #default="{ row }">
            <SlaJudgeTag :text="row.timeRating" />
          </template>
        </el-table-column>
        <el-table-column prop="supplierName" label="供应商" min-width="100" show-overflow-tooltip />
        <el-table-column prop="processItem" label="工艺项目" min-width="120" show-overflow-tooltip />
        <el-table-column label="订单属性" min-width="108">
          <template #default="{ row }">
            <div>{{ orderTypeDisplay(row) }}</div>
            <div class="text-muted craft-sub-attr">{{ collaborationDisplay(row) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="明细" width="72" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openCraftDetailDrawer(row)">明细</el-button>
          </template>
        </el-table-column>
      </el-table>
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
      v-model="craftDetailDrawer.visible"
      title="工艺明细"
      size="520px"
      @closed="craftDetailDrawer.row = null"
    >
      <template v-if="craftDetailDrawer.row">
        <ProductionDetailSection>
          <ProductionOrderBriefPanel :brief="craftBriefFromRow(craftDetailDrawer.row)" />
        </ProductionDetailSection>
        <ProductionDetailSection title="时效与节点">
          <el-descriptions :column="1" border size="small" class="craft-drawer-meta">
            <el-descriptions-item label="采购齐套">
              <el-tag
                :type="craftDetailDrawer.row.purchaseStatus === 'completed' ? 'success' : 'info'"
                size="small"
              >
                {{ craftDetailDrawer.row.purchaseStatus === 'completed' ? '已完成' : '未完成' }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="到工艺时间">
              {{ formatDateTime(craftDetailDrawer.row.arrivedAtCraft) }}
            </el-descriptions-item>
            <el-descriptions-item label="完成时间">
              {{ formatDateTime(craftDetailDrawer.row.completedAt) }}
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection title="E 区工艺项目">
          <el-table
            :data="craftDetailDrawer.row.processItems || []"
            border
            stripe
            size="small"
            max-height="360"
            empty-text="暂无工艺行"
          >
            <el-table-column prop="processName" label="工艺项目" min-width="100" show-overflow-tooltip />
            <el-table-column prop="supplierName" label="供应商" min-width="90" show-overflow-tooltip />
            <el-table-column prop="part" label="部位" width="88" show-overflow-tooltip />
            <el-table-column prop="remark" label="备注" min-width="100" show-overflow-tooltip />
          </el-table>
        </ProductionDetailSection>
      </template>
    </ProductionDetailDrawerShell>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getFilterRangeStyle,
} from '@/composables/useFilterBarHelpers'
import { formatDate, formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import ProductionOrderBriefPanel from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionDetailDrawerShell from '@/components/production/ProductionDetailDrawerShell.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import { useProductionProcessPage } from '@/composables/useProductionProcessPage'
import { useAuthStore } from '@/stores/auth'
import AppPaginationBar from '@/components/AppPaginationBar.vue'

const authStore = useAuthStore()
const canCompleteProcessAction = computed(() => authStore.hasPermission('production_process_complete'))

const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR as string }
function getFilterSelectAutoWidthStyle(v: unknown) {
  if (!v) return undefined
  const text = String(v)
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { ...activeSelectStyle, width: `${width}px`, flex: `0 0 ${width}px` }
}

const tableShellRef = ref<HTMLElement | null>(null)
const craftTableRef = ref()
const { tableHeight } = useFlexShellTableHeight(tableShellRef)
const {
  compactHeaderCellStyle,
  compactCellStyle,
  compactRowStyle,
  compactImageSize,
  compactImageColumnMinWidth,
} = useCompactTableStyle()
const { onHeaderDragEnd, restoreColumnWidths } = useTableColumnWidthPersist('production-craft-main')

const {
  CRAFT_TABS,
  orderTypeTreeSelectData,
  collaborationOptions,
  filter,
  orderDateRange,
  completedRange,
  currentTab,
  list,
  loading,
  exporting,
  completing,
  pagination,
  totalQuantity,
  selectedRows,
  hasSelection,
  canCompleteSelection,
  getTabLabel,
  findOrderTypeLabelById,
  findCollaborationLabelById,
  debouncedSearch,
  onExport,
  onSearch,
  onReset,
  onTabChange,
  onPageSizeChange,
  onSelectionChange,
  onConfirmComplete,
  orderTypeDisplay,
  collaborationDisplay,
  craftDetailDrawer,
  openCraftDetailDrawer,
  craftBriefFromRow,
  load,
} = useProductionProcessPage()

function restoreCurrentColumnWidths() {
  restoreColumnWidths(craftTableRef.value)
}

watchEffect(() => {
  if (!loading.value) {
    restoreCurrentColumnWidths()
  }
})
</script>

<style scoped>
.process-page {
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

.craft-table {
  flex: 1;
  min-height: 0;
}

.craft-table :deep(.cell) {
  padding-left: 6px;
  padding-right: 6px;
  line-height: 20px;
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.text-muted {
  color: var(--el-text-color-secondary);
}

.craft-sub-attr {
  font-size: 12px;
  margin-top: 2px;
}

.craft-drawer-meta {
  margin-top: 12px;
}
</style>

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
      <div class="filter-bar-actions">
        <el-button type="primary" @click="onSearch(true)">搜索</el-button>
        <el-button @click="onReset">清空</el-button>
        <el-button :loading="exporting" @click="onExport">导出表格</el-button>
        <el-button
          v-if="hasSelection && canRegisterPurchase"
          type="primary"
          @click="onBatchHandle"
        >
          {{ batchButtonLabel }}
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
    />

    <AppPaginationBar
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :page-sizes="[20, 50, 100]"
      @current-change="load"
      @size-change="onPageSizeChange"
    />

    <ProductionDetailDrawerShell
      v-model="purchaseBriefDrawer.visible"
      title="订单与物料概要"
      :size="760"
      :resizable="true"
      @closed="purchaseBriefDrawer.row = null"
    >
      <template v-if="purchaseBriefDrawer.row">
        <ProductionDetailSection>
          <ProductionOrderBriefPanel :brief="purchaseBriefFromRow(purchaseBriefDrawer.row)" />
        </ProductionDetailSection>
        <ProductionDetailSection title="本行物料">
          <el-descriptions :column="2" border size="small" class="purchase-brief-material">
            <el-descriptions-item label="物料序号">
              {{ purchaseBriefDrawer.row.materialIndex + 1 }}
            </el-descriptions-item>
            <el-descriptions-item label="处理路线">
              {{ purchaseBriefDrawer.row.processRoute === 'picking' ? '领料' : '采购' }}
            </el-descriptions-item>
            <el-descriptions-item label="订单类型">
              {{ orderTypeDisplay(purchaseBriefDrawer.row) || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="物料类型">
              {{ (purchaseBriefDrawer.row.materialType ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="物料名称">
              {{ (purchaseBriefDrawer.row.materialName ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="颜色">
              {{ (purchaseBriefDrawer.row.color ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="供应商">
              {{ (purchaseBriefDrawer.row.supplierName ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="物料来源">
              {{ (purchaseBriefDrawer.row.materialSource ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="计划用量">
              {{ formatMaterialQuantity(purchaseBriefDrawer.row.planQuantity, purchaseBriefDrawer.row) }}
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection title="采购登记信息">
          <el-descriptions :column="2" border size="small" class="purchase-brief-material">
            <el-descriptions-item label="实际采购数量">
              {{
                purchaseBriefDrawer.row.actualPurchaseQuantity != null
                  ? formatDisplayNumber(purchaseBriefDrawer.row.actualPurchaseQuantity)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="单价(元)">
              {{
                purchaseBriefDrawer.row.purchaseUnitPrice != null && purchaseBriefDrawer.row.purchaseUnitPrice !== ''
                  ? formatDisplayNumber(purchaseBriefDrawer.row.purchaseUnitPrice)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="其他费用(元)">
              {{
                purchaseBriefDrawer.row.purchaseOtherCost != null && purchaseBriefDrawer.row.purchaseOtherCost !== ''
                  ? formatDisplayNumber(purchaseBriefDrawer.row.purchaseOtherCost)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="采购总金额(元)">
              {{
                purchaseBriefDrawer.row.purchaseAmount != null && purchaseBriefDrawer.row.purchaseAmount !== ''
                  ? formatDisplayNumber(purchaseBriefDrawer.row.purchaseAmount)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="采购凭证">
              <AppImageThumb
                v-if="purchaseBriefDrawer.row.purchaseImageUrl"
                :raw-url="purchaseBriefDrawer.row.purchaseImageUrl"
                variant="compact"
              />
              <span v-else>—</span>
            </el-descriptions-item>
            <el-descriptions-item label="采购备注">
              {{ (purchaseBriefDrawer.row.purchaseRemark ?? '').trim() || '—' }}
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection title="时效与节点">
          <el-descriptions :column="2" border size="small" class="purchase-brief-material">
            <el-descriptions-item label="到采购时间">
              {{ formatDateTime(purchaseBriefDrawer.row.pendingPurchaseAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="完成时间">
              {{
                formatDateTime(
                  purchaseBriefDrawer.row.processRoute === 'picking'
                    ? purchaseBriefDrawer.row.pickCompletedAt
                    : purchaseBriefDrawer.row.purchaseCompletedAt,
                )
              }}
            </el-descriptions-item>
            <el-descriptions-item label="时效判定">
              <SlaJudgeTag :text="purchaseBriefDrawer.row.timeRating" />
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection>
          <OperationLogsSection :logs="purchaseDrawerLogs" />
        </ProductionDetailSection>
      </template>
    </ProductionDetailDrawerShell>

    <PurchaseRegisterDialog
      v-model="registerDialog.visible"
      :rows="registerDialog.rows"
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
import { formatDisplayNumber } from '@/utils/display-number'
import { formatMaterialQuantity } from '@/utils/material-quantity-unit'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
  getFilterRangeStyle,
  getAdaptiveSelectStyle,
} from '@/composables/useFilterBarHelpers'
import { useTreeSelectAdjust } from '@/composables/useTreeSelectAdjust'

const { adjustTreePopperWidth } = useTreeSelectAdjust()
import { PURCHASE_TABS, usePurchaseList } from '@/composables/usePurchaseList'
import { usePurchaseDialogs } from '@/composables/usePurchaseDialogs'
import type { PurchaseItemRow } from '@/api/production-purchase'
import OperationLogsSection from '@/components/common/OperationLogsSection.vue'
import { fetchOrderOperationLogs, toLogSectionItems } from '@/api/operation-logs'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import PurchaseTable from '@/components/production/PurchaseTable.vue'
import PurchaseRegisterDialog from '@/components/production/PurchaseRegisterDialog.vue'
import PurchasePickDialog from '@/components/production/PurchasePickDialog.vue'
import ProductionOrderBriefPanel from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionDetailDrawerShell from '@/components/production/ProductionDetailDrawerShell.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'
import { useAuthStore } from '@/stores/auth'
import AppPaginationBar from '@/components/AppPaginationBar.vue'
import AppImageThumb from '@/components/AppImageThumb.vue'

const authStore = useAuthStore()
const canRegisterPurchase = computed(() => authStore.hasPermission('production_purchase_register'))

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
  loadTabCounts,
  onExport,
  onSearch,
  debouncedSearch,
  onReset,
  onTabChange,
  onPageSizeChange,
  onSelectionChange,
  onHeaderDragEnd,
  loadOptions,
  orderTypeDisplay,
  openPurchaseBriefDrawer,
  purchaseBriefFromRow,
  displayMaterialType,
} = usePurchaseList()

const {
  registerDialog,
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
} = usePurchaseDialogs({
  currentTab,
  hasSelection,
  selectedRows,
  reload: load,
  reloadTabCounts: loadTabCounts,
  clearSelection: () => {
    selectedRows.value = []
  },
})

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
  purchaseDrawerLogs.value = toLogSectionItems(logs)
}

watch(
  () => purchaseBriefDrawer.row,
  (row) => {
    void loadPurchaseDrawerLogs(row)
  },
)

onMounted(() => {
  void loadOptions()
  void (async () => {
    await load()
    await loadTabCounts()
  })()
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
  font-size: 13px;
}

</style>

<style>
.purchase-order-type-tree-popper.el-popper {
  max-width: 440px;
}
</style>

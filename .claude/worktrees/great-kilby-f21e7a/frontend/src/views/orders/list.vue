<template>
  <div class="page-card orders-list-page">
    <!-- 状态切换 + 新建订单 -->
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentStatus" size="large" @change="onStatusChange">
          <el-radio-button
            v-for="tab in STATUS_TABS"
            :key="tab.value"
            :value="tab.value"
          >
            {{ getStatusTabLabel(tab) }}
          </el-radio-button>
        </el-radio-group>
      </div>
      <div class="status-tabs-right">
        <el-button v-if="canEditOrders" type="primary" size="small" @click="onCreateOrder">新建订单</el-button>
      </div>
    </div>

    <!-- 筛选区：与客户管理 / 产品列表保持同一设计 -->
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
      <el-select
        v-model="filter.customer"
        placeholder="客户"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.customer, 42)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.customer">客户：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="opt in customerOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-tree-select
        v-model="filter.orderTypeId"
        :data="orderTypeTreeSelectData"
        placeholder="订单类型"
        filterable
        clearable
        check-strictly
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
          <span
            v-if="filter.orderTypeId"
            :style="{ color: 'var(--el-color-primary)' }"
          >
            订单类型：
          </span>
        </template>
      </el-tree-select>
      <el-tree-select
        v-model="filter.processItem"
        :data="processOptions"
        placeholder="工艺项目"
        filterable
        clearable
        check-strictly
        :props="{ label: 'label', value: 'value', children: 'children' }"
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.processItem && `工艺项目：${getProcessItemDisplayLabel(filter.processItem)}`,
          )
        "
        @change="onSearch"
      >
        <template #prefix>
          <span
            v-if="filter.processItem"
            :style="{ color: 'var(--el-color-primary)' }"
          >
            工艺项目：
          </span>
        </template>
      </el-tree-select>
      <el-select
        v-model="filter.salesperson"
        placeholder="业务员"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.salesperson)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.salesperson">业务员：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="name in salespersonOptions"
          :key="name"
          :label="name"
          :value="name"
        />
      </el-select>
      <el-select
        v-model="filter.merchandiser"
        placeholder="跟单员"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.merchandiser)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.merchandiser">跟单员：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="name in merchandiserOptions"
          :key="name"
          :label="name"
          :value="name"
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
        clearable
        size="large"
        :class="['filter-bar-item', 'filter-range', { 'range-single': !orderDateRange }]"
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
      <el-select
        v-model="filter.factory"
        placeholder="加工供应商"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.factory && `加工供应商：${filter.factory}`)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.factory">加工供应商：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="opt in factoryOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>

      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button
          v-if="canDeleteOrders && hasSelection && canDeleteSelectedByStatus"
          type="danger"
          size="large"
          @click="onBatchDelete"
        >
          删除
        </el-button>
        <el-button
          v-if="canEditOrders && hasSelection"
          type="warning"
          size="large"
          @click="onBatchCopyToDraft"
        >
          复制为草稿
        </el-button>
        <el-button
          v-if="canReviewOrders && isPendingReviewTab && hasSelection && canReviewSelectedByStatus"
          type="success"
          size="large"
          @click="openReviewDialog"
        >
          审单
        </el-button>
      </div>
    </div>

    <!-- 订单卡片宫格 -->
    <OrderCardGrid
      :loading="loading"
      :list="list"
      :card-selected="cardSelected"
      :size-popover-loading-id="sizePopoverLoadingId"
      :size-breakdown-cache="sizeBreakdownCache"
      :get-status-tag-type="getStatusTagType"
      :get-status-label="getStatusLabel"
      :format-date-time="formatDateTime"
      :format-date="formatDate"
      :get-customer-due-date-class="getCustomerDueDateClass"
      :is-sample-order="isSampleOrder"
      :get-size-popover-width="getSizePopoverWidth"
      :size-popover-blocks="sizePopoverBlocks"
      :get-order-meta-tags="getOrderMetaTags"
      :can-edit-order-item="canEditOrderItem"
      @toggle-select="onCardToggle"
      @show-size-popover="onShowSizePopover"
      @edit="openEdit"
      @cost="openCost"
      @remark="openRemark"
      @operation-log="openOperationLog"
      @print="printOrder"
    />

    <!-- 分页 -->
    <div class="pagination-wrap">
      <div class="pagination-summary">
        {{ paginationQuantityLabel }}：{{ formatDisplayNumber(paginationQuantityValue) }} 件
      </div>
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @current-change="onPageChange"
        @size-change="onPageSizeChange"
      />
    </div>

    <OrderViewDialog
      v-model="viewDialog.visible"
      :order="viewDialog.order"
    />
    <OrderLogDialog
      v-model="logDialog.visible"
      :order-id="logDialog.orderId"
      :logs="logDialog.logs"
      :loading="logDialog.loading"
    />
    <OrderRemarkDialog
      v-model="remarkDialog.visible"
      :order-id="remarkDialog.orderId"
      :initial-remark="remarkDialog.initialRemark"
      @saved="onRemarkSaved"
    />
    <OrderReviewDialog
      v-model="reviewDialog.visible"
      :order-id="reviewDialog.orderId"
      :order-no="reviewDialog.orderNo"
      :order-ids="reviewDialog.orderIds"
      @reviewed="onReviewed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watchEffect, onMounted, onBeforeUnmount, onDeactivated, computed } from 'vue'
import { formatDisplayNumber } from '@/utils/display-number'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { type OrderListItem } from '@/api/orders'
import { useAuthStore } from '@/stores/auth'
import { useOrderListOptions } from '@/composables/useOrderListOptions'
import { useOrderListData } from '@/composables/useOrderListData'
import { useOrderListSelection } from '@/composables/useOrderListSelection'
import { useOrderListPresentation } from '@/composables/useOrderListPresentation'
import { useOrderListStatusCounts } from '@/composables/useOrderListStatusCounts'
import { useOrderListFilterState } from '@/composables/useOrderListFilterState'
import { useOrderSizePopover } from '@/composables/useOrderSizePopover'
import { useOrderListActions } from '@/composables/useOrderListActions'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
  getFilterRangeStyle,
  getFilterSelectStyle,
  getFilterSelectAutoWidthStyle,
} from '@/composables/useFilterBarHelpers'
import OrderViewDialog from '@/components/orders/OrderViewDialog.vue'
import OrderLogDialog from '@/components/orders/OrderLogDialog.vue'
import OrderRemarkDialog from '@/components/orders/OrderRemarkDialog.vue'
import OrderReviewDialog from '@/components/orders/OrderReviewDialog.vue'
import OrderCardGrid from '@/components/orders/OrderCardGrid.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const ORDERS_LIST_FILTER_STATE_KEY = 'orders-list-filter-state-v1'
const {
  STATUS_TABS,
  STATUS_LABEL_MAP,
  orderTypeTree,
  orderTypeTreeSelectData,
  collaborationItems,
  processOptions,
  factoryOptions,
  customerOptions,
  salespersonOptions,
  merchandiserOptions,
  loadStatusTabs,
  findOrderTypeLabelById,
  findCollaborationLabelById,
  getProcessItemDisplayLabel,
  loadOrderTypeTree,
  loadCollaborationItems,
  loadProcessOptions,
  loadFactoryOptions,
  loadCustomerOptions,
  loadSalespersonOptions,
  loadMerchandiserOptions,
  loadOptions,
} = useOrderListOptions()

const {
  filter,
  list,
  loading,
  pagination,
  currentStatus,
  orderDateRange,
  completedRange,
  orderNoLabelVisible,
  skuCodeLabelVisible,
  loadList,
  onSearch: baseOnSearch,
  onReset: baseOnReset,
  onPageChange: baseOnPageChange,
  onPageSizeChange: baseOnPageSizeChange,
  abortListRequest,
} = useOrderListData()
const totalQuantity = ref<number>(0)

const {
  statusCounts,
  statusTotal,
  refreshStatusCounts,
  abortStatusCounts,
} = useOrderListStatusCounts({
  filter,
  orderDateRange,
  completedRange,
})

const {
  sizePopoverLoadingId,
  sizeBreakdownCache,
  onShowSizePopover,
  getSizePopoverWidth,
  sizePopoverBlocks,
} = useOrderSizePopover()

const {
  cardSelected,
  selectedIds,
  hasSelection,
  paginationQuantityLabel,
  paginationQuantityValue,
  isPendingReviewTab,
  canEditOrders,
  canDeleteOrders,
  canReviewOrders,
  canDeleteSelectedByStatus,
  canReviewSelectedByStatus,
  resetSelection,
  onCardSelectChange,
  canEditOrderItem,
} = useOrderListSelection({
  list,
  totalQuantity,
  currentStatus,
  authStore,
})

const {
  getStatusLabel,
  getStatusTagType,
  getCustomerDueDateClass,
  isSampleOrder,
  getOrderMetaTags,
  formatDate,
  formatDateTime,
  getStatusTabLabel,
} = useOrderListPresentation({
  statusLabelMap: STATUS_LABEL_MAP,
  statusCounts,
  statusTotal,
  orderTypeTree,
  findOrderTypeLabelById,
  findCollaborationLabelById,
})

const reloadListOnly = () => loadList(totalQuantity)
const reloadWithCounts = () => load({ refreshCounts: true })
const {
  viewDialog,
  logDialog,
  remarkDialog,
  reviewDialog,
  onBatchDelete,
  openReviewDialog,
  onReviewed,
  onBatchCopyToDraft,
  openRemark,
  onRemarkSaved,
  openOperationLog,
} = useOrderListActions({
  list,
  selectedIds,
  hasSelection,
  isPendingReviewTab,
  pagination,
  reloadList: reloadListOnly,
  reloadWithCounts,
})

const {
  persistFilterState,
  restoreFilterState,
  applyQueryFromRoute,
  startPersistWatch,
} = useOrderListFilterState({
  storageKey: ORDERS_LIST_FILTER_STATE_KEY,
  filter,
  orderDateRange,
  completedRange,
  currentStatus,
  pagination,
  orderNoLabelVisible,
  skuCodeLabelVisible,
})
const stopPersistWatch = startPersistWatch()

/**
 * refreshCounts=true 时刷新状态 tab 数量；
 * 切换状态 / 分页仅刷新列表，不重复请求统计，降低 tab 卡顿感。
 */
async function load(options?: { refreshCounts?: boolean }) {
  await loadList(totalQuantity)
  if (options?.refreshCounts) {
    void refreshStatusCounts()
  }
}

/** @param byUser 仅当用户按回车或点击搜索按钮时为 true，输入防抖触发时为 false */
function onSearch(byUser = false) {
  baseOnSearch(totalQuantity, byUser)
  void refreshStatusCounts()
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
  baseOnReset(totalQuantity)
  resetSelection()
  void refreshStatusCounts()
}

function onStatusChange() {
  pagination.page = 1
  resetSelection()
  load()
}

function onPageChange(page: number) {
  baseOnPageChange(page, totalQuantity)
}

function onPageSizeChange(pageSize: number) {
  baseOnPageSizeChange(pageSize, totalQuantity)
}

function onCardToggle(orderId: number, checked: boolean) {
  cardSelected.value[orderId] = checked
  onCardSelectChange()
}

function openEdit(order: OrderListItem) {
  const title = `订单编辑 ${order.orderNo || order.id}`
  router.push({
    name: 'OrdersEdit',
    params: { id: order.id },
    query: { tabTitle: title, tabKey: `orders-edit-${order.id}` },
  })
}

function openView(order: OrderListItem) {
  const title = `订单详情 ${order.orderNo || order.id}`
  router.push({
    name: 'OrdersDetail',
    params: { id: order.id },
    query: { tabTitle: title, tabKey: `orders-detail-${order.id}` },
  })
}

function openCost(order: OrderListItem) {
  router.push(`/orders/cost/${order.id}`)
}

function printOrder(_order: OrderListItem) {
  // 统一使用订单详情页进行打印，保证版式一致
  const title = `订单详情 ${_order.orderNo || _order.id}`
  router.push({
    name: 'OrdersDetail',
    params: { id: _order.id },
    query: { tabTitle: title, tabKey: `orders-detail-${_order.id}` },
  })
}

function onCreateOrder() {
  const key = `orders-edit-new-${Date.now()}`
  router.push({ name: 'OrdersEdit', query: { new: '1', tabKey: key, tabTitle: '订单编辑 新建' } })
}

onMounted(async () => {
  try {
    // 强制刷新当前用户权限与订单状态策略，避免旧缓存导致按钮显示不一致
    await authStore.fetchUser()
  } catch {
    // 失败时保持现有行为，由全局鉴权处理登录态
  }
  restoreFilterState()
  applyQueryFromRoute(route.query as Record<string, unknown>)
  await load({ refreshCounts: true })
  loadOptions()
  loadStatusTabs()
})

onBeforeUnmount(() => {
  stopPersistWatch()
  persistFilterState()
  abortListRequest()
  abortStatusCounts()
})

onDeactivated(() => {
  persistFilterState()
  abortListRequest()
  abortStatusCounts()
})

watchEffect(() => {
  // 预留：当筛选条件发生明显变化时，可在此埋点或做其它处理
  void filter.orderNo
})
</script>

<style scoped>
.orders-list-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.status-tabs {
  margin-bottom: var(--space-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.status-tabs-left {
  flex: 1;
  min-width: 0;
}

.status-tabs-right {
  flex-shrink: 0;
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

.filter-bar :deep(.el-form-item) {
  margin-bottom: 0;
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

.pagination-wrap {
  margin-top: var(--space-md);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination-summary {
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-secondary, #606266);
}

</style>

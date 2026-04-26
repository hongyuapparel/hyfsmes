<template>
  <div class="filter-bar">
    <el-input
      v-model="filters.orderNo"
      placeholder="订单号"
      clearable
      size="large"
      class="filter-bar-item"
      :style="getOrderNoFilterStyle(filters.orderNo, orderNoLabelVisible)"
      :input-style="getFilterInputStyle(filters.orderNo)"
      @input="debouncedSearch"
      @keyup.enter="onSearch(true)"
    >
      <template #prefix>
        <span
          v-if="filters.orderNo && orderNoLabelVisible"
          :style="{ color: ACTIVE_FILTER_COLOR }"
        >
          订单号：
        </span>
      </template>
    </el-input>
    <el-input
      v-model="filters.skuCode"
      placeholder="SKU编号"
      clearable
      size="large"
      class="filter-bar-item"
      :style="getSkuCodeFilterStyle(filters.skuCode, skuCodeLabelVisible)"
      :input-style="getFilterInputStyle(filters.skuCode)"
      @input="debouncedSearch"
      @keyup.enter="onSearch(true)"
    >
      <template #prefix>
        <span
          v-if="filters.skuCode && skuCodeLabelVisible"
          :style="{ color: ACTIVE_FILTER_COLOR }"
        >
          SKU编号：
        </span>
      </template>
    </el-input>
    <el-select
      v-model="filters.customer"
      placeholder="客户"
      filterable
      clearable
      size="large"
      class="filter-bar-item"
      :style="getFilterSelectAutoWidthStyle(filters.customer, 42)"
      @change="onSearch()"
    >
      <template #label="{ label }">
        <span v-if="filters.customer">客户：{{ label }}</span>
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
      v-model="filters.orderTypeId"
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
      :style="getFilterSelectAutoWidthStyle(filters.orderTypeId && `订单类型：${findOrderTypeLabelById(filters.orderTypeId)}`)"
      @change="onSearch()"
    >
      <template #prefix>
        <span
          v-if="filters.orderTypeId"
          :style="{ color: 'var(--el-color-primary)' }"
        >
          订单类型：
        </span>
      </template>
    </el-tree-select>
    <el-tree-select
      v-model="filters.processItem"
      :data="processOptions"
      placeholder="工艺项目"
      filterable
      clearable
      check-strictly
      :props="{ label: 'label', value: 'value', children: 'children' }"
      size="large"
      class="filter-bar-item"
      :style="getFilterSelectAutoWidthStyle(filters.processItem && `工艺项目：${getProcessItemDisplayLabel(filters.processItem)}`)"
      @change="onSearch()"
    >
      <template #prefix>
        <span
          v-if="filters.processItem"
          :style="{ color: 'var(--el-color-primary)' }"
        >
          工艺项目：
        </span>
      </template>
    </el-tree-select>
    <el-select
      v-model="filters.salesperson"
      placeholder="业务员"
      filterable
      clearable
      size="large"
      class="filter-bar-item"
      :style="getFilterSelectAutoWidthStyle(filters.salesperson)"
      @change="onSearch()"
    >
      <template #label="{ label }">
        <span v-if="filters.salesperson">业务员：{{ label }}</span>
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
      v-model="filters.merchandiser"
      placeholder="跟单员"
      filterable
      clearable
      size="large"
      class="filter-bar-item"
      :style="getFilterSelectAutoWidthStyle(filters.merchandiser)"
      @change="onSearch()"
    >
      <template #label="{ label }">
        <span v-if="filters.merchandiser">跟单员：{{ label }}</span>
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
      @change="onSearch()"
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
      @change="onSearch()"
    />
    <el-select
      v-model="filters.factory"
      placeholder="加工供应商"
      filterable
      clearable
      size="large"
      class="filter-bar-item"
      :style="getFilterSelectAutoWidthStyle(filters.factory && `加工供应商：${filters.factory}`)"
      @change="onSearch()"
    >
      <template #label="{ label }">
        <span v-if="filters.factory">加工供应商：{{ label }}</span>
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
</template>

<script setup lang="ts">
import { ACTIVE_FILTER_COLOR, getFilterInputStyle, getOrderNoFilterStyle, getSkuCodeFilterStyle, getFilterRangeStyle, getFilterSelectAutoWidthStyle } from '@/composables/useFilterBarHelpers'
import { rangeShortcuts } from '@/utils/date-shortcuts'

interface OrderListFilters {
  orderNo: string
  skuCode: string
  customer: string
  orderTypeId: number | null
  processItem: string
  salesperson: string
  merchandiser: string
  factory: string
}

interface OrderTypeTreeSelectNode {
  label: string
  value: number
  children?: OrderTypeTreeSelectNode[]
  disabled?: boolean
}

const filters = defineModel<OrderListFilters>('filters', { required: true })
const orderDateRange = defineModel<[string, string] | null>('orderDateRange', { required: true })
const completedRange = defineModel<[string, string] | null>('completedRange', { required: true })
const orderNoLabelVisible = defineModel<boolean>('orderNoLabelVisible', { required: true })
const skuCodeLabelVisible = defineModel<boolean>('skuCodeLabelVisible', { required: true })

defineProps<{
  customerOptions: Array<{ label: string; value: string }>
  orderTypeTreeSelectData: OrderTypeTreeSelectNode[]
  processOptions: Array<Record<string, unknown>>
  salespersonOptions: string[]
  merchandiserOptions: string[]
  factoryOptions: Array<{ label: string; value: string }>
  canDeleteOrders: boolean
  hasSelection: boolean
  canDeleteSelectedByStatus: boolean
  canEditOrders: boolean
  canReviewOrders: boolean
  isPendingReviewTab: boolean
  canReviewSelectedByStatus: boolean
  findOrderTypeLabelById: (id: number) => string
  getProcessItemDisplayLabel: (value: string) => string
  onSearch: (byUser?: boolean) => void
  onReset: () => void
  debouncedSearch: () => void
  onBatchDelete: () => void
  onBatchCopyToDraft: () => void
  openReviewDialog: () => void
}>()
</script>

<style scoped>
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
</style>

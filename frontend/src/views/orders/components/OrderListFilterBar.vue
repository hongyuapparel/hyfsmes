<template>
  <div class="filter-bar">
    <el-input
      v-model="filters.orderNo"
      placeholder="订单号"
      clearable
      size="large"
      class="filter-bar-item"
      :style="filters.orderNo ? getOrderNoFilterStyle(filters.orderNo, orderNoLabelVisible) : getAdaptiveWidthStyle('订单号', 56)"
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
      :style="filters.skuCode ? getSkuCodeFilterStyle(filters.skuCode, skuCodeLabelVisible) : getAdaptiveWidthStyle('SKU编号', 56)"
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
      :style="getAdaptiveSelectStyle(filters.customer, '客户', 42)"
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
      popper-class="order-type-tree-popper"
      filterable
      clearable
      check-strictly
      default-expand-all
      :render-after-expand="false"
      node-key="value"
      :props="{ label: 'label', value: 'value', children: 'children', disabled: 'disabled' }"
      size="large"
      class="filter-bar-item"
      :style="getAdaptiveSelectStyle(filters.orderTypeId && `订单类型：${findOrderTypeLabelById(filters.orderTypeId)}`, '订单类型')"
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
      popper-class="process-item-tree-popper"
      filterable
      clearable
      check-strictly
      :props="{ label: 'label', value: 'value', children: 'children' }"
      size="large"
      class="filter-bar-item"
      :style="getAdaptiveSelectStyle(filters.processItem && `工艺项目：${getProcessItemDisplayLabel(filters.processItem)}`, '工艺项目')"
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
      :style="getAdaptiveSelectStyle(filters.salesperson ? `业务员：${filters.salesperson}` : '', '业务员', 36)"
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
      :style="getAdaptiveSelectStyle(filters.merchandiser ? `跟单员：${filters.merchandiser}` : '', '跟单员', 36)"
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
    <div
      class="filter-bar-item filter-date-box"
      :class="{ 'is-active': orderDateRange }"
      :style="getAdaptiveRangeStyle(orderDateRange, '下单时间')"
    >
      <span
        v-if="orderDateRange"
        class="filter-date-label-text"
        :style="{ color: ACTIVE_FILTER_COLOR }"
      >下单时间：</span>
      <el-date-picker
        v-model="orderDateRange"
        type="daterange"
        :range-separator="orderDateRange ? '~' : ''"
        start-placeholder="下单时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        clearable
        size="large"
        :class="['filter-range', { 'range-single': !orderDateRange }]"
        @change="onSearch()"
      />
    </div>
    <div
      class="filter-bar-item filter-date-box"
      :class="{ 'is-active': completedRange }"
      :style="getAdaptiveRangeStyle(completedRange, '完成时间')"
    >
      <span
        v-if="completedRange"
        class="filter-date-label-text"
        :style="{ color: ACTIVE_FILTER_COLOR }"
      >完成时间：</span>
      <el-date-picker
        v-model="completedRange"
        type="daterange"
        :range-separator="completedRange ? '~' : ''"
        start-placeholder="完成时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        clearable
        size="large"
        :class="['filter-range', { 'range-single': !completedRange }]"
        @change="onSearch()"
      />
    </div>
    <el-select
      v-model="filters.factory"
      placeholder="加工供应商"
      filterable
      clearable
      size="large"
      class="filter-bar-item"
      :style="getAdaptiveSelectStyle(filters.factory && `加工供应商：${filters.factory}`, '加工供应商')"
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
import { ACTIVE_FILTER_COLOR, getFilterInputStyle, getOrderNoFilterStyle, getSkuCodeFilterStyle } from '@/composables/useFilterBarHelpers'
import { rangeShortcuts } from '@/utils/date-shortcuts'

const FILTER_CHAR_PX = 14
const ACTIVE_SELECT_STYLE = { '--el-text-color-regular': ACTIVE_FILTER_COLOR }

function getAdaptiveWidthStyle(text: unknown, extraPadding = 60) {
  const raw = String(text ?? '').trim() || ' '
  const width = raw.length * FILTER_CHAR_PX + extraPadding
  return { width: `${width}px`, minWidth: 'unset', flex: `0 0 ${width}px` }
}

function getAdaptiveSelectStyle(value: unknown, placeholder: string, extraPadding = 60) {
  const text = value ? String(value) : placeholder
  const base = getAdaptiveWidthStyle(text, extraPadding)
  return value ? { ...base, ...ACTIVE_SELECT_STYLE } : base
}

function getAdaptiveRangeStyle(range: [string, string] | [] | null | undefined, placeholder: string) {
  const hasValue = Array.isArray(range) && range.length === 2
  if (hasValue) {
    // 有值：标签(5中文×14px) + 日期选择器内容(日历图标+两个日期+分隔符+清除图标)
    return { width: '320px', minWidth: 'unset', flex: '0 0 320px', ...ACTIVE_SELECT_STYLE }
  }
  // 无值：日历图标(~25px) + 外边距(16px) + 文字 + 呼吸空间(19px)
  return getAdaptiveWidthStyle(placeholder, 60)
}

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
  gap: 2px;
  padding: var(--space-sm);
  margin-bottom: var(--space-md);
  border-radius: var(--radius-lg);
  background-color: var(--color-bg-subtle, #f5f6f8);
}

.filter-bar-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}

/* 试点：保持 size=large，但压缩 3 档内边距，减少占位 */
.filter-bar :deep(.el-input__wrapper),
.filter-bar :deep(.el-select__wrapper),
.filter-bar :deep(.el-date-editor.el-input__wrapper) {
  padding-left: 8px;
  padding-right: 8px;
}

.filter-bar-actions :deep(.el-button--large) {
  padding-left: 8px;
  padding-right: 8px;
}

.filter-bar :deep(.filter-bar-item) {
  min-width: unset !important;
}

.filter-bar :deep(.el-input__prefix) {
  margin-right: 0;
}

/* ── 日期选择器 wrapper（用于在有值时显示字段标签）── */
.filter-date-box {
  display: flex;
  align-items: center;
  background: var(--el-fill-color-blank);
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
  border-radius: var(--el-border-radius-base);
  padding: 0 8px;
  height: 40px;
  box-sizing: border-box;
  cursor: text;
  transition: box-shadow 0.2s;
  flex-shrink: 0;
  overflow: visible;
}

.filter-date-box:hover {
  box-shadow: 0 0 0 1px var(--el-text-color-secondary) inset;
}

.filter-date-box.is-active {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.filter-date-label-text {
  font-size: 14px;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1;
  pointer-events: none;
}

/* 内层日期选择器：去掉边框和背景，融入 wrapper
   必须覆盖 Element Plus 默认的 width: 350px，否则 picker 会溢出 wrapper */
.filter-date-box :deep(.el-date-editor.el-input__wrapper) {
  box-shadow: none !important;
  background: transparent !important;
  padding-left: 0 !important;
  padding-right: 0 !important;
  width: 100% !important;
  flex: 1 !important;
  min-width: 0 !important;
}
</style>

<!-- 全局样式块：
     1. popper/teleport 元素在 body 外，scoped :deep() 无法命中，必须用全局样式
     2. range-single 类挂在 el-date-picker 根元素上，scoped 选择器可能因
        inheritAttrs 差异导致 data-v-xxx 命中不稳定，同样放全局保证可靠 -->
<style>
/* ── 订单类型 / 工艺项目 树形下拉面板 ── */
.order-type-tree-popper.el-popper {
  min-width: 200px !important;
  width: max-content !important;
  max-width: 440px;
}
/* 修复 el-scrollbar 的 overflow-x:hidden 裁剪树节点文字 */
.order-type-tree-popper .el-scrollbar__wrap {
  overflow-x: auto !important;
}
.order-type-tree-popper .el-scrollbar__view {
  min-width: 100%;
}
/* min-width:max-content 让节点盒子撑开至文字宽度，fit-content 才能正确计算 */
.order-type-tree-popper .el-tree-node__content {
  min-width: max-content;
}
.order-type-tree-popper .el-tree-node__label {
  white-space: nowrap;
  color: var(--el-text-color-regular);
}
.order-type-tree-popper .el-tree-node.is-current > .el-tree-node__content .el-tree-node__label {
  color: var(--el-color-primary);
}

.process-item-tree-popper .el-tree-node__label {
  color: var(--el-text-color-regular);
}
.process-item-tree-popper .el-tree-node.is-current > .el-tree-node__content .el-tree-node__label {
  color: var(--el-color-primary);
}

/* ── 日期选择器空态（未筛选）：隐藏第二个输入和分隔符，让第一个占满 ──
   注意：daterange 的首子元素是日历图标 <i>，不是 <input>，
   :first-child/:last-child 无法命中输入框，必须用 :first-of-type/:last-of-type */
.range-single.el-date-editor--daterange .el-range-separator {
  display: none !important;
}
.range-single.el-date-editor--daterange .el-range-input:last-of-type {
  display: none !important;
}
.range-single.el-date-editor--daterange .el-range-input:first-of-type {
  flex: 1 !important;
  width: auto !important;
  min-width: 0 !important;
}
.range-single.el-date-editor--daterange .el-range__close-icon {
  display: none !important;
}
/* 确保 filter-date-box 内的 date-editor wrapper 不带内边距 */
.filter-date-box .el-date-editor.el-input__wrapper {
  padding-left: 0 !important;
  padding-right: 0 !important;
}
</style>

<template>
  <div class="filter-bar has-filter-collapse">
    <el-input
      v-model="filters.orderNo"
      placeholder="订单号"
      clearable
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
    <FilterCollapseToggle v-model:collapsed="collapsed" :active-count="activeFilterCount" />
    <div class="filter-rest" v-show="!isMobile || !collapsed">
    <el-select
      v-model="filters.customer"
      placeholder="客户"
      filterable
      clearable
      class="filter-bar-item"
      :style="getAdaptiveSelectStyle(filters.customer ? `客户：${filters.customer}` : '', '客户', 48)"
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
      class="filter-bar-item"
      :style="getAdaptiveSelectStyle(filters.orderTypeId && `订单类型：${findOrderTypeLabelById(filters.orderTypeId)}`, '订单类型')"
      @change="onSearch()"
      @visible-change="(v: boolean) => v && adjustTreePopperWidth('order-type-tree-popper')"
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
    <el-select
      v-model="filters.collaborationTypeId"
      placeholder="合作方式"
      filterable
      clearable
      class="filter-bar-item"
      :style="getAdaptiveSelectStyle(filters.collaborationTypeId && `合作方式：${findCollaborationLabelById(filters.collaborationTypeId)}`, '合作方式')"
      @change="onSearch()"
    >
      <template #label="{ label }">
        <span v-if="filters.collaborationTypeId">合作方式：{{ label }}</span>
        <span v-else>{{ label }}</span>
      </template>
      <el-option
        v-for="opt in collaborationOptions"
        :key="opt.id"
        :label="opt.value"
        :value="opt.id"
      />
    </el-select>
    <el-tree-select
      v-model="filters.processItem"
      :data="processOptions"
      placeholder="工艺项目"
      popper-class="process-item-tree-popper"
      filterable
      clearable
      check-strictly
      default-expand-all
      :render-after-expand="false"
      :props="{ label: 'label', value: 'value', children: 'children' }"
      class="filter-bar-item"
      :style="getAdaptiveSelectStyle(filters.processItem && `工艺项目：${getProcessItemDisplayLabel(filters.processItem)}`, '工艺项目')"
      @change="onSearch()"
      @visible-change="(v: boolean) => v && adjustTreePopperWidth('process-item-tree-popper')"
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
      class="filter-bar-item"
      :style="getAdaptiveSelectStyle(filters.salesperson ? `业务员：${filters.salesperson}` : '', '业务员', 42)"
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
      class="filter-bar-item"
      :style="getAdaptiveSelectStyle(filters.merchandiser ? `跟单员：${filters.merchandiser}` : '', '跟单员', 42)"
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
        :name="['orderDateStart', 'orderDateEnd']"
        :range-separator="orderDateRange ? '~' : ''"
        start-placeholder="下单时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        clearable
        :class="['filter-range', { 'range-single': !orderDateRange }]"
        @change="onSearch()"
      />
    </div>
    <div
      class="filter-bar-item filter-date-box"
      :class="{ 'is-active': customerDueRange }"
      :style="getAdaptiveRangeStyle(customerDueRange, '客户交期')"
    >
      <span
        v-if="customerDueRange"
        class="filter-date-label-text"
        :style="{ color: ACTIVE_FILTER_COLOR }"
      >客户交期：</span>
      <el-date-picker
        v-model="customerDueRange"
        type="daterange"
        :name="['customerDueStart', 'customerDueEnd']"
        :range-separator="customerDueRange ? '~' : ''"
        start-placeholder="客户交期"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        clearable
        :class="['filter-range', { 'range-single': !customerDueRange }]"
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
        :name="['completedDateStart', 'completedDateEnd']"
        :range-separator="completedRange ? '~' : ''"
        start-placeholder="完成时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        clearable
        :class="['filter-range', { 'range-single': !completedRange }]"
        @change="onSearch()"
      />
    </div>
    <el-select
      v-model="filters.factory"
      placeholder="加工供应商"
      filterable
      clearable
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
    </div>

    <div class="filter-bar-actions">
      <el-button type="primary" @click="onSearch(true)">搜索</el-button>
      <el-button @click="onReset">清空</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ACTIVE_FILTER_COLOR,
  ACTIVE_SELECT_STYLE,
  getAdaptiveWidthStyle,
  getAdaptiveSelectStyle,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
} from '@/composables/useFilterBarHelpers'
import { useTreeSelectAdjust } from '@/composables/useTreeSelectAdjust'
import { useFilterCollapse } from '@/composables/useFilterCollapse'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { computed } from 'vue'
import FilterCollapseToggle from '@/components/common/FilterCollapseToggle.vue'

const { adjustTreePopperWidth } = useTreeSelectAdjust()
const { collapsed, isMobile } = useFilterCollapse('orders-list')

function getAdaptiveRangeStyle(range: [string, string] | [] | null | undefined, placeholder: string) {
  const hasValue = Array.isArray(range) && range.length === 2
  if (hasValue) {
    return { width: '320px', minWidth: 'unset', flex: '0 0 320px', ...ACTIVE_SELECT_STYLE }
  }
  return getAdaptiveWidthStyle(placeholder, 60)
}

interface OrderListFilters {
  orderNo: string
  skuCode: string
  customer: string
  orderTypeId: number | null
  collaborationTypeId: number | null
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
const customerDueRange = defineModel<[string, string] | null>('customerDueRange', { required: true })
const completedRange = defineModel<[string, string] | null>('completedRange', { required: true })
const orderNoLabelVisible = defineModel<boolean>('orderNoLabelVisible', { required: true })
const skuCodeLabelVisible = defineModel<boolean>('skuCodeLabelVisible', { required: true })

const activeFilterCount = computed(() => {
  const f = filters.value
  let n = 0
  if (f.orderNo) n++
  if (f.skuCode) n++
  if (f.customer) n++
  if (f.orderTypeId != null) n++
  if (f.collaborationTypeId != null) n++
  if (f.processItem) n++
  if (f.salesperson) n++
  if (f.merchandiser) n++
  if (f.factory) n++
  if (orderDateRange.value) n++
  if (customerDueRange.value) n++
  if (completedRange.value) n++
  return n
})

defineProps<{
  customerOptions: Array<{ label: string; value: string }>
  orderTypeTreeSelectData: OrderTypeTreeSelectNode[]
  collaborationOptions: Array<{ id: number; value: string }>
  processOptions: Array<Record<string, unknown>>
  salespersonOptions: string[]
  merchandiserOptions: string[]
  factoryOptions: Array<{ label: string; value: string }>
  findOrderTypeLabelById: (id: number) => string
  findCollaborationLabelById: (id: number) => string
  getProcessItemDisplayLabel: (value: string) => string
  onSearch: (byUser?: boolean) => void
  onReset: () => void
  debouncedSearch: () => void
}>()
</script>


<!-- 全局样式块：popper/teleport 元素在 body 外，scoped :deep() 无法命中，必须用全局样式 -->
<style>
/* ── 订单类型 / 工艺项目 树形下拉面板 ──
   宽度由 JS adjustTreePopperWidth() 在 visible-change 后动态注入（见 script）。
   el-tree-select 的节点渲染为 .el-select-dropdown__item，El Plus 已内置 white-space:nowrap
   和 is-selected 高亮色，此处只设 max-width 上限即可。 */
.order-type-tree-popper.el-popper,
.process-item-tree-popper.el-popper {
  max-width: 440px;
}
</style>

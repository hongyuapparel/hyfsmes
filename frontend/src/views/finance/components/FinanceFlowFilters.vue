<template>
  <div class="filter-bar has-filter-collapse">
    <div class="filter-bar-item filter-date-box" :class="{ 'is-active': filter.occurDateRange }" :style="getFilterRangeStyle(filter.occurDateRange, dateLabel)">
      <span v-if="filter.occurDateRange" class="filter-date-label-text" :style="{ color: ACTIVE_FILTER_COLOR }">{{ dateLabel }}：</span>
      <el-date-picker v-model="filter.occurDateRange" type="daterange" :range-separator="filter.occurDateRange ? '~' : ''" :start-placeholder="dateLabel" end-placeholder="" value-format="YYYY-MM-DD" :shortcuts="rangeShortcuts" unlink-panels clearable :class="['filter-range', { 'range-single': !filter.occurDateRange }]" @change="emit('search')" />
    </div>
    <el-input v-model="filter.keyword" :placeholder="partyLabel" clearable class="filter-bar-item" :style="getAdaptiveSelectStyle(filter.keyword, partyLabel)" @keyup.enter="emit('search')" @clear="emit('search')" />
    <FilterCollapseToggle v-model:collapsed="collapsed" :active-count="activeCount" />
    <div class="filter-rest" v-show="!isMobile || !collapsed">
      <el-select v-model="filter.fundAccountId" :placeholder="'资金账户'" clearable filterable class="filter-bar-item" :style="getAdaptiveSelectStyle(filter.fundAccountId != null ? '资金账户' + '：' + (accounts.find(item => item.id === filter.fundAccountId)?.name ?? '') : '', '资金账户')" @change="emit('search')">
        <template #label="{ label }">{{ '资金账户' }}：{{ label }}</template>
        <el-option v-for="item in accounts" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-select v-model="filter.departmentId" :placeholder="'归属部门'" clearable filterable class="filter-bar-item" :style="getAdaptiveSelectStyle(filter.departmentId != null ? '归属部门' + '：' + (departments.find(item => item.id === filter.departmentId)?.value ?? '') : '', '归属部门')" @change="emit('search')">
        <template #label="{ label }">{{ '归属部门' }}：{{ label }}</template>
        <el-option :value="0" label="待归属" /><el-option v-if="filter.departmentId && !departments.some(item=>item.id===filter.departmentId)" :value="filter.departmentId" :label="'未知部门 #' + filter.departmentId" />
        <el-option v-for="item in departments" :key="item.id" :label="item.value" :value="item.id" />
      </el-select>
      <el-select v-model="filter.typeId" :placeholder="typeLabel" clearable filterable class="filter-bar-item" :style="getAdaptiveSelectStyle(filter.typeId != null ? typeLabel + '：' + (types.find(item => item.id === filter.typeId)?.name ?? '') : '', typeLabel)" @change="emit('search')">
        <template #label="{ label }">{{ typeLabel }}：{{ label }}</template>
        <el-option v-for="item in types" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-select v-model="filter.cashKind" placeholder="收支性质" clearable class="filter-bar-item" style="width:140px" @change="emit('search')"><el-option v-for="item in CASH_KIND_OPTIONS" :key="item.value" :value="item.value" :label="item.label" /></el-select>
      <el-input v-model="filter.orderNo" placeholder="订单号" clearable class="filter-bar-item" :style="getAdaptiveSelectStyle(filter.orderNo, '订单号')" @keyup.enter="emit('search')" @clear="emit('search')" />
    </div>
    <div class="filter-bar-actions"><el-button type="primary" @click="emit('search')">查询</el-button><el-button @click="emit('reset')">清空</el-button></div>
  </div>
</template>
<script setup lang="ts">
import { CASH_KIND_OPTIONS } from '@/api/finance-control'
import { computed } from 'vue'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { ACTIVE_FILTER_COLOR, getFilterRangeStyle, getAdaptiveSelectStyle } from '@/composables/useFilterBarHelpers'
import { useFilterCollapse } from '@/composables/useFilterCollapse'
import FilterCollapseToggle from '@/components/common/FilterCollapseToggle.vue'
import type { FinanceDepartmentOption, FinanceFundAccount } from '@/api/finance'
const props = defineProps<{
  income: boolean
  filter: { occurDateRange: [string, string] | null; typeId: number | null; fundAccountId: number | null; departmentId: number | null; keyword: string; orderNo: string; cashKind: string }
  types: { id: number; name: string }[]
  accounts: FinanceFundAccount[]
  departments: FinanceDepartmentOption[]
}>()
const emit = defineEmits<{ search: []; reset: [] }>()
const { collapsed, isMobile } = useFilterCollapse(props.income ? 'finance-income' : 'finance-expense')
const dateLabel = computed(() => props.income ? '收款日期' : '付款日期')
const partyLabel = computed(() => props.income ? '付款方' : '收款方')
const typeLabel = computed(() => props.income ? '收入类型' : '支出类型')
const activeCount = computed(() => Object.entries(props.filter).filter(([key,v]) => key !== 'deleted' && v !== null && v !== '').length)
</script>

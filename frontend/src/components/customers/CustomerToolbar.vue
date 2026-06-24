<template>
  <div class="filter-bar">
    <el-input
      v-model="companyNameModel"
      placeholder="公司名称或联系人"
      clearable
      class="filter-bar-item"
      :style="getTextFilterStyle('名称/联系人：', companyNameModel, companyNameLabelVisible)"
      :input-style="getFilterInputStyle(companyNameModel)"
      @input="$emit('company-name-input')"
      @keyup.enter="$emit('search', true)"
    >
      <template #prefix>
        <span
          v-if="companyNameModel && companyNameLabelVisible"
          :style="{ color: ACTIVE_FILTER_COLOR }"
        >
          名称/联系人：
        </span>
      </template>
    </el-input>

    <el-select
      v-model="salespersonModel"
      placeholder="业务员"
      clearable
      filterable
      class="filter-bar-item"
      :style="getAdaptiveSelectStyle(salespersonModel ? `业务员：${salespersonModel}` : '', '业务员', 42)"
      @change="$emit('search', false)"
    >
      <template #label="{ label }">
        <span v-if="salespersonModel">业务员：{{ label }}</span>
        <span v-else>{{ label }}</span>
      </template>
      <el-option v-for="sales in salespeople" :key="sales" :label="sales" :value="sales" />
    </el-select>

    <div class="filter-bar-actions">
      <el-button type="primary" @click="$emit('search', true)">搜索</el-button>
      <el-button @click="$emit('reset')">清空</el-button>
      <el-button type="primary" @click="$emit('create')">新建客户</el-button>
      <el-tooltip v-if="selectedCount" content="删除" placement="top">
        <el-button
          type="danger"
          circle
          aria-label="Delete selected customers"
          @click="$emit('batch-delete')"
        >
          <el-icon><Delete /></el-icon>
        </el-button>
      </el-tooltip>
      <el-button type="primary" plain @click="$emit('open-xiaoman')">
        从小满导入
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getAdaptiveSelectStyle,
  getTextFilterStyle,
} from '@/composables/useFilterBarHelpers'

const props = defineProps<{
  companyName: string
  salesperson: string
  salespeople: string[]
  selectedCount: number
  companyNameLabelVisible: boolean
}>()

const emit = defineEmits<{
  (event: 'update:companyName', value: string): void
  (event: 'update:salesperson', value: string): void
  (event: 'company-name-input'): void
  (event: 'search', byUser: boolean): void
  (event: 'reset'): void
  (event: 'create'): void
  (event: 'batch-delete'): void
  (event: 'open-xiaoman'): void
}>()

const companyNameModel = computed({
  get: () => props.companyName,
  set: (value: string) => emit('update:companyName', value),
})

const salespersonModel = computed({
  get: () => props.salesperson,
  set: (value: string) => emit('update:salesperson', value),
})
</script>

<style scoped>
</style>

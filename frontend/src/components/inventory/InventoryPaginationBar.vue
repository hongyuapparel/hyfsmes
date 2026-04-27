<template>
  <div
    class="pagination-wrap"
    :class="{ 'pagination-wrap--with-summary': hasSummary }"
  >
    <div v-if="hasSummary" class="pagination-summary">
      <span>{{ summaryLabel }}：{{ totalQuantity }}<template v-if="unit"> {{ unit }}</template></span>
      <span v-if="totalAmount !== undefined" class="pagination-summary-amount">总金额：¥{{ formatDisplayNumber(totalAmount) }}</span>
    </div>
    <el-pagination
      :current-page="currentPage"
      :page-size="pageSize"
      :total="total"
      :page-sizes="pageSizes"
      layout="total, sizes, prev, pager, next"
      @update:current-page="emit('update:currentPage', $event)"
      @update:page-size="emit('update:pageSize', $event)"
      @current-change="emit('current-change', $event)"
      @size-change="emit('size-change', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDisplayNumber } from '@/utils/display-number'

const props = defineProps<{
  currentPage: number
  pageSize: number
  total: number
  pageSizes?: number[]
  totalQuantity?: number
  unit?: string
  summaryLabel?: string
  totalAmount?: number
}>()

const emit = defineEmits<{
  (e: 'update:currentPage', val: number): void
  (e: 'update:pageSize', val: number): void
  (e: 'current-change', val: number): void
  (e: 'size-change', val: number): void
}>()

const hasSummary = computed(() => props.totalQuantity !== undefined)

defineOptions({ name: 'InventoryPaginationBar' })
</script>

<style scoped>
.pagination-summary-amount {
  margin-left: var(--space-md);
}
</style>

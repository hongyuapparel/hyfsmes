<template>
  <div
    class="pagination-wrap"
    :class="{ 'pagination-wrap--with-summary': hasSummary }"
  >
    <div v-if="hasSummary" class="pagination-summary">
      <span>{{ summaryText }}</span>
      <span v-if="totalAmount !== undefined" class="pagination-summary-amount">
        总金额：¥{{ formatDisplayNumber(totalAmount) }}
      </span>
    </div>
    <div class="pagination-controls">
      <span v-if="hasSummary" class="pagination-total">Total {{ total }}</span>
      <el-pagination
        v-model:current-page="currentPageModel"
        v-model:page-size="pageSizeModel"
        :total="total"
        :page-sizes="pageSizes"
        :layout="paginationLayout"
        @current-change="emit('current-change', $event)"
        @size-change="emit('size-change', $event)"
      />
    </div>
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
const paginationLayout = computed(() =>
  hasSummary.value ? 'sizes, prev, pager, next' : 'total, sizes, prev, pager, next',
)
const currentPageModel = computed({
  get: () => props.currentPage,
  set: (value: number) => emit('update:currentPage', value),
})
const pageSizeModel = computed({
  get: () => props.pageSize,
  set: (value: number) => emit('update:pageSize', value),
})
const summaryText = computed(() => {
  const label = props.summaryLabel || '总件数'
  const quantity = props.totalQuantity ?? 0
  return `${label}：${formatDisplayNumber(quantity)}${props.unit ? ` ${props.unit}` : ''}`
})

defineOptions({ name: 'AppPaginationBar' })
</script>

<style scoped>
.pagination-controls {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-left: auto;
  flex-shrink: 0;
}

.pagination-total {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.pagination-summary-amount {
  margin-left: var(--space-md);
}
</style>

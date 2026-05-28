<template>
  <el-tooltip
    v-if="detail && detail.headers.length"
    placement="top"
    effect="light"
    :show-after="250"
    :hide-after="0"
    popper-class="acc-qty-popper"
  >
    <template #content>
      <div class="acc-qty-grid" :style="{ '--acc-qty-cols': String(detail.headers.length) }">
        <div v-for="(h, i) in detail.headers" :key="`h-${i}`" class="acc-qty-cell acc-qty-head">{{ h }}</div>
        <div
          v-for="(q, i) in detail.quantities"
          :key="`q-${i}`"
          class="acc-qty-cell"
          :class="{ negative: Number(q) < 0 }"
        >
          {{ formatDisplayNumber(q) }}
        </div>
      </div>
    </template>
    <span class="acc-qty-value acc-qty-hover" :class="{ negative: value < 0 }">{{ formatDisplayNumber(value) }}</span>
  </el-tooltip>
  <span v-else class="acc-qty-value" :class="{ negative: value < 0 }">{{ formatDisplayNumber(value) }}</span>
</template>

<script setup lang="ts">
import { formatDisplayNumber } from '@/utils/display-number'

defineProps<{
  value: number
  detail: { headers: string[]; quantities: number[] } | null
}>()
</script>

<style scoped>
.acc-qty-value { cursor: default; }
.acc-qty-hover { cursor: help; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; }
.acc-qty-value.negative { color: var(--el-color-danger); font-weight: 600; }
.acc-qty-grid {
  display: grid;
  grid-template-columns: repeat(var(--acc-qty-cols, 1), minmax(44px, 1fr));
  gap: 2px;
}
.acc-qty-cell { padding: 2px 8px; text-align: center; border: 1px solid var(--el-border-color-lighter); }
.acc-qty-head { font-weight: 600; background: var(--el-fill-color-light); }
.acc-qty-cell.negative { color: var(--el-color-danger); font-weight: 600; }
</style>

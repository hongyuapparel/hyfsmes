<template>
  <div class="cutting-basic-bar" role="group" aria-label="订单摘要">
    <div class="cutting-basic-bar__grid">
      <div class="cutting-basic-bar__item">
        <span class="cutting-basic-bar__label">订单号</span>
        <span class="cutting-basic-bar__value">{{ display(orderBrief.orderNo) }}</span>
      </div>
      <div class="cutting-basic-bar__item">
        <span class="cutting-basic-bar__label">SKU</span>
        <span class="cutting-basic-bar__value">{{ display(orderBrief.skuCode) }}</span>
      </div>
      <div class="cutting-basic-bar__item">
        <span class="cutting-basic-bar__label">订单数量</span>
        <span class="cutting-basic-bar__value">{{ formatDisplayNumber(orderBrief.quantity) }}</span>
      </div>
      <div v-if="showExtended" class="cutting-basic-bar__item">
        <span class="cutting-basic-bar__label">客户</span>
        <span class="cutting-basic-bar__value">{{ display(orderBrief.customerName) }}</span>
      </div>
      <div v-if="showExtended" class="cutting-basic-bar__item">
        <span class="cutting-basic-bar__label">下单日期</span>
        <span class="cutting-basic-bar__value">{{ display(orderBrief.orderDate) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDisplayNumber } from '@/utils/display-number'

export interface CuttingOrderBrief {
  orderNo: string
  skuCode: string
  quantity: number
  customerName: string
  orderDate: string | null
}

defineProps<{
  orderBrief: CuttingOrderBrief
  /** 为 true 时额外展示客户、下单日期 */
  showExtended?: boolean
}>()

function display(v: string | null | undefined) {
  const s = (v ?? '').trim()
  return s || '—'
}
</script>

<style scoped>
.cutting-basic-bar {
  margin-bottom: var(--space-md);
  padding: 10px 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--radius);
  border: 1px solid var(--el-border-color-lighter);
}

.cutting-basic-bar__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px 20px;
  align-items: baseline;
}

.cutting-basic-bar__item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
}

.cutting-basic-bar__label {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  min-width: 4.5em;
}

.cutting-basic-bar__value {
  color: var(--el-text-color-primary);
  font-weight: 500;
  min-width: 0;
  word-break: break-all;
}
</style>

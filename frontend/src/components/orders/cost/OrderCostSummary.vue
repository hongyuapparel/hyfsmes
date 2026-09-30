<template>
  <div class="cost-order-summary" :class="{ 'is-loading': !ready }">
    <div v-if="ready" class="cost-order-image">
      <AppImageThumb :raw-url="images[0] || ''" :width="48" :height="48" :preview-gallery="images" empty-text="暂无图片" />
      <span v-if="images.length">共 {{ images.length }} 张</span>
    </div>
    <div class="cost-summary-heading">
      <slot name="heading" />
      <span v-if="ready" class="cost-summary-notice">{{ notice }}</span>
    </div>
    <div v-if="ready" class="cost-order-info">
      <div class="order-summary">
        <span><strong>客户：</strong>{{ order?.customerName || '-' }}</span>
        <span><strong>订单数量：</strong>{{ formatDisplayNumber(order?.quantity ?? 0) }} 件</span>
        <span><strong>当前销售单价：</strong>{{ order?.salePrice || '-' }} 元</span>
        <span><strong>已确认出厂单价：</strong>{{ order?.exFactoryPrice || '-' }} 元</span>
      </div>
    </div>
    <div v-if="ready" class="cost-order-actions"><slot /></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OrderDetail } from '@/api/orders'
import AppImageThumb from '@/components/AppImageThumb.vue'
import { formatDisplayNumber } from '@/utils/display-number'
import { orderCostImages } from '@/utils/order-cost-review'

const props = defineProps<{ order: OrderDetail | null; notice: string; ready: boolean }>()
const images = computed(() => orderCostImages(props.order))
</script>

<style scoped>
.cost-order-summary { display: grid; grid-template-columns: 48px minmax(0, 1fr); align-items: center; gap: var(--space-xs) var(--space-sm); }
.cost-order-summary.is-loading { grid-template-columns: minmax(0, 1fr); }
.cost-order-image { grid-row: span 2; display: grid; text-align: center; font-size: var(--font-size-caption); color: var(--el-text-color-secondary); }
.cost-summary-heading { grid-column: -2 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: calc(var(--space-xs) / 2) var(--space-sm); min-width: 0; }
.cost-order-info { grid-column: 2; min-width: 0; }
.cost-order-actions { grid-column: 1 / -1; min-width: 0; padding-top: var(--space-xs); border-top: 1px solid var(--el-border-color-lighter); }
.order-summary { display: flex; flex-wrap: wrap; gap: calc(var(--space-xs) / 2) var(--space-sm); overflow-wrap: anywhere; }
.cost-summary-notice { margin-left: auto; color: var(--el-text-color-secondary); font-size: var(--font-size-caption); overflow-wrap: anywhere; }
@media (max-width: 600px) {
  .cost-summary-notice { margin-left: 0; }
}
</style>

<template>
  <el-card class="block-card" shadow="never">
    <div class="cost-order-summary">
      <div class="cost-order-image">
        <AppImageThumb :raw-url="images[0] || ''" :width="88" :height="88" :preview-gallery="images" empty-text="暂无图片" />
        <span v-if="images.length">共 {{ images.length }} 张 · 点击查看</span>
      </div>
      <div class="cost-order-info">
        <div class="order-summary">
          <span><strong>客户：</strong>{{ order?.customerName || '-' }}</span>
          <span><strong>订单数量：</strong>{{ formatDisplayNumber(order?.quantity ?? 0) }} 件</span>
          <span><strong>当前销售单价：</strong>{{ order?.salePrice || '-' }} 元</span>
          <span><strong>已确认出厂单价：</strong>{{ order?.exFactoryPrice || '-' }} 元</span>
        </div>
        <p class="cost-summary-notice">{{ notice }}</p>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OrderDetail } from '@/api/orders'
import AppImageThumb from '@/components/AppImageThumb.vue'
import { formatDisplayNumber } from '@/utils/display-number'
import { orderCostImages } from '@/utils/order-cost-review'

const props = defineProps<{ order: OrderDetail | null; notice: string }>()
const images = computed(() => orderCostImages(props.order))
</script>

<style scoped>
.cost-order-summary { display: flex; align-items: center; gap: var(--space-lg); }
.cost-order-image { flex: none; display: grid; gap: var(--space-xs); text-align: center; font-size: var(--font-size-caption); color: var(--el-text-color-secondary); }
.cost-order-info { min-width: 0; }
.order-summary { display: flex; flex-wrap: wrap; gap: var(--space-md); }
.cost-summary-notice { margin-bottom: 0; color: var(--el-color-warning); font-size: var(--font-size-caption); }
</style>

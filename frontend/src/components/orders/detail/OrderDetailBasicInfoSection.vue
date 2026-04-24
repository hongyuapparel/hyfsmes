<template>
  <div class="block-body block-body-a">
    <div class="kv-grid">
      <div v-if="detail.skuCode" class="kv-item">
        <span class="kv-label">SKU</span>
        <span class="kv-value">{{ detail.skuCode }}</span>
      </div>
      <div v-if="detail.xiaomanOrderNo" class="kv-item">
        <span class="kv-label">小满单号</span>
        <span class="kv-value ellipsis">{{ detail.xiaomanOrderNo }}</span>
      </div>
      <div v-if="collaborationDisplay" class="kv-item">
        <span class="kv-label">合作方式</span>
        <span class="kv-value">{{ collaborationDisplay }}</span>
      </div>
      <div v-if="orderTypeDisplay" class="kv-item">
        <span class="kv-label">订单类型</span>
        <span class="kv-value ellipsis">{{ orderTypeDisplay }}</span>
      </div>
      <div v-if="detail.customerName" class="kv-item">
        <span class="kv-label">客户</span>
        <span class="kv-value ellipsis">{{ detail.customerName }}</span>
      </div>
      <div v-if="detail.customerDueDate" class="kv-item">
        <span class="kv-label">客户交期</span>
        <span class="kv-value">{{ formatDate(detail.customerDueDate) }}</span>
      </div>
      <div v-if="detail.merchandiser" class="kv-item">
        <span class="kv-label">跟单员</span>
        <span class="kv-value">{{ detail.merchandiser }}</span>
      </div>
      <div v-if="detail.merchandiserPhone" class="kv-item">
        <span class="kv-label">跟单电话</span>
        <span class="kv-value">{{ detail.merchandiserPhone }}</span>
      </div>
      <div v-if="detail.salesperson" class="kv-item">
        <span class="kv-label">业务员</span>
        <span class="kv-value">{{ detail.salesperson }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OrderDetail } from '@/api/orders'
import { formatDate } from '@/utils/date-format'

defineProps<{
  detail: OrderDetail
  collaborationDisplay: string
  orderTypeDisplay: string
}>()
</script>

<style scoped>
.block-body {
  border: 1px solid #dcdfe6;
  border-radius: 2px;
  padding: 6px 8px;
}

.block-body-a {
  flex-shrink: 0;
}

.kv-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 2px 8px;
}

.kv-item {
  display: flex;
  gap: 4px;
  font-size: 12px;
}

.kv-label {
  flex-shrink: 0;
  color: #303133;
}

.kv-value {
  flex: 1;
  min-width: 0;
}

.kv-value.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

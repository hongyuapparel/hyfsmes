<template>
  <div class="orders-card-list" v-loading="loading">
    <el-empty v-if="!loading && !list.length" description="暂无订单" />
    <div v-else class="order-card-grid">
      <OrderCard
        v-for="item in list"
        :key="item.id"
        :item="item"
        :card-selected="cardSelected"
        :size-popover-loading-id="sizePopoverLoadingId"
        :size-breakdown-cache="sizeBreakdownCache"
        :get-status-tag-type="getStatusTagType"
        :get-status-label="getStatusLabel"
        :format-date-time="formatDateTime"
        :format-date="formatDate"
        :get-customer-due-date-class="getCustomerDueDateClass"
        :is-sample-order="isSampleOrder"
        :get-size-popover-width="getSizePopoverWidth"
        :size-popover-blocks="sizePopoverBlocks"
        :get-order-meta-tags="getOrderMetaTags"
        :can-edit-order-item="canEditOrderItem"
        @toggle-select="(id, val) => emit('toggle-select', id, val)"
        @show-size-popover="(order) => emit('show-size-popover', order)"
        @edit="(order) => emit('edit', order)"
        @cost="(order) => emit('cost', order)"
        @remark="(order) => emit('remark', order)"
        @operation-log="(order) => emit('operation-log', order)"
        @print="(order) => emit('print', order)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import OrderCard from './OrderCard.vue'
import type { OrderListItem, OrderSizeBreakdownRes } from '@/api/orders'

interface SizePopoverBlockRow {
  label: string
  values: Array<number | null>
}

interface SizePopoverBlock {
  colorName: string
  rows: SizePopoverBlockRow[]
}

defineProps<{
  loading: boolean
  list: OrderListItem[]
  cardSelected: Record<number, boolean>
  sizePopoverLoadingId: number | null
  sizeBreakdownCache: Record<number, OrderSizeBreakdownRes>
  getStatusTagType: (status: string) => 'success' | 'warning' | 'info' | 'danger' | 'primary' | undefined
  getStatusLabel: (status: string) => string
  formatDateTime: (value: string | null | undefined) => string
  formatDate: (value: string | null | undefined) => string
  getCustomerDueDateClass: (customerDueDate: string | null | undefined, status: string | null | undefined) => string | undefined
  isSampleOrder: (item: OrderListItem) => boolean
  getSizePopoverWidth: (orderId: number) => number
  sizePopoverBlocks: (orderId: number) => SizePopoverBlock[]
  getOrderMetaTags: (item: OrderListItem) => string[]
  canEditOrderItem: (item: OrderListItem) => boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-select', orderId: number, checked: boolean): void
  (e: 'show-size-popover', order: OrderListItem): void
  (e: 'edit', order: OrderListItem): void
  (e: 'cost', order: OrderListItem): void
  (e: 'remark', order: OrderListItem): void
  (e: 'operation-log', order: OrderListItem): void
  (e: 'print', order: OrderListItem): void
}>()
</script>

<style scoped>
.orders-card-list {
  min-height: 200px;
}

.order-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
</style>

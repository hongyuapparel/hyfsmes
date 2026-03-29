<script setup lang="ts">
import AppImageThumb from '@/components/AppImageThumb.vue'
import { formatDate } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'

export interface ProductionOrderBriefModel {
  orderNo: string
  skuCode: string
  imageUrl?: string | null
  customerName?: string
  merchandiser?: string
  customerDueDate?: string | null
  orderQuantity?: number | null
  orderDate?: string | null
  orderTypeLabel?: string
  collaborationLabel?: string
}

defineProps<{
  brief: ProductionOrderBriefModel | null
}>()

function dash(v: string | null | undefined) {
  const s = (v ?? '').trim()
  return s || '—'
}

function dateOnly(v: string | null | undefined) {
  if (v == null || String(v).trim() === '') return '—'
  return formatDate(String(v))
}
</script>

<template>
  <div v-if="brief" class="production-order-brief-panel">
    <div v-if="brief.imageUrl" class="production-order-brief-panel__thumb">
      <AppImageThumb :raw-url="brief.imageUrl" variant="compact" />
    </div>
    <el-descriptions :column="1" border size="small" class="production-order-brief-panel__desc">
      <el-descriptions-item label="订单号">{{ dash(brief.orderNo) }}</el-descriptions-item>
      <el-descriptions-item label="SKU">{{ dash(brief.skuCode) }}</el-descriptions-item>
      <el-descriptions-item v-if="brief.orderQuantity != null" label="订单数量">
        {{ formatDisplayNumber(brief.orderQuantity) }}
      </el-descriptions-item>
      <el-descriptions-item label="客户">{{ dash(brief.customerName) }}</el-descriptions-item>
      <el-descriptions-item label="跟单">{{ dash(brief.merchandiser) }}</el-descriptions-item>
      <el-descriptions-item label="客户交期">{{ dateOnly(brief.customerDueDate) }}</el-descriptions-item>
      <el-descriptions-item v-if="brief.orderDate" label="下单日期">{{ dateOnly(brief.orderDate) }}</el-descriptions-item>
      <el-descriptions-item v-if="brief.orderTypeLabel" label="订单类型">
        {{ dash(brief.orderTypeLabel) }}
      </el-descriptions-item>
      <el-descriptions-item v-if="brief.collaborationLabel" label="合作方式">
        {{ dash(brief.collaborationLabel) }}
      </el-descriptions-item>
    </el-descriptions>
  </div>
</template>

<style scoped>
.production-order-brief-panel__thumb {
  margin-bottom: 12px;
  max-width: 120px;
}

.production-order-brief-panel__desc {
  margin-top: 0;
}
</style>

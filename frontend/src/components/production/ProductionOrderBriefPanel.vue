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
    <div class="production-order-brief-panel__main">
      <el-descriptions :column="2" border size="small" class="production-order-brief-panel__desc">
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
      <div class="production-order-brief-panel__image">
        <AppImageThumb v-if="brief.imageUrl" :raw-url="brief.imageUrl" variant="dialog" />
        <span v-else class="production-order-brief-panel__image-placeholder">—</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.production-order-brief-panel__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px;
  gap: 12px;
  align-items: start;
}

.production-order-brief-panel__image {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.production-order-brief-panel__image-placeholder {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
}

/* 兜底：抽屉拖窄到 < 540px 时图片下移到顶部 */
@media (max-width: 540px) {
  .production-order-brief-panel__main {
    grid-template-columns: minmax(0, 1fr);
  }
  .production-order-brief-panel__image {
    order: -1;
  }
}
</style>

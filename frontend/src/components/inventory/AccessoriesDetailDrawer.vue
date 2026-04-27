<template>
  <AppDrawer
    :model-value="visible"
    title="辅料详情"
    :size="560"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-if="row" class="detail-base">
      <div><span class="detail-label">名称：</span>{{ row.name || '-' }}</div>
      <div><span class="detail-label">类别：</span>{{ row.category || '-' }}</div>
      <div><span class="detail-label">客户：</span>{{ row.customerName || '-' }}</div>
      <div><span class="detail-label">当前库存：</span>{{ formatDisplayNumber(row.quantity) }} {{ row.unit || '' }}</div>
      <div><span class="detail-label">备注：</span>{{ row.remark || '-' }}</div>
    </div>
    <div class="detail-log-title">操作记录</div>
    <el-timeline v-loading="loading">
      <el-timeline-item
        v-for="log in logs"
        :key="log.id"
        :timestamp="formatDate(log.createdAt)"
        placement="top"
      >
        {{ formatLogAction(log.action) }}｜操作人：{{ log.operatorUsername || '-' }}{{ log.remark ? `｜备注：${log.remark}` : '' }}
      </el-timeline-item>
    </el-timeline>
  </AppDrawer>
</template>

<script setup lang="ts">
import AppDrawer from '@/components/AppDrawer.vue'
import type { AccessoryItem, AccessoryOperationLog } from '@/api/inventory'
import { formatDateTime as formatDate } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'

defineProps<{
  visible: boolean
  row: AccessoryItem | null
  loading: boolean
  logs: AccessoryOperationLog[]
  formatLogAction: (action: string) => string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()
</script>

<style scoped>
.detail-base {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-label {
  color: var(--color-text-muted);
}

.detail-log-title {
  margin: 8px 0 12px;
  font-weight: 600;
}
</style>

<template>
  <div class="batch-timeline">
    <div v-if="loading" class="timeline-loading">加载中...</div>
    <el-empty v-else-if="!events.length" description="暂无批次记录" />
    <el-table v-else :data="events" size="small" border>
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ formatTime(row.occurredAt) }}</template>
      </el-table-column>
      <el-table-column label="动作" width="120">
        <template #default="{ row }">
          <el-tag :type="actionTagType(row.type)" size="small">{{ actionLabel(row) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="批次" width="80" align="center">
        <template #default="{ row }">{{ row.batchNo != null ? `第${row.batchNo}批` : '—' }}</template>
      </el-table-column>
      <el-table-column label="数量" width="100" align="right">
        <template #default="{ row }">
          {{ row.type === 'outbound' ? '-' : row.type === 'receive' ? '' : '+' }}{{ row.quantity }}
        </template>
      </el-table-column>
      <el-table-column label="操作人" width="120">
        <template #default="{ row }">{{ row.operatorUsername || '—' }}</template>
      </el-table-column>
      <el-table-column label="领取人" width="120">
        <template #default="{ row }">{{ row.pickupUserName || '—' }}</template>
      </el-table-column>
      <el-table-column label="备注" min-width="160">
        <template #default="{ row }">{{ row.remark || '—' }}</template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import type { FinishingBatchEvent } from '@/api/production-finishing'
import { useFinishingBatchTimeline } from '@/composables/useFinishingBatchTimeline'

const props = defineProps<{ orderId: number | null; active: boolean }>()
const { events, loading, load } = useFinishingBatchTimeline()

watch(
  () => [props.orderId, props.active],
  () => {
    if (props.active && props.orderId != null) {
      void load(props.orderId)
    }
  },
  { immediate: true },
)

function actionLabel(row: FinishingBatchEvent): string {
  if (row.type === 'receive') return '尾部收货'
  if (row.type === 'inbound') return row.sourceType === 'defect' ? '次品入库' : '入库登记'
  return '待仓发货'
}

function actionTagType(type: FinishingBatchEvent['type']): 'success' | 'warning' | 'info' {
  if (type === 'inbound') return 'success'
  if (type === 'outbound') return 'warning'
  return 'info'
}

function formatTime(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}
</script>

<style scoped>
.batch-timeline {
  padding: 8px 0;
}
.timeline-loading {
  text-align: center;
  color: var(--el-text-color-secondary);
  padding: 16px 0;
}
</style>

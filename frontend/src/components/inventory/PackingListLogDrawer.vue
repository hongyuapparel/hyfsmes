<template>
  <AppDrawer
    :model-value="visible"
    :title="title"
    :size="520"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="packing-log-wrap">
      <el-timeline v-loading="loading" class="packing-log-timeline">
        <el-timeline-item
          v-for="log in logs"
          :key="log.id"
          :timestamp="formatDate(log.createdAt)"
          :type="actionType(log.action)"
          placement="top"
        >
          <div class="packing-log-head">
            <span class="packing-log-action">{{ formatAction(log.action) }}</span>
            <span class="packing-log-operator">操作人：{{ log.operatorUsername || '-' }}</span>
          </div>
          <div v-if="log.summary" class="packing-log-summary">{{ log.summary }}</div>
        </el-timeline-item>
        <div v-if="!loading && logs.length === 0" class="packing-log-empty">暂无操作记录</div>
      </el-timeline>
    </div>
  </AppDrawer>
</template>

<script setup lang="ts">
import AppDrawer from '@/components/AppDrawer.vue'
import { formatDateTime as formatDate } from '@/utils/date-format'
import type { PackingListLogItem } from '@/api/packing-lists'

defineProps<{
  visible: boolean
  title: string
  loading: boolean
  logs: PackingListLogItem[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const ACTION_LABELS: Record<string, string> = {
  create: '新建',
  update: '修改',
  ship: '发货',
  delete: '删除',
}

function formatAction(action: string): string {
  return ACTION_LABELS[action] ?? action ?? '-'
}

function actionType(action: string): 'primary' | 'success' | 'warning' | 'danger' {
  if (action === 'ship') return 'success'
  if (action === 'delete') return 'danger'
  if (action === 'update') return 'warning'
  return 'primary'
}

defineOptions({ name: 'PackingListLogDrawer' })
</script>

<style scoped>
.packing-log-wrap {
  padding: 8px 12px 12px;
}

.packing-log-timeline {
  min-height: 40px;
}

.packing-log-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.packing-log-action {
  font-weight: 600;
}

.packing-log-operator {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
}

.packing-log-summary {
  margin-top: 4px;
  font-size: var(--font-size-caption);
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.packing-log-empty {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
}
</style>

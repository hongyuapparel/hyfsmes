<template>
  <el-dialog
    :model-value="modelValue"
    title="操作记录"
    width="640"
    @update:model-value="onDialogVisibleChange"
  >
    <el-skeleton v-if="loading" animated :rows="4" />
    <el-empty v-else-if="!logs.length" description="暂无操作记录" />
    <el-timeline v-else class="operation-log-timeline">
      <el-timeline-item
        v-for="log in logs"
        :key="log.id"
      >
        <div class="operation-log-item">
          <div class="operation-log-header">
            <span class="operation-log-operator">操作账号：{{ log.operatorUsername }}</span>
            <span class="operation-log-action">操作类型：{{ getActionLabel(log.action) }}</span>
          </div>
          <div class="operation-log-row">
            <span class="operation-log-label">修改日期：</span>
            <span class="operation-log-value">{{ formatDateTime(log.createdAt) }}</span>
          </div>
          <div class="operation-log-row">
            <span class="operation-log-label">修改内容：</span>
            <span class="operation-log-value">{{ log.detail }}</span>
          </div>
        </div>
      </el-timeline-item>
    </el-timeline>
    <template #footer>
      <el-button @click="closeDialog">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { OrderOperationLogItem } from '@/api/orders'

const ACTION_LABEL_MAP: Record<string, string> = {
  create: '创建草稿',
  update: '修改',
  submit: '提交',
  review: '审核',
  delete: '删除',
  copy_to_draft: '复制为草稿',
}

defineProps<{
  modelValue: boolean
  orderId: number | null
  logs: OrderOperationLogItem[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function onDialogVisibleChange(value: boolean) {
  emit('update:modelValue', value)
}

function closeDialog() {
  emit('update:modelValue', false)
}

function getActionLabel(action: string): string {
  return ACTION_LABEL_MAP[action] ?? action
}

function formatDateTime(v: string | null | undefined): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('zh-CN')
}
</script>

<style scoped>
.operation-log-item {
  font-size: 13px;
}

.operation-log-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.operation-log-operator,
.operation-log-action {
  font-weight: 500;
}

.operation-log-row {
  display: flex;
  gap: 4px;
  margin-bottom: 2px;
}

.operation-log-label {
  flex-shrink: 0;
  color: var(--color-text-muted, #909399);
}

.operation-log-value {
  flex: 1;
  word-break: break-all;
}
</style>

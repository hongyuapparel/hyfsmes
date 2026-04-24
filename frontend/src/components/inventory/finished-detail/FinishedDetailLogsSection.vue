<template>
  <div class="detail-section">
    <div class="detail-section-title">操作记录</div>
    <div v-if="logs.length" class="detail-logs">
      <div v-for="log in logs" :key="log.id" class="detail-log-item">
        <div class="detail-log-head">
          <span class="detail-log-user">{{ log.operatorUsername || '-' }}</span>
          <span class="detail-log-time">{{ log.createdAt }}</span>
        </div>
        <div class="detail-log-body">{{ log.summary }}</div>
      </div>
    </div>
    <div v-else class="detail-muted">暂无操作记录</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  logs: Array<{
    id: string
    operatorUsername: string
    createdAt: string
    summary: string
  }>
}>()
</script>

<style scoped>
.detail-section {
  min-width: 0;
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
}
.detail-section-title {
  font-weight: 600;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.detail-muted { font-size: 12px; color: var(--el-text-color-secondary); }
.detail-logs { display: flex; flex-direction: column; gap: 10px; }
.detail-log-item {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.detail-log-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.detail-log-body { font-size: 12px; color: var(--el-text-color-regular); line-height: 1.5; }
</style>

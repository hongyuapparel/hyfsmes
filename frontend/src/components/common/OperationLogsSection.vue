<template>
  <div class="detail-section">
    <div class="detail-section-title">操作记录</div>
    <div v-if="logs.length" class="detail-logs">
      <div v-for="log in logs" :key="log.id" class="detail-log-item">
        <div class="detail-log-head">
          <span class="detail-log-user">{{ log.operatorUsername || '-' }}</span>
          <span class="detail-log-time">{{ log.createdAt }}</span>
        </div>
        <div class="detail-log-body">
          <span>{{ log.summary }}</span>
          <el-popconfirm
            v-if="canRollback && log.canRollback && log.rollbackId"
            title="回滚到这次修改之前？将精确还原该 SKU 的整组库存。"
            confirm-button-text="回滚"
            cancel-button-text="取消"
            width="240"
            @confirm="$emit('rollback', log.rollbackId)"
          >
            <template #reference>
              <el-button link type="warning" size="small" class="detail-log-rollback">回滚</el-button>
            </template>
          </el-popconfirm>
        </div>
      </div>
    </div>
    <div v-else class="detail-muted">暂无操作记录</div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    logs: Array<{
      id: string | number
      operatorUsername: string
      createdAt: string
      summary: string
      canRollback?: boolean
      rollbackId?: number
    }>
    canRollback?: boolean
  }>(),
  { canRollback: false },
)

defineEmits<{
  (e: 'rollback', logId: number): void
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
  font-size: var(--font-size-body);
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
.detail-log-body { font-size: 12px; color: var(--el-text-color-regular); line-height: 1.5; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.detail-log-rollback { flex: none; padding: 0; height: auto; }
</style>

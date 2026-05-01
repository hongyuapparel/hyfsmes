<template>
  <AppDrawer
    :model-value="visible"
    :title="title"
    :size="620"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="simple-detail-wrap">
      <section class="simple-detail-section">
        <div class="simple-detail-section-title">基础信息</div>
        <div class="simple-detail-main">
          <el-descriptions :column="2" border size="small" class="simple-detail-descriptions">
            <el-descriptions-item v-for="field in fields" :key="field.label" :label="field.label">
              {{ field.value || '-' }}
            </el-descriptions-item>
          </el-descriptions>
          <div class="simple-detail-image">
            <div class="simple-detail-image-label">图片</div>
            <AppImageThumb v-if="imageUrl" :raw-url="imageUrl" variant="dialog" />
            <span v-else class="text-placeholder">-</span>
          </div>
        </div>
      </section>

      <section class="simple-detail-section">
        <div class="simple-detail-section-title">操作记录</div>
        <el-timeline v-loading="loading" class="simple-detail-timeline">
          <el-timeline-item
            v-for="log in logs"
            :key="log.id"
            :timestamp="formatDate(log.createdAt)"
            placement="top"
          >
            {{ formatLogAction(log.action) }} · 操作人：{{ log.operatorUsername || '-' }}{{ log.remark ? ` · 备注：${log.remark}` : '' }}
          </el-timeline-item>
          <div v-if="!loading && logs.length === 0" class="simple-detail-empty">暂无操作记录</div>
        </el-timeline>
      </section>
    </div>
  </AppDrawer>
</template>

<script setup lang="ts">
import AppDrawer from '@/components/AppDrawer.vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import { formatDateTime as formatDate } from '@/utils/date-format'

type SimpleInventoryDetailField = {
  label: string
  value: string
}

type SimpleInventoryDetailLog = {
  id: number
  operatorUsername: string
  action: string
  remark: string
  createdAt: string
}

defineProps<{
  visible: boolean
  title: string
  loading: boolean
  fields: SimpleInventoryDetailField[]
  imageUrl: string
  logs: SimpleInventoryDetailLog[]
  formatLogAction: (action: string) => string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

defineOptions({ name: 'SimpleInventoryDetailDrawer' })
</script>

<style scoped>
.simple-detail-wrap {
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.simple-detail-section {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
  padding: 10px 12px;
}

.simple-detail-section-title {
  font-size: var(--font-size-body);
  font-weight: 600;
  margin-bottom: 8px;
}

.simple-detail-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px;
  gap: 12px;
}

.simple-detail-image {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.simple-detail-image-label {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
}

.simple-detail-timeline {
  min-height: 40px;
}

.simple-detail-empty {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
}
</style>

<template>
  <button
    v-if="isMobile"
    type="button"
    class="filter-collapse-toggle"
    :class="{ 'is-collapsed': collapsed }"
    :aria-label="collapsed ? '展开筛选' : '收起筛选'"
    @click="$emit('update:collapsed', !collapsed)"
  >
    <span v-if="collapsed && activeCount" class="fc-badge">{{ activeCount }}</span>
    <el-icon class="fc-arrow"><ArrowDown /></el-icon>
  </button>
</template>

<script setup lang="ts">
import { ArrowDown } from '@element-plus/icons-vue'
import { isMobileViewport as isMobile } from '@/composables/useViewport'

defineProps<{ collapsed: boolean; activeCount?: number }>()
defineEmits<{ 'update:collapsed': [boolean] }>()
</script>

<style scoped>
.filter-collapse-toggle {
  position: absolute;
  top: var(--space-xs);
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 34px;
  height: 34px;
  padding: 0 6px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-blank);
  color: var(--el-text-color-secondary);
  cursor: pointer;
  z-index: 1;
}
.fc-badge {
  font-size: var(--font-size-caption);
  color: var(--el-color-primary);
}
.fc-arrow {
  transition: transform 0.2s ease;
  transform: rotate(180deg);
}
.filter-collapse-toggle.is-collapsed .fc-arrow {
  transform: rotate(0deg);
}
</style>

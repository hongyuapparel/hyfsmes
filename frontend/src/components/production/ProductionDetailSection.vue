<template>
  <section class="production-detail-section">
    <div v-if="title || hasActions" class="production-detail-section__head">
      <div v-if="title" class="production-detail-section__title">{{ title }}</div>
      <div v-if="hasActions" class="production-detail-section__actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="production-detail-section__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useSlots, computed } from 'vue'

defineProps<{
  title?: string
}>()

const slots = useSlots()
const hasActions = computed(() => !!slots.actions)
</script>

<style scoped>
.production-detail-section {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
  padding: 10px 12px;
}

.production-detail-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}

.production-detail-section__title {
  font-size: var(--font-size-body);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.production-detail-section__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.production-detail-section__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>

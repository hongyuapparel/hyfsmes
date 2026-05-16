<template>
  <section class="production-detail-section">
    <div v-if="title" class="production-detail-section__title">{{ title }}</div>
    <div class="production-detail-section__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<style scoped>
.production-detail-section {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color-overlay);
  padding: 10px 12px;
}

.production-detail-section__title {
  font-size: var(--font-size-body);
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
}

.production-detail-section__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>

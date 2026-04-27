<template>
  <div class="placeholder-page">
    <el-alert type="info" :closable="false" show-icon>开发中，敬请期待。</el-alert>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
}>()
</script>

<style scoped>
.placeholder-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}
</style>

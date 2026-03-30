<template>
  <section class="production-detail-section">
    <el-divider v-if="title" content-position="left">{{ title }}</el-divider>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<style scoped>
.production-detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>

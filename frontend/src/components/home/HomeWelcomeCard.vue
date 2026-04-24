<template>
  <div class="home-welcome">
    <p class="home-greeting">{{ greetingText }}，{{ displayName || '同事' }}</p>
    <div v-if="encourageItem" class="home-encourage">
      <el-icon class="home-encourage-icon"><component :is="encourageItem.icon" /></el-icon>
      <span class="home-encourage-text">{{ encourageItem.text }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EncourageItem } from '@/composables/useHomeWelcome'

defineProps<{
  greetingText: string
  displayName: string
  encourageItem: EncourageItem | null
}>()
</script>

<style scoped>
.home-welcome {
  margin-bottom: var(--space-lg);
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--el-fill-color-light) 0%, var(--el-fill-color) 100%);
  border: 1px solid var(--color-border);
  width: 100%;
  box-sizing: border-box;
}

.home-greeting {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-title);
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.home-encourage {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0 0 var(--space-sm);
  border-left: 3px solid var(--el-color-primary);
  min-width: 0;
}

.home-encourage-icon {
  font-size: var(--font-size-title);
  color: #d97706;
  background: #fff4db;
  border: 1px solid #f6d79a;
  border-radius: 999px;
  padding: 4px;
  box-shadow: 0 1px 4px rgba(217, 119, 6, 0.18);
  flex-shrink: 0;
}

.home-encourage-text {
  font-size: var(--font-size-body);
  font-weight: 500;
  color: var(--el-color-primary);
  line-height: 1.5;
  min-width: 0;
}
</style>

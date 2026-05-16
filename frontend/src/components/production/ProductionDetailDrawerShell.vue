<template>
  <AppDrawer
    :model-value="modelValue"
    :title="title"
    :size="size"
    :min-size="minSize"
    :max-size="maxSize"
    :resizable="resizable"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="emit('closed')"
  >
    <div class="production-detail-drawer-shell">
      <slot />
    </div>
  </AppDrawer>
</template>

<script setup lang="ts">
import AppDrawer from '@/components/AppDrawer.vue'

withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    size?: number
    minSize?: number
    maxSize?: number
    resizable?: boolean
  }>(),
  {
    size: 760,
    minSize: 680,
    maxSize: 1200,
    resizable: true,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'closed'): void
}>()
</script>

<style scoped>
.production-detail-drawer-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>

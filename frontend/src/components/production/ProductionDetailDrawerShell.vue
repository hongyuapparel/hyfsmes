<template>
  <el-drawer
    :model-value="modelValue"
    :title="title"
    direction="rtl"
    :size="size"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
    @closed="emit('closed')"
  >
    <div class="production-detail-drawer-shell">
      <slot />
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    size?: string | number
  }>(),
  {
    size: '460px',
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

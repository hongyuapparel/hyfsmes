<template>
  <el-dialog v-model="dialogVisible" title="列设置" width="480" class="column-config-dialog">
    <p class="column-config-hint">可调整列顺序与显示/隐藏，修改后立即生效。</p>
    <div class="column-config-list">
      <div v-for="(f, idx) in list" :key="`${f.id}-${f.code}`" class="column-config-item">
        <el-checkbox v-model="f.visible" @change="emit('visible-change', f)">{{ f.label }}</el-checkbox>
        <div class="column-config-actions">
          <el-button link size="small" :disabled="idx === 0" @click="emit('move', f, -1)">上移</el-button>
          <el-button link size="small" :disabled="idx === list.length - 1" @click="emit('move', f, 1)">下移</el-button>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="dialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  list: { id: number; code: string; label: string; order: number; visible: boolean }[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'visible-change': [item: { id: number; code: string; label: string; order: number; visible: boolean }]
  move: [item: { id: number; code: string; label: string; order: number; visible: boolean }, delta: number]
}>()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
</script>

<style scoped>
.column-config-hint {
  margin: 0 0 var(--space-md);
  font-size: var(--font-size-caption);
  color: var(--color-muted-foreground, #7f8b99);
}
.column-config-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}
.column-config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius);
  background: var(--color-bg-subtle, #f5f6f8);
}
.column-config-actions {
  display: flex;
  gap: var(--space-xs);
}
</style>

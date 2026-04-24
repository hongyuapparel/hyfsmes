<template>
  <el-dialog
    :model-value="modelValue"
    title="订单详情（只读）"
    width="720"
    @update:model-value="onDialogVisibleChange"
  >
    <div v-if="order">
      <pre class="json-preview">{{ JSON.stringify(order, null, 2) }}</pre>
    </div>
    <template #footer>
      <el-button @click="closeDialog">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  order: any
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function onDialogVisibleChange(value: boolean) {
  emit('update:modelValue', value)
}

function closeDialog() {
  emit('update:modelValue', false)
}
</script>

<style scoped>
.json-preview {
  margin: 0;
  padding: 12px;
  border-radius: var(--radius);
  background-color: #0f172a;
  color: #e5e7eb;
  font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
  font-size: 12px;
  max-height: 400px;
  overflow: auto;
}
</style>

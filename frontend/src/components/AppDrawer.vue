<template>
  <el-drawer
    :model-value="modelValue"
    :title="title"
    :size="`${currentWidth}px`"
    direction="rtl"
    destroy-on-close
    :class="['app-drawer', { 'app-drawer--resizable': resizable }]"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="onClosed"
  >
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>

    <div class="app-drawer__body">
      <slot />
    </div>

    <template v-if="$slots.footer" #footer>
      <div class="app-drawer__footer">
        <slot name="footer" />
      </div>
    </template>

    <div
      v-if="resizable"
      class="app-drawer__resizer"
      @mousedown="startResize"
    />
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    size?: number
    minSize?: number
    maxSize?: number
    resizable?: boolean
  }>(),
  {
    title: '',
    size: 560,
    minSize: 360,
    maxSize: 1200,
    resizable: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'closed'): void
}>()

const currentWidth = ref(props.size)

let startX = 0
let startWidth = 0

function startResize(e: MouseEvent) {
  startX = e.clientX
  startWidth = currentWidth.value
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', stopResize)
}

function onMouseMove(e: MouseEvent) {
  const delta = startX - e.clientX
  const next = Math.min(props.maxSize, Math.max(props.minSize, startWidth + delta))
  currentWidth.value = next
}

function stopResize() {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
}

function onClosed() {
  currentWidth.value = props.size
  emit('closed')
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<style scoped>
.app-drawer__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  overflow-y: auto;
}

.app-drawer__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 0 0;
  border-top: 1px solid var(--el-border-color-lighter);
}

.app-drawer__resizer {
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
}

.app-drawer__resizer:hover {
  background-color: var(--el-color-primary-light-7);
}
</style>

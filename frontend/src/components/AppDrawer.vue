<template>
  <el-drawer
    :model-value="modelValue"
    :title="title"
    :size="`${currentWidth}px`"
    direction="rtl"
    destroy-on-close
    :class="[
      'app-drawer',
      {
        'app-drawer--resizable': resizable,
        'app-drawer--resizing': isResizing,
      },
    ]"
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
const isResizing = ref(false)

let startX = 0
let startWidth = 0
let previousBodyUserSelect = ''
let previousBodyCursor = ''

function startResize(e: MouseEvent) {
  e.preventDefault()
  startX = e.clientX
  startWidth = currentWidth.value
  isResizing.value = true
  previousBodyUserSelect = document.body.style.userSelect
  previousBodyCursor = document.body.style.cursor
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
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
  if (!isResizing.value) return
  isResizing.value = false
  document.body.style.userSelect = previousBodyUserSelect
  document.body.style.cursor = previousBodyCursor
}

function onClosed() {
  stopResize()
  currentWidth.value = props.size
  emit('closed')
}

onBeforeUnmount(() => {
  stopResize()
})
</script>

<style scoped>
.app-drawer__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
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
  left: -7px;
  width: 14px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
}

.app-drawer__resizer::after {
  content: '';
  position: absolute;
  top: 0;
  left: 7px;
  width: 2px;
  height: 100%;
  background-color: transparent;
  transition: background-color 0.15s;
}

.app-drawer__resizer:hover::after,
:deep(.app-drawer--resizing) .app-drawer__resizer::after {
  background-color: var(--el-color-primary-light-5);
}
</style>

<style>
.app-drawer.el-drawer .el-drawer__header {
  min-height: 40px;
  margin-bottom: 0;
  padding: 10px 20px 4px;
}

.app-drawer.el-drawer .el-drawer__body {
  min-height: 0;
  padding-top: 0;
  overflow: hidden;
}
</style>

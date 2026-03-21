<template>
  <div
    class="image-upload-area"
    :class="{ 'is-dragover': isDragover, 'has-image': modelValue }"
    @click="!modelValue && fileInputRef?.click()"
    @dragover.prevent="isDragover = true"
    @dragleave.prevent="isDragover = false"
    @drop.prevent="onDrop"
    @paste="onPaste"
  >
    <input
      ref="fileInputRef"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      class="hidden-input"
      @change="onFileChange"
    />
    <template v-if="modelValue">
      <div class="preview-wrap">
        <el-image :src="modelValue" fit="contain" class="preview-img" />
        <template v-if="props.compact">
          <div class="preview-actions preview-actions-compact">
            <el-button
              circle
              class="compact-delete-btn"
              size="small"
              :disabled="uploading"
              @click.stop="clear"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </template>
        <template v-else>
          <div class="preview-actions">
            <el-button type="primary" link size="small" :loading="uploading" @click.stop="fileInputRef?.click()">
              重新上传
            </el-button>
            <el-button type="danger" link size="small" :disabled="uploading" @click.stop="clear">清除</el-button>
          </div>
        </template>
      </div>
    </template>
    <template v-else>
      <div class="placeholder">
        <span v-if="uploading" class="uploading-text">上传中...</span>
        <span v-else class="placeholder-text">
          点击上传、拖拽图片到此处，或粘贴剪贴板图片
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { uploadImage } from '@/api/uploads'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    compact?: boolean
  }>(),
  {
    compact: true,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', url: string): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragover = ref(false)
const uploading = ref(false)

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function isImageFile(file: File): boolean {
  return IMAGE_TYPES.includes(file.type)
}

function getFileFromDrop(e: DragEvent): File | null {
  const file = e.dataTransfer?.files?.[0]
  return file && isImageFile(file) ? file : null
}

function getFileFromPaste(e: ClipboardEvent): File | null {
  const item = e.clipboardData?.items?.[0]
  if (!item || item.kind !== 'file') return null
  const file = item.getAsFile()
  return file && isImageFile(file) ? file : null
}

async function uploadFile(file: File) {
  uploading.value = true
  try {
    const url = await uploadImage(file)
    emit('update:modelValue', url)
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '图片上传失败'))
  } finally {
    uploading.value = false
  }
}

function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file && isImageFile(file)) uploadFile(file)
}

function onDrop(e: DragEvent) {
  isDragover.value = false
  const file = getFileFromDrop(e)
  if (file) uploadFile(file)
}

function onPaste(e: ClipboardEvent) {
  const file = getFileFromPaste(e)
  if (file) {
    e.preventDefault()
    uploadFile(file)
  }
}

function clear() {
  emit('update:modelValue', '')
}
</script>

<style scoped>
.image-upload-area {
  position: relative;
  border: 1px dashed var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  min-height: 92px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
}

.image-upload-area:hover,
.image-upload-area.is-dragover {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

.image-upload-area.has-image {
  cursor: default;
}

.image-upload-area.has-image:hover {
  border-color: var(--el-border-color);
  background-color: transparent;
}

.hidden-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.placeholder {
  padding: 8px;
  text-align: center;
}

.placeholder-text,
.uploading-text {
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-muted, var(--el-text-color-secondary));
}

.uploading-text {
  color: var(--el-color-primary);
}

.preview-wrap {
  position: relative;
  width: 100%;
  padding: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  box-sizing: border-box;
}

.preview-img {
  width: 100%;
  max-width: 132px;
  height: auto;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-md, 4px);
}

.preview-actions {
  display: flex;
  gap: var(--space-sm, 8px);
}

.preview-actions-compact {
  position: absolute;
  right: 6px;
  top: 6px;
  z-index: 2;
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.preview-wrap:hover .preview-actions-compact {
  opacity: 1;
  transform: translateY(0);
}

.compact-delete-btn {
  border: none;
  color: #fff;
  background: rgba(31, 41, 55, 0.52);
}

.compact-delete-btn:hover {
  color: #fff;
  background: rgba(239, 68, 68, 0.9);
}
</style>

<template>
  <div
    class="image-upload-area"
    :class="{ 'is-dragover': isDragover, 'has-image': displayUrl, 'is-dense': props.dense }"
    @click="onAreaClick"
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
    <template v-if="displayUrl">
      <div class="preview-wrap">
        <el-image :src="displayUrl" fit="contain" class="preview-img" @error="onImageError" />
        <span v-if="uploading" class="preview-uploading">上传中...</span>
        <template v-if="props.compact">
          <div class="preview-actions preview-actions-compact">
            <el-button
              class="compact-icon-btn is-replace"
              size="small"
              title="替换图片"
              :disabled="uploading"
              @click.stop="fileInputRef?.click()"
            >
              <el-icon><RefreshRight /></el-icon>
            </el-button>
            <el-button
              class="compact-icon-btn is-delete"
              size="small"
              title="删除图片"
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
      <div class="placeholder" :class="{ 'placeholder-compact-icon': props.compact && props.compactIconOnly, 'placeholder-dense': props.dense }">
        <template v-if="props.dense || (props.compact && props.compactIconOnly)">
          <el-icon class="placeholder-plus-icon"><Plus /></el-icon>
        </template>
        <span v-if="uploading && !props.dense" class="uploading-text">上传中...</span>
        <span v-else-if="!props.dense" class="placeholder-text">
          {{ props.compact && props.compactIconOnly ? '点击上传' : '点击上传、拖拽图片到此处，或粘贴剪贴板图片' }}
        </span>
      </div>
    </template>
    <teleport to="body">
      <ElImageViewer
        v-if="viewerVisible"
        :url-list="[viewerUrl]"
        :z-index="10100"
        teleported
        @close="viewerVisible = false"
      />
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElImageViewer, ElMessage } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { Plus, RefreshRight } from '@element-plus/icons-vue'
import { uploadImage } from '@/api/uploads'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getUploadImageOriginalForPreview, LIST_IMAGE_PLACEHOLDER } from '@/utils/image'
import { useUploadListImage } from '@/composables/useUploadListImage'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    compact?: boolean
    compactIconOnly?: boolean
    /** 表格单元等紧凑场景：极小 min-height、隐藏文字、缩略图限高 */
    dense?: boolean
  }>(),
  {
    compact: true,
    compactIconOnly: false,
    dense: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', url: string): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragover = ref(false)
const uploading = ref(false)
const localPreviewUrl = ref('')

const { src: resolveUploadSrc, onError: onUploadListError } = useUploadListImage()

const displayUrl = computed(() => {
  // 本地刚上传的预览（blob:）直接使用，无需经过站点资源解析
  if (localPreviewUrl.value) return localPreviewUrl.value
  const raw = (props.modelValue ?? '').trim()
  if (!raw) return ''
  // 与 AppImageThumb 一致：处理 /uploads/ 等站内路径，应用 small_ 缩略规则与失败回退
  return resolveUploadSrc(raw)
})

const viewerVisible = ref(false)

const viewerUrl = computed(() => {
  if (localPreviewUrl.value) return localPreviewUrl.value
  const raw = (props.modelValue ?? '').trim()
  if (!raw) return displayUrl.value
  return getUploadImageOriginalForPreview(raw) || displayUrl.value
})

function onAreaClick() {
  // 加载失败只剩占位图时不可放大，点击回到上传
  if (displayUrl.value && displayUrl.value !== LIST_IMAGE_PLACEHOLDER) {
    viewerVisible.value = true
    return
  }
  fileInputRef.value?.click()
}

function onImageError() {
  // 失败时推进列表回退阶段（small_ → 原图 → 占位），避免死循环
  if (!localPreviewUrl.value && props.modelValue) onUploadListError(props.modelValue)
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function revokeLocalPreview() {
  if (localPreviewUrl.value.startsWith('blob:')) URL.revokeObjectURL(localPreviewUrl.value)
  localPreviewUrl.value = ''
}

function setLocalPreview(file: File) {
  revokeLocalPreview()
  localPreviewUrl.value = URL.createObjectURL(file)
}

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
  setLocalPreview(file)
  uploading.value = true
  try {
    const url = await uploadImage(file)
    emit('update:modelValue', url)
  } catch (e: unknown) {
    revokeLocalPreview()
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
  revokeLocalPreview()
  emit('update:modelValue', '')
}

watch(
  () => props.modelValue,
  (value) => {
    if (value) revokeLocalPreview()
  },
)

onBeforeUnmount(() => {
  revokeLocalPreview()
})
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
  cursor: zoom-in;
}

.image-upload-area.has-image:hover {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
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

.placeholder-compact-icon {
  display: grid;
  place-items: center;
  gap: 4px;
  padding: 0;
}

.placeholder-plus-icon {
  font-size: 18px;
  color: var(--el-color-primary);
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

.preview-uploading {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  color: #fff;
  background: rgba(31, 41, 55, 0.72);
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
  display: flex;
  gap: 4px;
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.preview-wrap:hover .preview-actions-compact {
  opacity: 1;
  transform: translateY(0);
}

.preview-actions-compact .el-button + .el-button {
  margin-left: 0;
}

.compact-icon-btn {
  border: none !important;
  box-shadow: none !important;
  padding: 0;
  width: 20px;
  height: 20px;
  min-height: 20px;
  border-radius: 999px;
  color: #fff;
  background: rgba(31, 41, 55, 0.52);
}

.compact-icon-btn.is-replace:hover {
  color: #fff;
  background: var(--el-color-primary);
}

.compact-icon-btn.is-delete:hover {
  color: #fff;
  background: rgba(239, 68, 68, 0.9);
}

/* 紧凑模式（表格单元）：跟随全站可编辑表格行高（--editable-grid-row-h，默认 34px） */
.image-upload-area.is-dense {
  min-height: var(--editable-grid-row-h, 34px);
}

.image-upload-area.is-dense .placeholder,
.image-upload-area.is-dense .placeholder-dense {
  padding: 4px;
  gap: 0;
}

.image-upload-area.is-dense .placeholder-plus-icon {
  font-size: 16px;
}

.image-upload-area.is-dense .preview-wrap {
  padding: 2px;
}

.image-upload-area.is-dense .preview-actions-compact {
  right: 2px;
  top: 2px;
  gap: 2px;
}

.image-upload-area.is-dense .compact-icon-btn {
  width: 16px;
  height: 16px;
  min-height: 16px;
  font-size: 11px;
}

.image-upload-area.is-dense .preview-img {
  max-width: 100%;
  max-height: calc(var(--editable-grid-row-h, 34px) - 4px);
  aspect-ratio: auto;
}
</style>

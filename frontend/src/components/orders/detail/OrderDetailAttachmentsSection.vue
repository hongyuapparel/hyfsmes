<template>
  <section v-if="hasAttachments" class="block block-attachments">
    <div class="block-title">H 图片附件</div>
    <div class="attachments-grid">
      <div
        v-for="(url, index) in attachmentsForView"
        :key="url + index"
        class="attachment-item"
        :style="itemStyles[index]"
      >
        <el-image
          :src="url"
          fit="contain"
          :preview-src-list="attachmentsForView"
          :initial-index="index"
          :preview-teleported="true"
          hide-on-click-modal
          @load="(event) => handleImageLoad(event, index)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { reactive } from 'vue'

const ATTACHMENT_HEIGHT_PX = 200

defineProps<{
  hasAttachments: boolean
  attachmentsForView: string[]
}>()

const itemStyles = reactive<Record<number, { width: string; height: string }>>({})

function handleImageLoad(event: Event, index: number): void {
  const img = event.target
  if (!(img instanceof HTMLImageElement)) return
  const { naturalWidth, naturalHeight } = img
  if (naturalWidth <= 0 || naturalHeight <= 0) return
  const ratio = naturalWidth / naturalHeight
  let width = ATTACHMENT_HEIGHT_PX * ratio
  let height = ATTACHMENT_HEIGHT_PX
  // 超宽图（如横幅 logo）按行宽封顶，并相应降低高度保持比例，避免撑爆容器导致打印整页缩放。
  const grid = img.closest('.attachments-grid')
  const maxWidth = grid instanceof HTMLElement ? grid.clientWidth : 0
  if (maxWidth > 0 && width > maxWidth) {
    width = maxWidth
    height = maxWidth / ratio
  }
  itemStyles[index] = { width: `${Math.round(width)}px`, height: `${Math.round(height)}px` }
}
</script>

<style scoped>
.block {
  margin-top: 8px;
}

.block-title {
  font-weight: 600;
  margin-bottom: 4px;
  font-size: 12px;
}

.block-attachments {
  margin-top: 10px;
}

.attachments-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.attachment-item {
  height: 200px;
  max-width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
  position: relative;
  border: 1px solid #dcdfe6;
  border-radius: 2px;
  overflow: hidden;
}

.attachment-item :deep(.el-image) {
  display: block;
  width: 100%;
  height: 100%;
}

.attachment-item :deep(.el-image__inner) {
  object-fit: contain;
  cursor: zoom-in;
}
</style>

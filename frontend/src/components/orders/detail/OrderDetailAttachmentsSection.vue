<template>
  <section v-if="hasAttachments" class="block block-attachments">
    <div class="block-title">H 图片附件</div>
    <div ref="gridRef" class="attachments-grid">
      <div
        v-for="origIndex in displayOrder"
        :key="attachmentsForView[origIndex] + origIndex"
        class="attachment-item"
        :style="itemStyle(origIndex)"
      >
        <el-image
          :src="attachmentsForView[origIndex]"
          fit="contain"
          :preview-src-list="attachmentsForView"
          :initial-index="origIndex"
          :preview-teleported="true"
          hide-on-click-modal
          @load="(event) => handleImageLoad(event, origIndex)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

const ATTACHMENT_HEIGHT_PX = 200
const GAP_PX = 10

const props = defineProps<{
  hasAttachments: boolean
  attachmentsForView: string[]
}>()

const gridRef = ref<HTMLElement | null>(null)
// 每张图按 200px 高、宽随比例计算出的盒子尺寸，按原始下标存储。
const boxes = reactive<Record<number, { width: number; height: number }>>({})

function handleImageLoad(event: Event, index: number): void {
  const img = event.target
  if (!(img instanceof HTMLImageElement)) return
  const { naturalWidth, naturalHeight } = img
  if (naturalWidth <= 0 || naturalHeight <= 0) return
  const ratio = naturalWidth / naturalHeight
  let width = ATTACHMENT_HEIGHT_PX * ratio
  let height = ATTACHMENT_HEIGHT_PX
  // 超宽图按行宽封顶并降高保持比例，避免撑爆容器导致打印整页缩放。
  const maxWidth = gridRef.value ? gridRef.value.clientWidth : 0
  if (maxWidth > 0 && width > maxWidth) {
    width = maxWidth
    height = maxWidth / ratio
  }
  boxes[index] = { width: Math.round(width), height: Math.round(height) }
}

function itemStyle(index: number): Record<string, string> {
  const box = boxes[index]
  if (!box) return {}
  return { width: `${box.width}px`, height: `${box.height}px` }
}

// 保序填空：按原顺序排，当前行放不下时往后找能塞进剩余空位的小图提上来，
// 既填满每行又尽量保留原顺序。全部加载完且图多于 2 张才重排。
function packOrder(items: { index: number; width: number }[], containerWidth: number): number[] {
  const remaining = [...items]
  const ordered: number[] = []
  while (remaining.length) {
    let rowWidth = 0
    let placedAny = false
    let k = 0
    while (k < remaining.length) {
      const item = remaining[k]
      const add = (rowWidth === 0 ? 0 : GAP_PX) + item.width
      if (rowWidth === 0 || rowWidth + add <= containerWidth) {
        ordered.push(item.index)
        rowWidth += add
        remaining.splice(k, 1)
        placedAny = true
      } else {
        k++
      }
    }
    if (!placedAny) {
      remaining.forEach((item) => ordered.push(item.index))
      break
    }
  }
  return ordered
}

const displayOrder = computed<number[]>(() => {
  const count = props.attachmentsForView.length
  const identity = Array.from({ length: count }, (_, i) => i)
  const allLoaded = identity.every((i) => boxes[i])
  const containerWidth = gridRef.value?.clientWidth ?? 0
  if (count <= 2 || !allLoaded || containerWidth <= 0) return identity
  return packOrder(
    identity.map((i) => ({ index: i, width: boxes[i].width })),
    containerWidth,
  )
})
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

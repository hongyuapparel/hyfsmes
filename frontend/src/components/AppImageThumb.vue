<template>
  <span v-if="!hasInput" class="app-image-thumb-empty">{{ emptyText }}</span>
  <template v-else>
    <!-- 桌面：悬停大图（el-popover + 全站单例互斥） -->
    <el-popover
      v-if="useDesktopPopover"
      v-model:visible="desktopPopoverOpen"
      trigger="manual"
      :teleported="teleported"
      :z-index="popoverZIndex"
      placement="right"
      :fallback-placements="['left', 'top', 'bottom']"
      :popper-options="{ strategy: 'fixed' }"
      :show-arrow="false"
      :popper-style="hoverPopperOuterStyle"
      popper-class="app-image-thumb-hover-popper"
    >
      <template #reference>
        <div
          class="app-image-thumb-box"
          :class="{ 'is-zoomable': previewable }"
          :style="boxStyle"
          @mouseenter="onRefEnter"
          @mouseleave="onRefLeave"
          @click.capture="onThumbClickCapture"
        >
          <el-image
            :src="thumbDisplaySrc"
            fit="contain"
            :lazy="lazy"
            class="app-image-thumb-el"
            @error="onThumbError"
          >
            <template #error>
              <div class="app-image-thumb-fallback">{{ emptyText }}</div>
            </template>
          </el-image>
        </div>
      </template>
      <!-- hover：仅 1 个正方形 panel + 1 张 img（失败时 panel 内仅多一个占位 div） -->
      <div
        v-if="desktopPopoverOpen && previewUrl"
        class="app-image-thumb-hover-panel"
        @mouseenter="onPopoverEnter"
        @mouseleave="onPopoverLeave"
      >
        <img
          v-if="!hoverPreviewImgError"
          :key="previewUrl"
          :src="previewUrl"
          class="app-image-thumb-hover-image"
          alt=""
          loading="lazy"
          @error="hoverPreviewImgError = true"
        />
        <div v-else class="app-image-thumb-hover-fallback">{{ emptyText }}</div>
      </div>
    </el-popover>
    <!-- 触摸 / 无 hover：仅小图框，点击打开 Viewer -->
    <div
      v-else
      class="app-image-thumb-box"
      :class="{ 'is-zoomable': previewable }"
      :style="boxStyle"
      @click.capture="onThumbClickCapture"
    >
      <el-image
        :src="thumbDisplaySrc"
        fit="contain"
        :lazy="lazy"
        class="app-image-thumb-el"
        @error="onThumbError"
      >
        <template #error>
          <div class="app-image-thumb-fallback">{{ emptyText }}</div>
        </template>
      </el-image>
    </div>

    <teleport to="body">
      <ElImageViewer
        v-if="viewerVisible"
        :url-list="viewerUrlList"
        :initial-index="viewerInitialIndex"
        :z-index="imageViewerZIndex"
        teleported
        @close="viewerVisible = false"
      />
    </teleport>
  </template>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElImageViewer } from 'element-plus'
import { useUploadListImage } from '@/composables/useUploadListImage'
import {
  getUploadImageOriginalForPreview,
  LIST_IMAGE_PLACEHOLDER,
} from '@/utils/image'
import { useCoarsePointerOrNoHover } from '@/composables/useCoarsePointerOrNoHover'
import {
  nextImageThumbPreviewInstanceId,
  imageThumbPreviewActiveId,
  imageThumbPreviewOpen,
  imageThumbPreviewScheduleClose,
  imageThumbPreviewCancelClose,
} from '@/composables/useImageThumbPreviewSingleton'

defineOptions({ name: 'AppImageThumb' })

/** 高于悬停浮层，避免被 popover / 表格固定列 / 弹窗压住 */
const popoverZIndex = 10020
const imageViewerZIndex = 10100

/** 与 .app-image-thumb-hover-panel 边长一致，避免 EP popper 按内容收缩成细条 */
const HOVER_PANEL_PX = 480

const hoverPopperOuterStyle = {
  padding: '0',
  margin: '0',
  width: `min(${HOVER_PANEL_PX}px, calc(100vw - 16px))`,
  minWidth: `min(${HOVER_PANEL_PX}px, calc(100vw - 16px))`,
  maxWidth: `min(${HOVER_PANEL_PX}px, calc(100vw - 16px))`,
  boxSizing: 'border-box' as const,
}

const props = withDefaults(
  defineProps<{
    /** 已解析或可直链的缩略地址（不走 small_ 规则） */
    src?: string
    /** 站内上传路径：启用 small_ → 原图 → 占位 回退（与 src 二选一） */
    rawUrl?: string
    /** 悬停/预览用大图；不传则 rawUrl 用原图解析，src 用自身 */
    previewSrc?: string
    /** 预设边长：table 56 / card 72 / compact 48 / dialog 64 */
    variant?: 'table' | 'card' | 'compact' | 'dialog'
    width?: number
    height?: number
    lazy?: boolean
    emptyText?: string
    teleported?: boolean
    /** 关闭悬停浮层与点击 Viewer（仅展示小图） */
    previewDisabled?: boolean
    /** 点击预览时多图切换（如附件列表），不传则仅预览当前图 */
    previewGallery?: string[]
    previewGalleryIndex?: number
  }>(),
  {
    variant: 'table',
    lazy: true,
    emptyText: '—',
    teleported: true,
    previewDisabled: false,
    previewGalleryIndex: 0,
  },
)

const { src: resolveUploadSrc, onError: onUploadListError } = useUploadListImage()
const { isCoarseOrNoHover } = useCoarsePointerOrNoHover()

const instanceId = nextImageThumbPreviewInstanceId()

const directFailed = ref(false)
/** 悬停预览用原生 img，加载失败时展示占位（与列表小图逻辑独立） */
const hoverPreviewImgError = ref(false)

const pixelSize = computed(() => {
  if (props.width != null && props.height != null) {
    return { w: props.width, h: props.height }
  }
  const map = { table: 56, card: 72, compact: 48, dialog: 64 } as const
  const n = map[props.variant]
  return { w: n, h: n }
})

const boxStyle = computed(() => ({
  width: `${pixelSize.value.w}px`,
  height: `${pixelSize.value.h}px`,
}))

const hasInput = computed(() => !!(props.rawUrl?.trim() || props.src?.trim()))

const thumbDisplaySrc = computed(() => {
  if (props.rawUrl?.trim()) return resolveUploadSrc(props.rawUrl)
  const s = (props.src || '').trim()
  if (!s) return ''
  if (directFailed.value) return LIST_IMAGE_PLACEHOLDER
  return s
})

const previewUrl = computed(() => {
  if (props.previewDisabled) return ''
  const p = props.previewSrc?.trim()
  if (p) return p
  if (props.rawUrl?.trim()) {
    return getUploadImageOriginalForPreview(props.rawUrl) || resolveUploadSrc(props.rawUrl)
  }
  return (props.src || '').trim()
})

const previewable = computed(() => {
  if (props.previewDisabled) return false
  const u = previewUrl.value
  return !!u && u !== LIST_IMAGE_PLACEHOLDER
})

const useDesktopPopover = computed(
  () => !isCoarseOrNoHover.value && previewable.value,
)

const desktopPopoverOpen = computed({
  get: () => imageThumbPreviewActiveId.value === instanceId,
  set(v: boolean) {
    if (!v && imageThumbPreviewActiveId.value === instanceId) {
      imageThumbPreviewActiveId.value = null
    } else if (v) {
      imageThumbPreviewOpen(instanceId)
    }
  },
})

const viewerVisible = ref(false)
const viewerUrlList = ref<string[]>([])
const viewerInitialIndex = ref(0)

watch(
  () => [props.src, props.rawUrl],
  () => {
    directFailed.value = false
  },
)

watch(desktopPopoverOpen, (open) => {
  if (open) hoverPreviewImgError.value = false
})

function onThumbError() {
  if (props.rawUrl?.trim()) onUploadListError(props.rawUrl)
  else directFailed.value = true
}

function onRefEnter() {
  if (isCoarseOrNoHover.value || !previewable.value) return
  imageThumbPreviewOpen(instanceId)
}

function onRefLeave() {
  if (isCoarseOrNoHover.value) return
  imageThumbPreviewScheduleClose(instanceId)
}

function onPopoverEnter() {
  imageThumbPreviewCancelClose()
}

function onPopoverLeave() {
  imageThumbPreviewScheduleClose(instanceId)
}

function openViewer() {
  const gal = props.previewGallery?.filter(Boolean) ?? []
  if (gal.length) {
    viewerUrlList.value = gal
    const i = Math.min(Math.max(0, props.previewGalleryIndex), gal.length - 1)
    viewerInitialIndex.value = i
  } else if (previewUrl.value) {
    viewerUrlList.value = [previewUrl.value]
    viewerInitialIndex.value = 0
  } else {
    return
  }
  viewerVisible.value = true
}

function onThumbClickCapture(e: MouseEvent) {
  if (!previewable.value) return
  e.stopPropagation()
  // 点击放大时收起悬停浮层，避免与 Viewer 叠在一起闪烁
  if (imageThumbPreviewActiveId.value === instanceId) {
    imageThumbPreviewActiveId.value = null
  }
  openViewer()
}
</script>

<style scoped>
.app-image-thumb-empty {
  font-size: var(--font-size-body);
  color: var(--el-text-color-placeholder);
  user-select: none;
}

.app-image-thumb-box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  vertical-align: middle;
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
  background-color: var(--el-fill-color-blank);
  overflow: hidden;
}

.app-image-thumb-box.is-zoomable {
  cursor: zoom-in;
}

.app-image-thumb-el {
  width: 100%;
  height: 100%;
  display: block;
}

.app-image-thumb-el :deep(.el-image__inner) {
  object-fit: contain;
  object-position: center center;
}

.app-image-thumb-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-caption);
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color-light);
}

</style>

<style>
/* ========== hover 预览：全新最简结构，仅 panel + img ========== */
.app-image-thumb-hover-popper.el-popover.el-popper {
  z-index: 10020;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  overflow: visible;
  box-sizing: border-box;
}

.app-image-thumb-hover-popper [data-popper-arrow] {
  display: none;
}

.app-image-thumb-hover-popper .el-popover__title {
  display: none;
}

.app-image-thumb-hover-popper .el-popover__body {
  padding: 0;
  margin: 0;
  border: none;
  width: 100%;
  display: block;
  box-sizing: border-box;
}

.app-image-thumb-hover-panel {
  box-sizing: border-box;
  width: min(480px, calc(100vw - 16px));
  height: min(480px, calc(100vh - 16px));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  overflow: hidden;
  background: var(--el-bg-color-overlay);
  border-radius: 10px;
  box-shadow: var(--el-box-shadow-dark);
}

.app-image-thumb-hover-image {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  object-position: center center;
}

.app-image-thumb-hover-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: var(--font-size-body);
  color: var(--el-text-color-placeholder);
}
</style>

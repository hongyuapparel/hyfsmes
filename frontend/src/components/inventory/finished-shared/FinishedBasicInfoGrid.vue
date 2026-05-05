<template>
  <div class="detail-section">
    <div class="detail-section-head">
      <div class="detail-section-title">{{ title }}</div>
      <div v-if="$slots.actions" class="detail-head-actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="detail-basic-main">
      <div class="detail-basic-grid"><slot /></div>
      <div class="detail-product-image-panel">
        <div v-if="imageLabel" class="detail-image-label">{{ imageLabel }}</div>
        <slot name="image" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 成品库存「基础信息 + 产品图」共享布局。
 *
 * 抽取自 FinishedDetailBasicInfoSection 与 FinishedCreateDrawer 的重复
 * detail-basic-* CSS 与结构。两者字段集和编辑模式不同，但视觉布局一致：
 * - 左侧：4 列 grid，label/value 交替；可由 slot 内容自由填充
 * - 右侧：170px 宽产品图栏；通过 image slot 注入
 * - 头部：可选 actions slot 用于「编辑/保存/取消」按钮
 *
 * 使用约束：grid 子元素必须按 label/value 成对排列；如需横跨整行的 value，
 * 在外部加 .detail-basic-value-span-3 类。
 */
defineProps<{
  title: string
  imageLabel?: string
}>()
</script>

<style scoped>
.detail-section {
  min-width: 0;
  flex: none;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
}
.detail-section-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--el-text-color-primary);
  margin: 0;
}
.detail-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.detail-head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.detail-basic-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170px;
  gap: 12px;
  align-items: stretch;
}
.detail-basic-grid {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 96px minmax(0, 1fr);
  border: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
}
:deep(.detail-basic-label),
:deep(.detail-basic-value) {
  min-width: 0;
  padding: 7px 10px;
  border-right: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
  min-height: 40px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}
:deep(.detail-basic-label) {
  font-weight: 600;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-lighter);
}
:deep(.detail-basic-value) {
  color: var(--el-text-color-regular);
  overflow: hidden;
}
:deep(.detail-basic-value-span-3) {
  grid-column: 2 / 5;
}
/* 当 value 是 span-3 时，前面的 label 必须强制到 col 1 起点（避免 5 对+span-3 时错位换行） */
:deep(.detail-basic-label-row-start) {
  grid-column: 1 / 2;
}
.detail-basic-grid > :deep(:nth-child(4n)) {
  border-right: none;
}
.detail-basic-grid > :deep(:nth-last-child(-n + 2)) {
  border-bottom: none;
}
.detail-product-image-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 170px;
  min-width: 170px;
}
.detail-image-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

:deep(.detail-basic-grid .el-select),
:deep(.detail-basic-grid .el-input) {
  width: 100%;
  max-width: 100%;
}
:deep(.detail-basic-grid .el-select__wrapper) {
  min-width: 0 !important;
}
:deep(.detail-product-image-panel .image-upload-area) {
  width: 100%;
}

@media (max-width: 860px) {
  .detail-basic-main {
    grid-template-columns: 1fr;
  }
}
</style>

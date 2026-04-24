<template>
  <section v-if="hasAttachments" class="block block-attachments">
    <div class="block-title">H 图片附件</div>
    <div class="attachments-grid">
      <div
        v-for="(url, index) in attachmentsForView"
        :key="url + index"
        class="attachment-item"
      >
        <el-image :src="url" fit="contain" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  hasAttachments: boolean
  attachmentsForView: string[]
}>()
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
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.attachment-item {
  width: 100%;
  height: 200px;
  position: relative;
  border: 1px solid #dcdfe6;
  border-radius: 2px;
  overflow: hidden;
}

.attachment-item :deep(.el-image) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
</style>

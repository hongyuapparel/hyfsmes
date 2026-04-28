<template>
  <el-card class="block-card">
    <template #header>
      <div class="block-header">
        <span class="block-title">H 图片附件</span>
        <el-button link type="primary" @click="chooseAttachments">选择多图</el-button>
      </div>
    </template>
    <div class="attachments">
      <div
        v-for="(url, idx) in attachments"
        :key="url + idx"
        class="attachment-item"
        :class="{
          'is-dragging': draggingAttachmentIndex === idx,
          'is-drag-over': dragOverAttachmentIndex === idx,
        }"
        draggable="true"
        @dragstart="onAttachmentDragStart(idx, $event)"
        @dragover="onAttachmentDragOver(idx, $event)"
        @drop="onAttachmentDrop(idx, $event)"
        @dragend="onAttachmentDragEnd"
      >
        <AppImageThumb
          :raw-url="url"
          :width="120"
          :height="120"
          :preview-gallery="attachments"
          :preview-gallery-index="idx"
        />
        <el-tooltip content="删除" placement="top">
          <el-button
            link
            type="danger"
            size="small"
            class="attachment-remove"
            circle
            @click="removeAttachment(idx)"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
      <div v-if="!attachments.length" class="attachments-empty">暂无附件，可点击右上角选择上传</div>
    </div>
    <input
      ref="attachmentFileInputRef"
      type="file"
      multiple
      accept="image/jpeg,image/png,image/gif,image/webp"
      class="hidden-file-input"
      @change="onAttachmentFileChange"
    />
  </el-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import AppImageThumb from '@/components/AppImageThumb.vue'

defineProps<{
  attachments: string[]
  draggingAttachmentIndex: number | null
  dragOverAttachmentIndex: number | null
  onAttachmentFileChange: (event: Event) => void
  removeAttachment: (index: number) => void
  onAttachmentDragStart: (index: number, event: DragEvent) => void
  onAttachmentDragOver: (index: number, event: DragEvent) => void
  onAttachmentDrop: (index: number, event: DragEvent) => void
  onAttachmentDragEnd: () => void
}>()

const attachmentFileInputRef = ref<HTMLInputElement | null>(null)

function chooseAttachments() {
  attachmentFileInputRef.value?.click()
}
</script>

<style scoped src="./order-edit-card.css"></style>
<style scoped src="./order-edit-attachments.css"></style>

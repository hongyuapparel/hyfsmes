<template>
  <div class="attachment-area">
    <div v-if="attachments.length" class="attachment-list">
      <div v-for="(url, index) in attachments" :key="index" class="attachment-item">
        <AppImageThumb :raw-url="url" :width="72" :height="72" :preview-gallery="attachments" :preview-gallery-index="index" />
        <el-button link type="danger" size="small" @click="emit('remove', index)">删除</el-button>
      </div>
    </div>
    <el-upload :show-file-list="false" :before-upload="queueUpload" accept="image/*" :disabled="uploading">
      <el-button size="small" :loading="uploading">{{ uploading ? '上传中...' : '上传图片' }}</el-button>
    </el-upload>
  </div>
</template>

<script setup lang="ts">
defineProps<{ attachments: string[]; uploading: boolean }>()
const emit = defineEmits<{ upload: [file: File]; remove: [index: number] }>()
function queueUpload(file: File) { emit('upload', file); return false }
</script>

<style scoped>
.attachment-area { display: flex; flex-direction: column; gap: var(--space-sm); }
.attachment-list { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
.attachment-item { display: flex; flex-direction: column; align-items: center; }
</style>

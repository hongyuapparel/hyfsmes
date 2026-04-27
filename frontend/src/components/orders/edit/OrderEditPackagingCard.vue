<template>
  <el-card class="block-card">
    <template #header>
      <div class="block-header">
        <span class="block-title">G 包装要求</span>
        <el-button link type="primary" @click="addPackagingHeader">新增列</el-button>
      </div>
    </template>
    <div class="packaging-grid">
      <div v-for="(header, idx) in packagingHeaders" :key="header + idx" class="packaging-cell">
        <div class="packaging-header">
          <el-input v-model="packagingHeaders[idx]" size="small" />
        </div>
        <div class="packaging-body">
          <div class="packaging-image" @click="triggerPackagingUpload(idx)">
            <img v-if="packagingCells[idx]?.imageUrl" :src="packagingCells[idx].imageUrl" alt="" />
            <span v-else>点击上传图片</span>
          </div>
          <el-input v-model="packagingCells[idx].accessoryName" placeholder="选择/填写辅料" size="small">
            <template #suffix>
              <el-button link type="primary" size="small" @click.stop="openAccessoryDialog(idx)">选择</el-button>
            </template>
          </el-input>
          <el-input v-model="packagingCells[idx].description" placeholder="信息备注" size="small" />
        </div>
        <div class="packaging-footer">
          <el-tooltip content="删除列" placement="top">
            <el-button link type="danger" size="small" circle @click="removePackagingHeader(idx)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </div>
    <div class="packaging-method">
      <span>包装方式：</span>
      <el-input
        :model-value="packagingMethod"
        placeholder="如：每件单独装袋，每箱 20 件等"
        @update:model-value="emit('update:packagingMethod', String($event ?? ''))"
      />
    </div>
    <input
      ref="packagingFileInputRef"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      class="hidden-file-input"
      @change="onPackagingFileChange"
    />
  </el-card>
</template>

<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue'

defineProps<{
  packagingHeaders: string[]
  packagingCells: any[]
  packagingMethod: string
  packagingFileInputRef: any
  addPackagingHeader: () => void
  removePackagingHeader: (index: number) => void
  triggerPackagingUpload: (index: number) => void
  onPackagingFileChange: (event: Event) => void
  openAccessoryDialog: (index: number) => void
}>()

const emit = defineEmits<{
  (e: 'update:packagingMethod', value: string): void
}>()
</script>

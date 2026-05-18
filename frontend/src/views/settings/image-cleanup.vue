<template>
  <div class="page-card">
    <p class="settings-hint">
      扫描 <code>uploads/</code> 目录中数据库无引用、且修改时间超过 30 天的图片文件。删除前请仔细核对，已删除文件无法恢复。
    </p>

    <div class="cleanup-toolbar">
      <el-button type="primary" :loading="scanning" @click="runScan">扫描孤立图片</el-button>
      <template v-if="hasScanned && totalCount > 0">
        <span class="cleanup-summary">
          共 {{ totalCount }} 个孤立文件，合计 {{ totalSizeLabel }}
        </span>
        <el-checkbox
          :model-value="allSelected"
          :indeterminate="isIndeterminate"
          @change="toggleSelectAll($event as boolean)"
        >
          全选
        </el-checkbox>
        <el-button @click="invertSelection">反选</el-button>
        <el-button type="danger" :loading="deleting" :disabled="!selectedFilenames.length" @click="deleteSelected">
          删除选中
        </el-button>
      </template>
    </div>

    <el-table
      v-if="hasScanned && orphans.length"
      :data="orphans"
      border
      class="cleanup-table"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" />
      <el-table-column label="缩略图" width="88" align="center">
        <template #default="{ row }">
          <AppImageThumb :src="rowImageUrl(row)" variant="table" />
        </template>
      </el-table-column>
      <el-table-column prop="filename" label="文件名" min-width="200" show-overflow-tooltip />
      <el-table-column label="大小" width="100">
        <template #default="{ row }">{{ formatFileSize(row.sizeBytes) }}</template>
      </el-table-column>
      <el-table-column label="修改时间" width="170">
        <template #default="{ row }">{{ formatMtime(row.mtime) }}</template>
      </el-table-column>
    </el-table>

    <el-empty v-else-if="hasScanned" description="未发现孤立图片" />
  </div>
</template>

<script setup lang="ts">
import { useImageCleanup } from '@/composables/useImageCleanup'

const {
  scanning,
  deleting,
  selectedFilenames,
  orphans,
  hasScanned,
  totalCount,
  totalSizeLabel,
  allSelected,
  isIndeterminate,
  rowImageUrl,
  formatMtime,
  formatFileSize,
  runScan,
  toggleSelectAll,
  invertSelection,
  onSelectionChange,
  deleteSelected,
} = useImageCleanup()
</script>

<style scoped>
.settings-hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
  margin-bottom: var(--space-md);
  line-height: 1.6;
}
.settings-hint code {
  font-size: var(--font-size-caption);
}
.cleanup-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}
.cleanup-summary {
  font-size: var(--font-size-body);
  color: var(--color-text-secondary);
  margin-right: var(--space-sm);
}
.cleanup-table {
  margin-top: 0;
}
</style>

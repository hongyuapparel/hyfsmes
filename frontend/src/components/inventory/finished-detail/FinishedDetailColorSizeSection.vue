<template>
  <div class="detail-section">
    <div class="detail-section-title">颜色图片与码数明细</div>
    <div v-if="sizeHeaders.length && colorSizeRows.length" class="detail-color-size-table-wrap">
      <el-table
        :data="colorSizeRows"
        border
        size="small"
        class="detail-color-size-table"
        show-summary
        :summary-method="getColorSizeSummary"
      >
        <el-table-column label="颜色" width="88" align="center" header-align="center">
          <template #default="{ row }">{{ row.colorName || '-' }}</template>
        </el-table-column>
        <el-table-column label="颜色图片" width="122" align="center" header-align="center">
          <template #default="{ row }">
            <ImageUploadArea
              v-if="metaEditing"
              class="detail-color-image-editor"
              compact
              :model-value="colorImageMap[row.colorName] || ''"
              @update:model-value="(url) => $emit('saveColorImage', row.colorName, String(url ?? ''))"
            />
            <AppImageThumb
              v-else-if="colorImageMap[row.colorName]"
              :raw-url="colorImageMap[row.colorName]"
              variant="table"
            />
            <span v-else class="text-placeholder">-</span>
          </template>
        </el-table-column>
        <el-table-column
          v-for="(size, sizeIndex) in sizeHeaders"
          :key="`size-${sizeIndex}`"
          :label="size"
          min-width="64"
          align="center"
          header-align="center"
        >
          <template #default="{ row }">
            {{ Number(row.quantities?.[sizeIndex] ?? 0) || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="合计" width="72" align="center" header-align="center">
          <template #default="{ row }">{{ sumRowQty(row.quantities) }}</template>
        </el-table-column>
        <el-table-column label="出厂价" width="88" align="center" header-align="center">
          <template #default>
            <el-input
              v-if="metaEditing"
              :model-value="unitPrice"
              placeholder="请输入"
              clearable
              size="small"
              @update:model-value="(value) => $emit('updateUnitPrice', String(value ?? ''))"
            />
            <template v-else>{{ tableUnitPrice }}</template>
          </template>
        </el-table-column>
        <el-table-column label="总价" width="120" align="center" header-align="center">
          <template #default="{ row }">{{ rowTotalPrice(row.quantities) }}</template>
        </el-table-column>
      </el-table>
    </div>
    <div v-else class="detail-muted">暂无颜色尺码明细（未关联订单或订单未维护颜色尺码）。</div>
  </div>
</template>

<script setup lang="ts">
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import AppImageThumb from '@/components/AppImageThumb.vue'

defineProps<{
  metaEditing: boolean
  sizeHeaders: string[]
  colorSizeRows: Array<{ colorName: string; quantities: number[] }>
  colorImageMap: Record<string, string>
  unitPrice: string
  tableUnitPrice: string
  sumRowQty: (quantities: unknown[]) => number
  rowTotalPrice: (quantities: unknown[]) => string
  getColorSizeSummary: (params: { columns: Array<{ label?: string }> }) => string[]
}>()

defineEmits<{
  (e: 'saveColorImage', colorName: string, url: string): void
  (e: 'updateUnitPrice', value: string): void
}>()
</script>

<style scoped>
.detail-section {
  min-width: 0;
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
}
.detail-section-title {
  font-weight: 600;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.detail-color-size-table-wrap { width: 100%; }
.detail-muted { font-size: 12px; color: var(--el-text-color-secondary); }

:deep(.detail-color-size-table .el-table__cell) { overflow: visible; vertical-align: top; }
:deep(.detail-color-size-table .image-upload-area) { min-height: 92px; }
:deep(.detail-color-image-editor.image-upload-area) { min-height: 64px; }
:deep(.detail-color-image-editor .preview-img) { width: 60px; height: 60px; }
</style>

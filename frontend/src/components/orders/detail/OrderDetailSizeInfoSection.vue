<template>
  <section v-if="hasSizeInfo" class="block">
    <div class="block-title">D 尺寸信息</div>
    <div class="block-body">
      <el-table
        :data="sizeInfoRowsForView"
        border
        size="small"
        class="compact-table table-full size-table"
      >
        <el-table-column
          v-for="(header, index) in sizeMetaHeadersForView"
          :key="'meta-' + index"
          :label="header"
          :min-width="sizeMetaColWidth"
        >
          <template #default="{ row }">
            <span>{{ formatDisplayNumber(row.metaValues[index]) }}</span>
          </template>
        </el-table-column>
        <el-table-column
          v-for="(header, index) in sizeHeadersForView"
          :key="'size-' + index"
          :label="header"
          :min-width="sizeValueColWidth"
        >
          <template #default="{ row }">
            <span>{{ formatDisplayNumber(row.sizeValues[index]) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { formatDisplayNumber } from '@/utils/display-number'

interface SizeInfoRow {
  metaValues: unknown[]
  sizeValues: unknown[]
}

defineProps<{
  hasSizeInfo: boolean
  sizeInfoRowsForView: SizeInfoRow[]
  sizeMetaHeadersForView: string[]
  sizeHeadersForView: string[]
  sizeMetaColWidth: number
  sizeValueColWidth: number
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

.block-body {
  border: 1px solid #dcdfe6;
  border-radius: 2px;
  padding: 6px 8px;
}

.table-full {
  width: 100%;
}

.compact-table :deep(.el-table__cell) {
  padding: 1px 1px;
  font-size: 12px;
  color: #303133;
}

.size-table :deep(.el-table__cell) {
  font-size: 12px;
}
</style>

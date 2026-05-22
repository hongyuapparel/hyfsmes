<template>
  <section v-if="hasSizeInfo" class="block">
    <div class="block-title">D 尺寸信息</div>
    <div class="block-body">
      <!-- 原生表格 + table-layout:auto：列按内容自适应，能放下则单行，
           放不下则压缩换行铺满，屏幕与打印都不裁切、不横向滚动。 -->
      <table class="detail-grid-table">
        <thead>
          <tr>
            <th v-for="(header, index) in sizeMetaHeadersForView" :key="'meta-' + index">
              {{ header }}
            </th>
            <th v-for="(header, index) in sizeHeadersForView" :key="'size-' + index">
              {{ header }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in sizeInfoRowsForView" :key="rowIndex">
            <td v-for="(header, index) in sizeMetaHeadersForView" :key="'meta-' + index">
              {{ formatDisplayNumber(row.metaValues[index]) }}
            </td>
            <td v-for="(header, index) in sizeHeadersForView" :key="'size-' + index">
              {{ formatDisplayNumber(row.sizeValues[index]) }}
            </td>
          </tr>
        </tbody>
      </table>
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
</style>

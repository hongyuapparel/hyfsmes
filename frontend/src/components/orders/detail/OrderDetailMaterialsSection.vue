<template>
  <section v-if="hasMaterials" class="block block-materials">
    <div class="block-title">C 物料信息</div>
    <div class="block-body">
      <el-table
        :data="materialsForView"
        border
        size="small"
        class="compact-table table-full materials-table"
      >
        <el-table-column
          v-for="col in materialColumns"
          :key="`material-col-${col.key}`"
          :prop="col.key"
          :label="col.label"
          :min-width="col.minWidth"
          :show-overflow-tooltip="col.showOverflowTooltip"
        >
          <template #default="{ row }">
            {{ formatDetailMaterialCell(row, col.key) }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </section>
</template>

<script setup lang="ts">
interface DynamicColumn {
  key: string
  label: string
  minWidth: number
  showOverflowTooltip?: boolean
}

defineProps<{
  hasMaterials: boolean
  materialsForView: Record<string, unknown>[]
  materialColumns: DynamicColumn[]
  formatDetailMaterialCell: (row: Record<string, unknown>, key: string) => string
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

.materials-table :deep(.el-table__body .el-table__cell) {
  word-break: break-word;
}
</style>

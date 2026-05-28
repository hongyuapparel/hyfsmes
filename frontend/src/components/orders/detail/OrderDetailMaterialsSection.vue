<template>
  <section v-if="hasMaterials" class="block block-materials">
    <div class="block-title">C 物料信息</div>
    <div class="block-body">
      <!-- 原生表格 + table-layout:auto：列按内容自适应，与 B/D 表一致。 -->
      <table class="detail-grid-table is-centered">
        <thead>
          <tr>
            <th v-for="col in materialColumns" :key="`material-col-${col.key}`">
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in materialsForView" :key="rowIndex">
            <td v-for="col in materialColumns" :key="`material-col-${col.key}`">
              <template v-if="col.key === 'referenceImageUrl'">
                <AppImageThumb
                  v-if="row[col.key]"
                  :raw-url="String(row[col.key])"
                  :width="32"
                  :height="32"
                />
                <span v-else>—</span>
              </template>
              <template v-else>
                {{ formatDetailMaterialCell(row, col.key) }}
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import AppImageThumb from '@/components/AppImageThumb.vue'

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
</style>

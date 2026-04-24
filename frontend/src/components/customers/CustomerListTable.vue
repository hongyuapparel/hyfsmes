<template>
  <div>
    <div v-if="selectedCount" class="table-selection-count">已选 {{ selectedCount }} 项</div>
    <div ref="tableShellRef" class="list-page-table-shell">
      <el-table
        :data="list"
        border
        stripe
        :height="tableHeight"
        @selection-change="$emit('selection-change', $event)"
        @sort-change="$emit('sort-change', $event)"
      >
        <el-table-column
          type="selection"
          width="50"
          align="center"
          header-align="center"
          class-name="selection-column"
          header-class-name="selection-column"
        />
        <el-table-column
          v-for="field in fields"
          :key="field.code"
          :prop="field.code"
          :label="field.label"
          :min-width="field.type === 'date' ? 110 : 100"
          :sortable="field.sortable ? 'custom' : false"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <span v-if="field.type === 'date'">{{ formatDate(row[field.code]) }}</span>
            <span v-else>{{ row[field.code] ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$emit('edit', row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { CustomerItem } from '@/api/customers'
import type { FieldDefinition } from '@/fields'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'

defineProps<{
  list: CustomerItem[]
  fields: FieldDefinition[]
  selectedCount: number
}>()

defineEmits<{
  (event: 'selection-change', rows: CustomerItem[]): void
  (event: 'sort-change', payload: { prop?: string; order?: string }): void
  (event: 'edit', row: CustomerItem): void
}>()

const tableShellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(tableShellRef)

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

:deep(.selection-column .cell) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 0;
  padding-right: 0;
}
</style>

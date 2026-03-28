<template>
  <div class="cutting-qty-matrix">
    <el-table
      :data="rows"
      border
      class="cutting-qty-matrix__table"
      size="small"
      :max-height="matrixMaxHeight"
      table-layout="fixed"
    >
      <el-table-column prop="colorName" label="颜色" width="100" fixed />
      <el-table-column
        v-for="(header, idx) in headers"
        :key="idx"
        :label="header"
        min-width="88"
        align="center"
      >
        <template #default="{ row }">
          <span v-if="readonly" class="cutting-qty-matrix__cell-text">{{
            formatDisplayNumber(row.quantities[idx] ?? 0)
          }}</span>
          <el-input-number
            v-else
            :model-value="row.quantities[idx] ?? 0"
            :min="0"
            :precision="0"
            :controls="false"
            size="small"
            class="cutting-qty-matrix__input"
            @update:model-value="(v: number | undefined) => onCell(row, idx, v)"
          />
        </template>
      </el-table-column>
      <el-table-column label="合计" width="80" align="right">
        <template #default="{ row }">
          {{ formatDisplayNumber(rowTotal(row)) }}
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="100">
        <template #default="{ row }">
          <span v-if="readonly" class="cutting-qty-matrix__cell-text">{{ (row.remark || '').trim() || '—' }}</span>
          <el-input v-else v-model="row.remark" size="small" placeholder="备注" clearable />
        </template>
      </el-table-column>
    </el-table>
    <div class="cutting-qty-matrix__footer">
      实际裁剪数量合计：<strong>{{ formatDisplayNumber(grandTotal) }}</strong>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDisplayNumber } from '@/utils/display-number'

export interface CuttingQtyRow {
  colorName: string
  quantities: number[]
  remark?: string
}

const props = withDefaults(
  defineProps<{
    headers: string[]
    modelValue: CuttingQtyRow[]
    matrixMaxHeight?: number
    readonly?: boolean
  }>(),
  { readonly: false },
)

const emit = defineEmits<{
  'update:modelValue': [v: CuttingQtyRow[]]
}>()

const rows = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const grandTotal = computed(() =>
  (props.modelValue ?? []).reduce((sum, r) => sum + rowTotal(r), 0),
)

function rowTotal(row: CuttingQtyRow): number {
  const qs = Array.isArray(row?.quantities) ? row.quantities : []
  return qs.reduce((s, v) => s + (Number(v) || 0), 0)
}

function onCell(row: CuttingQtyRow, idx: number, v: number | undefined) {
  if (props.readonly) return
  const next = rows.value.map((r) => {
    if (r !== row) return r
    const q = [...(r.quantities ?? [])]
    while (q.length <= idx) q.push(0)
    q[idx] = v == null || Number.isNaN(Number(v)) ? 0 : Math.max(0, Math.floor(Number(v)))
    return { ...r, quantities: q }
  })
  rows.value = next
}
</script>

<style scoped>
.cutting-qty-matrix__table {
  width: 100%;
}

.cutting-qty-matrix__input {
  width: 100%;
  max-width: 84px;
}

.cutting-qty-matrix__input :deep(.el-input__wrapper) {
  padding-left: 6px;
  padding-right: 6px;
}

.cutting-qty-matrix__footer {
  margin-top: 8px;
  text-align: right;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.cutting-qty-matrix__cell-text {
  font-variant-numeric: tabular-nums;
}
</style>

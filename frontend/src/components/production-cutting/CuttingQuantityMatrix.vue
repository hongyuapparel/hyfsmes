<template>
  <div class="cutting-qty-matrix">
    <el-table
      :data="rows"
      border
      class="cutting-qty-matrix__table editable-grid"
      size="small"
      :max-height="matrixMaxHeight"
      table-layout="fixed"
    >
      <el-table-column label="颜色" min-width="120" width="148" fixed>
        <template #default="{ row }">
          <span class="cutting-qty-matrix__color">
            <AppImageThumb
              v-if="row.imageUrl"
              :raw-url="row.imageUrl"
              variant="table"
              :width="28"
              :height="28"
            />
            <span>{{ row.colorName }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column
        v-for="(header, idx) in headers"
        :key="idx"
        :label="header"
        min-width="88"
        align="center"
      >
        <template #default="{ row, $index }">
          <span v-if="readonly" class="cutting-qty-matrix__cell-text">{{
            formatDisplayNumber(row.quantities[idx] ?? 0)
          }}</span>
          <span v-else :data-cell-r="$index" :data-cell-c="idx" class="cutting-qty-matrix__cell">
            <el-input-number
              :model-value="row.quantities[idx] ?? 0"
              :min="0"
              :max="getCellMax ? getCellMax($index, idx) : undefined"
              :precision="0"
              :controls="false"
              size="small"
              class="cutting-qty-matrix__input"
              @update:model-value="(v: number | undefined) => onCell(row, idx, v)"
              @keydown="onMatrixCellKeydown"
              @focus="selectAllOnFocus"
            />
          </span>
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
      {{ footerLabel }}：<strong>{{ formatDisplayNumber(grandTotal) }}</strong>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import { formatDisplayNumber } from '@/utils/display-number'
import { onMatrixCellKeydown, selectAllOnFocus } from '@/utils/matrix-cell-nav'

export interface CuttingQtyRow {
  colorName: string
  quantities: number[]
  remark?: string
  /** 订单计划行的颜色参考图（仅显示，不随登记提交） */
  imageUrl?: string
}

const props = withDefaults(
  defineProps<{
    headers: string[]
    modelValue: CuttingQtyRow[]
    matrixMaxHeight?: number
    readonly?: boolean
    /** 脚注合计文案，默认"实际裁剪数量合计"；其他环节复用时传入对应文案 */
    footerLabel?: string
    /** 每格上限（如车缝/入库不可超过裁床数）：传 (rowIdx, colIdx) => max | undefined */
    getCellMax?: (rowIdx: number, colIdx: number) => number | undefined
  }>(),
  { readonly: false, footerLabel: '实际裁剪数量合计' },
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

.cutting-qty-matrix__table :deep(.el-table__cell) {
  padding: 0;
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

.cutting-qty-matrix__color {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
}

</style>

<template>
  <AppDialog
    v-model="visible"
    title="登记收货"
    width="900"
    destroy-on-close
    @close="emit('close')"
  >
    <template v-if="dialog.row">
      <div class="register-brief register-brief-inline">
        <span><span class="brief-label">订单号</span>{{ dialog.row.orderNo }}</span>
        <span class="brief-sep">·</span>
        <span><span class="brief-label">SKU</span>{{ dialog.row.skuCode }}</span>
      </div>
      <div v-if="dialog.formLoading" class="register-loading">加载尺寸细数...</div>
      <template v-else-if="dialog.sizeHeaders?.length">
        <p class="register-qty-tip">按颜色分别登记尾部收货数；每格不可超过对应颜色的车缝数。</p>
        <div
          v-for="(plan, ri) in dialog.planColorRows"
          :key="plan.colorName + ri"
          class="color-register-block"
        >
          <div class="color-register-title">{{ plan.colorName }}</div>
          <el-table
            :data="rowsForColor(ri)"
            border
            size="small"
            class="editable-grid color-register-table"
            style="width: 100%"
            :row-class-name="rowClassName"
          >
            <el-table-column label="" width="80" align="right">
              <template #default="{ row }">
                <span :class="{ 'cell-input-label': row.kind === 'input' }">{{ row.label }}</span>
              </template>
            </el-table-column>
            <el-table-column
              v-for="(h, ci) in dialog.sizeHeaders"
              :key="ci"
              :label="h"
              min-width="72"
              align="center"
            >
              <template #default="{ row }">
                <template v-if="row.kind === 'readonly'">
                  {{ formatDisplayNumber(row.values[ci] ?? 0) }}
                </template>
                <span v-else :data-cell-r="0" :data-cell-c="ci" class="cell-input">
                  <el-input-number
                    v-model="dialog.tailReceivedQuantitiesByColor[ri].quantities[ci]"
                    :min="0"
                    :max="getCellMax(ri, ci)"
                    :precision="0"
                    :controls="false"
                    size="small"
                    style="width: 100%"
                    @keydown="onMatrixCellKeydown"
                    @focus="selectAllOnFocus"
                  />
                </span>
              </template>
            </el-table-column>
            <el-table-column label="合计" width="68" align="right">
              <template #default="{ row }">
                <strong v-if="row.kind === 'input'">{{ formatDisplayNumber(sumColorInput(ri)) }}</strong>
                <span v-else>{{ formatDisplayNumber(sumReadonly(row.values)) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <p class="register-qty-grand">尾部收货数总合计：<strong>{{ formatDisplayNumber(tailTotal) }}</strong></p>
      </template>
    </template>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="dialog.submitting" @click="emit('submit')">确定</el-button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatDisplayNumber } from '@/utils/display-number'
import { onMatrixCellKeydown, selectAllOnFocus } from '@/utils/matrix-cell-nav'
import type { FinishingListItem } from '@/api/production-finishing'

interface ColorRow {
  colorName: string
  quantities: number[]
}

interface SizeTableRow {
  key: string
  label: string
  values: (number | null)[]
}

interface ReceiveDialogState {
  visible: boolean
  submitting: boolean
  formLoading: boolean
  row: FinishingListItem | null
  headers: string[]
  sizeHeaders: string[]
  sewingRow: (number | null)[]
  planColorRows: ColorRow[]
  cutColorRows: ColorRow[]
  sewingColorRows: ColorRow[]
  tailReceivedQuantitiesByColor: ColorRow[]
}

const props = defineProps<{
  modelValue: boolean
  dialog: ReceiveDialogState
  sizeTableRows: SizeTableRow[]
  tailTotal: number | string
  getCellMax: (rowIdx: number, colIdx: number) => number | undefined
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  submit: []
}>()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => emit('update:modelValue', v))

type BlockRow =
  | { kind: 'readonly'; label: string; values: number[] }
  | { kind: 'input'; label: string }

function rowsForColor(ri: number): BlockRow[] {
  const orderQ = props.dialog.planColorRows[ri]?.quantities ?? []
  const cutQ = props.dialog.cutColorRows[ri]?.quantities ?? []
  const sewQ = props.dialog.sewingColorRows[ri]?.quantities ?? []
  return [
    { kind: 'readonly', label: '订单数量', values: orderQ },
    { kind: 'readonly', label: '裁床数量', values: cutQ },
    { kind: 'readonly', label: '车缝数量', values: sewQ },
    { kind: 'input', label: '尾部收货数' },
  ]
}

function sumReadonly(values: number[]): number {
  return (values ?? []).reduce((s, n) => s + (Number(n) || 0), 0)
}

function sumColorInput(ri: number): number {
  return (props.dialog.tailReceivedQuantitiesByColor[ri]?.quantities ?? []).reduce((s, n) => s + (Number(n) || 0), 0)
}

function rowClassName({ row }: { row: BlockRow }): string {
  return row.kind === 'input' ? 'register-input-row' : ''
}
</script>

<style scoped>
.register-brief {
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  background: var(--el-fill-color-light);
  border-radius: var(--radius);
  font-size: var(--font-size-caption, 12px);
}

.register-brief > div + div {
  margin-top: 4px;
}

.register-brief-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  margin-bottom: 8px;
}

.register-brief-inline .brief-label {
  color: var(--el-text-color-secondary);
  margin-right: 4px;
}

.register-brief-inline .brief-sep {
  color: var(--el-text-color-placeholder);
}

.register-loading {
  padding: var(--space-md);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.register-qty-tip {
  margin: 0 0 12px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.color-register-block {
  margin-bottom: 14px;
}

.color-register-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 6px;
  color: var(--el-text-color-primary);
}

.color-register-block:last-child {
  margin-bottom: 0;
}

.cell-input-label {
  font-weight: 600;
  color: var(--el-color-primary);
}

:deep(.register-input-row > td.el-table__cell) {
  background-color: var(--el-color-primary-light-9);
}

.register-qty-grand {
  margin: 12px 0 0;
  text-align: right;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.register-qty-grand strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}
</style>

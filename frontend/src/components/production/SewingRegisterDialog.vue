<template>
  <AppDialog
    v-model="visible"
    title="登记车缝完成"
    width="720"
    destroy-on-close
    @close="emit('close')"
  >
    <template v-if="dialog.row">
      <div class="register-brief register-brief-inline">
        <span><span class="brief-label">订单号</span>{{ dialog.row.orderNo }}</span>
        <span class="brief-sep">·</span>
        <span><span class="brief-label">SKU</span>{{ dialog.row.skuCode }}</span>
      </div>
      <div v-if="completeLoading" class="register-loading">加载尺寸细数...</div>
      <template v-else-if="form.sizeHeaders?.length">
        <p class="register-qty-tip">
          <template v-if="cutSkipped">此订单未登记裁床数据，车缝数量按订单计划填写（每格上限 = 订单计划该色该码）。</template>
          <template v-else>按颜色分别登记车缝数量；每格不可超过对应颜色的裁床数。</template>
        </p>
        <div
          v-for="(plan, ri) in form.orderColorRows"
          :key="plan.colorName + ri"
          class="color-register-block"
        >
          <div class="color-register-title">
            <AppImageThumb v-if="plan.imageUrl" :raw-url="plan.imageUrl" variant="compact" />
            <span>{{ plan.colorName }}</span>
          </div>
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
              v-for="(h, ci) in form.sizeHeaders"
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
                    v-model="form.sewingQuantitiesByColor[ri].quantities[ci]"
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
                <strong v-if="row.kind === 'input'">{{ formatDisplayNumber(sumColorRowInput(ri)) }}</strong>
                <span v-else>{{ formatDisplayNumber(sumReadonly(row.values)) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <p class="register-qty-grand">车缝数量总合计：<strong>{{ formatDisplayNumber(sewingTotal) }}</strong></p>
      </template>
      <el-form
        ref="internalFormRef"
        :model="form"
        :rules="rules"
        label-width="70px"
        class="register-form register-form-inline"
        size="small"
      >
        <div class="defect-row">
          <el-form-item label="次品数" prop="defectQuantity" class="defect-qty-item">
            <el-input-number
              v-model="form.defectQuantity"
              :min="0"
              :precision="0"
              :controls="false"
              size="small"
              style="width: 90px"
            />
          </el-form-item>
          <el-form-item label="次品说明" prop="defectReason" class="defect-reason-item">
            <el-input
              v-model="form.defectReason"
              placeholder="填写次品原因或说明"
              maxlength="200"
              size="small"
              clearable
            />
          </el-form-item>
        </div>
      </el-form>
    </template>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="dialog.submitting" @click="emit('submit')">完成</el-button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { SewingListItem } from '@/api/production-sewing'
import AppImageThumb from '@/components/AppImageThumb.vue'
import { formatDisplayNumber } from '@/utils/display-number'
import { onMatrixCellKeydown, selectAllOnFocus } from '@/utils/matrix-cell-nav'

interface ColorRow {
  colorName: string
  quantities: number[]
  imageUrl?: string
}

interface RegisterForm {
  headers: string[]
  sizeHeaders: string[]
  orderRow: (number | null)[]
  cutRow: (number | null)[]
  orderColorRows: ColorRow[]
  cutColorRows: ColorRow[]
  sewingQuantitiesByColor: ColorRow[]
  defectQuantity: number
  defectReason: string
}

interface SizeTableRow {
  key: string
  label: string
  values: (number | null)[]
}

interface DialogState {
  visible: boolean
  submitting: boolean
  row: SewingListItem | null
}

const props = defineProps<{
  dialog: DialogState
  form: RegisterForm
  rules: FormRules
  completeLoading: boolean
  sizeTableRows: SizeTableRow[]
  sewingTotal: number
  getCellMax: (rowIdx: number, colIdx: number) => number | undefined
  cutSkipped?: boolean
}>()

type ColorBlockRow =
  | { kind: 'readonly'; label: string; values: number[] }
  | { kind: 'input'; label: string }

function rowsForColor(ri: number): ColorBlockRow[] {
  const orderQ = props.form.orderColorRows[ri]?.quantities ?? []
  const cutQ = props.form.cutColorRows[ri]?.quantities ?? []
  return [
    { kind: 'readonly', label: '订单数量', values: orderQ },
    { kind: 'readonly', label: '裁床数量', values: cutQ },
    { kind: 'input', label: '车缝数量' },
  ]
}

function sumReadonly(values: number[]): number {
  return (values ?? []).reduce((s, n) => s + (Number(n) || 0), 0)
}

function sumColorRowInput(ri: number): number {
  return (props.form.sewingQuantitiesByColor[ri]?.quantities ?? []).reduce((s, n) => s + (Number(n) || 0), 0)
}

function rowClassName({ row }: { row: ColorBlockRow }): string {
  return row.kind === 'input' ? 'register-input-row' : ''
}

const emit = defineEmits<{
  (e: 'update:dialog', val: DialogState): void
  (e: 'close'): void
  (e: 'submit'): void
}>()

const visible = computed({
  get: () => props.dialog.visible,
  set: (v) => emit('update:dialog', { ...props.dialog, visible: v }),
})

const internalFormRef = ref<FormInstance>()

defineExpose({ formRef: internalFormRef })
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

.register-form-inline {
  margin-top: 8px;
}

.defect-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.defect-qty-item {
  margin-bottom: 0;
}

.defect-reason-item {
  flex: 1;
  margin-bottom: 0;
}

.register-loading {
  padding: var(--space-md);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.register-qty-title {
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 13px;
}

.register-qty-table {
  margin-bottom: 8px;
}

.register-qty-sum {
  margin: 0 0 var(--space-sm);
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.register-form {
  margin-top: var(--space-sm);
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
  display: flex;
  align-items: center;
  gap: 6px;
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

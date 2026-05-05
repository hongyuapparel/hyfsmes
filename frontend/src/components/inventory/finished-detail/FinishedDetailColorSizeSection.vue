<template>
  <FinishedCreateSizeMatrix
    v-if="sizeHeaders.length && colorSizeRows.length"
    v-model:size-headers="sizeHeadersModel"
    v-model:size-rows="sizeRowsModel"
    v-model:unit-price="unitPriceModel"
    :summary-method="getMatrixSummary"
    :sum-detail-row-qty="sumRowQty"
    :create-row-total-price="rowTotalPrice"
    :structure-readonly="!metaEditing"
    :quantity-readonly="true"
    :image-editable="metaEditing"
    :unit-price-editable="metaEditing"
    :unit-price-readonly-text="tableUnitPrice"
    :show-row-meta-columns="true"
    :show-inheritance-tip="true"
    :show-header-actions="metaEditing"
    :allow-structure-actions="false"
    :row-meta-readonly="!metaEditing"
    :warehouse-options="warehouseOptions"
    :inventory-type-options="inventoryTypeOptions"
    :department-options="departmentOptions"
    @add-color-row="emit('addColorRow')"
    @add-size-column="emit('addSizeColumn')"
    @remove-color-row="(index) => emit('removeColorRow', index)"
    @remove-size-column="(index) => emit('removeSizeColumn', index)"
    @apply-basic-info-to-all-rows="emit('applyBasicInfoToAllRows')"
    @row-meta-change="onRowMetaChange"
    @save-color-image="onSaveColorImage"
  />
  <div v-else class="detail-section">
    <div class="detail-section-title">颜色图片与码数明细</div>
    <div class="detail-muted">暂无颜色尺码明细（未关联订单或订单未维护颜色尺码）。</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import FinishedCreateSizeMatrix from '@/components/inventory/FinishedCreateSizeMatrix.vue'
import type { FinishedCreateRowMetaField } from '@/composables/useFinishedCreateForm'

type MatrixRow = {
  _key: string
  colorName: string
  imageUrl: string
  quantities: number[]
  department: string
  inventoryTypeId: number | null
  warehouseId: number | null
  location: string
  _overrides?: Partial<Record<FinishedCreateRowMetaField, boolean>>
}

const props = defineProps<{
  metaEditing: boolean
  sizeHeaders: string[]
  colorSizeRows: MatrixRow[]
  unitPrice: string
  tableUnitPrice: string
  warehouseOptions: Array<{ id: number; label: string }>
  inventoryTypeOptions: Array<{ id: number; label: string }>
  departmentOptions: Array<{ value: string; label: string }>
  sumRowQty: (quantities: unknown[]) => number
  rowTotalPrice: (quantities: unknown[]) => string
}>()

const emit = defineEmits<{
  (e: 'addColorRow'): void
  (e: 'addSizeColumn'): void
  (e: 'removeColorRow', index: number): void
  (e: 'removeSizeColumn', index: number): void
  (e: 'applyBasicInfoToAllRows'): void
  (e: 'rowMetaChange', rowKey: string, field: FinishedCreateRowMetaField, value: string | number | null): void
  (e: 'saveColorImage', colorName: string, url: string): void
  (e: 'updateUnitPrice', value: string): void
}>()

const sizeHeadersModel = computed({
  get: () => props.sizeHeaders,
  set: (_value: string[]) => {},
})

const sizeRowsModel = computed<MatrixRow[]>({
  get: () => props.colorSizeRows,
  set: (_value: MatrixRow[]) => {},
})

const unitPriceModel = computed({
  get: () => props.unitPrice,
  set: (value: string) => emit('updateUnitPrice', value),
})

function getMatrixSummary({ columns }: { columns: Array<{ label?: string }> }) {
  const headerLength = props.sizeHeaders.length
  const totalQty = props.colorSizeRows.reduce((sum, row) => sum + props.sumRowQty(row.quantities), 0)
  return columns.map((_, index) => {
    if (index === 0) return '汇总'
    if (index === 2 + headerLength) return String(totalQty)
    if (index === 3 + headerLength) return props.tableUnitPrice
    if (index === 4 + headerLength) return props.rowTotalPrice([totalQty])
    return ''
  })
}

function onSaveColorImage(row: MatrixRow, url: string) {
  emit('saveColorImage', row.colorName, url)
}

function onRowMetaChange(rowKey: string, field: FinishedCreateRowMetaField, value: string | number | null) {
  emit('rowMetaChange', rowKey, field, value)
}
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
.detail-muted { font-size: 12px; color: var(--el-text-color-secondary); }
</style>

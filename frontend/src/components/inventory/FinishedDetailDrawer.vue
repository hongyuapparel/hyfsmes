<template>
  <AppDrawer
    :model-value="modelValue"
    title="库存详情"
    :size="900"
    :min-size="760"
    :resizable="true"
    class="finished-detail-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading" class="detail-wrap">
      <div v-if="data" class="detail-sections">
        <el-tabs v-model="activeDetailTab" class="detail-tabs">
          <!-- 库存明细：基本信息 + 颜色尺码合并在一个 tab -->
          <el-tab-pane label="库存明细" name="size">
            <FinishedDetailBasicInfoSection
              :stock="stockInfo"
              :display-product-image="displayProductImage"
              :meta-editing="metaEditing"
              :can-edit="canEditStock"
              :saving="saving"
              :edit-form="editForm"
              :inventory-type-options="inventoryTypeOptions"
              :warehouse-options="warehouseOptions"
              :department-options="departmentOptions"
              :find-inventory-type-label="findInventoryTypeLabel"
              :find-warehouse-label="findWarehouseLabel"
              :update-field="updateEditFormField"
              @toggle-edit-mode="toggleEditMode"
              @save-meta="handleSaveMeta"
            />
            <FinishedDetailColorSizeSection
              :meta-editing="metaEditing"
              :size-headers="editSizeHeaders"
              :color-size-rows="editSizeRows"
              :unit-price="editForm.unitPrice"
              :table-unit-price="tableUnitPrice"
              :warehouse-options="warehouseOptions"
              :inventory-type-options="inventoryTypeOptions"
              :department-options="departmentOptions"
              :sum-row-qty="sumRowQty"
              :row-total-price="rowTotalPrice"
              @add-color-row="addDetailColorRow(detailMatrixMeta)"
              @add-size-column="addDetailSizeColumn"
              @remove-color-row="removeDetailColorRow"
              @remove-size-column="removeDetailSizeColumn"
              @apply-basic-info-to-all-rows="syncRowsFromBasicInfo(detailMatrixMeta)"
              @row-meta-change="onDetailRowMetaChange"
              @row-unit-price-change="setDetailRowUnitPrice"
              @save-color-image="handleSaveColorImage"
              @update-unit-price="(value) => updateEditFormField('unitPrice', value)"
            />
          </el-tab-pane>

          <el-tab-pane label="操作记录" name="logs" lazy>
            <OperationLogsSection :logs="adjustLogs" :can-rollback="canEditStock" @rollback="handleRollback" />
          </el-tab-pane>
        </el-tabs>
      </div>
      <div v-else class="detail-muted">暂无数据</div>
    </div>
  </AppDrawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import AppDrawer from '@/components/AppDrawer.vue'
import { sumRowQty } from '@/composables/useFinishedDetailHelpers'
import type { FinishedDetailEditForm } from '@/composables/useFinishedDetailData'
import { useFinishedDetailData } from '@/composables/useFinishedDetailData'
import { useFinishedDetailMatrixEdit } from '@/composables/useFinishedDetailMatrixEdit'
import type { FinishedCreateRowMetaField } from '@/composables/useFinishedCreateForm'
import type { NormalizedStoredBreakdownSnapshot } from '@/utils/finishedStockTableUtils'
import FinishedDetailBasicInfoSection from '@/components/inventory/finished-detail/FinishedDetailBasicInfoSection.vue'
import FinishedDetailColorSizeSection from '@/components/inventory/finished-detail/FinishedDetailColorSizeSection.vue'
import OperationLogsSection from '@/components/common/OperationLogsSection.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    stockId: number | null
    initialColorName: string | null
    initialQuantity: number | null
    groupProductImage: string
    groupSizeHeaders: string[]
    groupColorSizeSnapshot: NormalizedStoredBreakdownSnapshot | null
    groupColorImages: Array<{ colorName: string; imageUrl: string }>
    inventoryTypeOptions: { id: number; label: string }[]
    warehouseOptions: { id: number; label: string }[]
    departmentOptions: { value: string; label: string }[]
  }>(),
  {
    initialColorName: null,
    initialQuantity: null,
    groupProductImage: '',
    groupSizeHeaders: () => [],
    groupColorImages: () => [],
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'colorImagesSynced', stockId: number, colorImages: unknown[]): void
  (e: 'colorImageSaved', payload: { stockId: number; colorName: string; imageUrl: string }): void
  (e: 'metaSaved'): void
}>()

const activeDetailTab = ref('size')

// 修改已有库存需要 inventory_finished_edit 权限（默认仅超级管理员有，可在角色与权限授权给主管）
const authStore = useAuthStore()
const canEditStock = computed(() => authStore.hasPermission('inventory_finished_edit'))

const {
  editSizeHeaders,
  editSizeRows,
  resetEditMatrix,
  syncRowsFromBasicInfo,
  addDetailColorRow,
  addDetailSizeColumn,
  removeDetailColorRow,
  removeDetailSizeColumn,
  setDetailRowMetaField,
  setDetailRowUnitPrice,
  buildColorMeta,
} = useFinishedDetailMatrixEdit()

const {
  loading,
  saving,
  data,
  editForm,
  metaEditing,
  colorImageMap,
  adjustLogs,
  displayProductImage,
  displaySizeHeaders,
  displayColorSizeRows,
  tableUnitPrice,
  rowTotalPrice,
  findInventoryTypeLabel,
  findWarehouseLabel,
  toggleEditMode,
  saveMeta,
  saveColorImage,
  rollbackLog,
  openDetail,
} = useFinishedDetailData({
  inventoryTypeOptions: () => props.inventoryTypeOptions,
  warehouseOptions: () => props.warehouseOptions,
  buildColorMeta: () => buildColorMeta(),
  onColorImagesSynced: (stockId, colorImages) => emit('colorImagesSynced', stockId, colorImages),
  onColorImageSaved: (payload) => emit('colorImageSaved', payload),
  onMetaSaved: () => emit('metaSaved'),
})

const stockInfo = computed(
  () =>
    ((data.value?.stock as Record<string, unknown> | undefined) ?? {
      skuCode: '',
      inventoryTypeId: null,
      warehouseId: null,
      department: '',
      location: '',
    }) as {
      skuCode?: string
      inventoryTypeId?: number | null
      warehouseId?: number | null
      department?: string
      location?: string
    },
)

const detailMatrixMeta = computed(() => ({
  department: metaEditing.value ? editForm.department : (stockInfo.value.department ?? ''),
  inventoryTypeId: metaEditing.value ? editForm.inventoryTypeId : (stockInfo.value.inventoryTypeId ?? null),
  warehouseId: metaEditing.value ? editForm.warehouseId : (stockInfo.value.warehouseId ?? null),
  location: metaEditing.value ? editForm.location : (stockInfo.value.location ?? ''),
}))

function resetDetailMatrixFromDisplay() {
  resetEditMatrix(displaySizeHeaders.value, displayColorSizeRows.value, colorImageMap.value, detailMatrixMeta.value)
}

function updateEditFormField<K extends keyof FinishedDetailEditForm>(
  key: K,
  value: FinishedDetailEditForm[K],
) {
  editForm[key] = value
}

function handleSaveMeta() {
  if (!props.stockId) return
  saveMeta(props.stockId)
}

function handleSaveColorImage(colorName: string, url: string) {
  if (!props.stockId) return
  saveColorImage(props.stockId, colorName, url)
}

function handleRollback(logId: number) {
  if (!props.stockId) return
  rollbackLog(props.stockId, logId)
}

function onDetailRowMetaChange(
  rowKey: string,
  field: FinishedCreateRowMetaField,
  value: string | number | null,
) {
  // 仅改动该行（互不干扰）；基础信息不再被某一行带着跑，保存时按每行的 stockId 归库
  setDetailRowMetaField(rowKey, field, value)
}

watch(
  () => [props.modelValue, props.stockId] as const,
  ([visible, stockId]) => {
    if (visible && stockId) {
      openDetail({
        stockId,
        groupProductImage: props.groupProductImage,
        groupSizeHeaders: props.groupSizeHeaders,
        groupColorSizeSnapshot: props.groupColorSizeSnapshot,
        groupColorImages: props.groupColorImages,
        initialColorName: props.initialColorName,
        initialQuantity: props.initialQuantity,
      })
      activeDetailTab.value = 'size'
    }
  },
)

// 仅深度监听与矩阵相关的派生数据；不要把整个 data.value（含上百条操作日志快照）放进
// deep watch，否则每次都会深度遍历数百 KB 数据，拖慢打开/保存。
watch(
  () => [displaySizeHeaders.value, displayColorSizeRows.value, colorImageMap.value] as const,
  () => {
    if (!metaEditing.value) resetDetailMatrixFromDisplay()
  },
  { deep: true },
)

watch(
  () => metaEditing.value,
  () => resetDetailMatrixFromDisplay(),
)
</script>

<style scoped>
.detail-wrap {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 0 12px 8px 12px;
}
.detail-sections { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.detail-tabs {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.detail-tabs :deep(.el-tabs__content) {
  height: calc(100% - 40px);
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.detail-tabs :deep(.el-tab-pane) { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.detail-muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* el-drawer overrides */
:deep(.el-drawer__header) { margin-bottom: 0; padding-bottom: 0; }
:deep(.el-drawer__body) { padding-top: 0; }
:deep(.el-form-item__label),
:deep(.el-input__inner),
:deep(.el-select__selected-item),
:deep(.el-table),
:deep(.el-table th),
:deep(.el-table td) { font-size: 12px; }
</style>

<style>
/* tooltip 弹层在 body 下，需用全局样式；通过 popper-class 精确作用范围 */
.finished-qty-popper {
  padding: 0;
}

.finished-qty-popper .el-popper__arrow::before {
  border: 1px solid var(--el-border-color-lighter);
}

.finished-qty-popper .qty-tooltip {
  max-width: 520px;
  padding: 10px 12px;
}

.finished-qty-popper .qty-tooltip-loading,
.finished-qty-popper .qty-tooltip-error,
.finished-qty-popper .qty-tooltip-empty {
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1.4;
}

.finished-qty-popper .qty-tooltip-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.finished-qty-popper .qty-tooltip-row {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(44px, auto);
  align-items: center;
  gap: 2px;
}

.finished-qty-popper .qty-tooltip-cell {
  padding: 4px 6px;
  border-radius: 4px;
  background: #f5f6f8;
  color: var(--el-text-color-regular);
  border: 1px solid var(--el-border-color-lighter);
  text-align: center;
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
}

.finished-qty-popper .qty-tooltip-head .qty-tooltip-cell {
  background: #eef1f6;
  font-weight: 600;
}

.finished-qty-popper .qty-tooltip-color {
  min-width: 72px;
}
</style>

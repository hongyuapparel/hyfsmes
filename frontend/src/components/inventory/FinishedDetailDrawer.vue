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
              :order-no="orderNo"
              :display-product-image="displayProductImage"
              :meta-editing="metaEditing"
              :saving="saving"
              :edit-form="editForm"
              :inventory-type-options="inventoryTypeOptions"
              :warehouse-options="warehouseOptions"
              :department-options="departmentOptions"
              :format-date-time="formatDateTime"
              :find-inventory-type-label="findInventoryTypeLabel"
              :find-warehouse-label="findWarehouseLabel"
              :update-field="updateEditFormField"
              @toggle-edit-mode="toggleEditMode"
              @save-meta="handleSaveMeta"
            />
            <FinishedDetailColorSizeSection
              :meta-editing="metaEditing"
              :size-headers="displaySizeHeaders"
              :color-size-rows="displayColorSizeRows"
              :color-image-map="colorImageMap"
              :unit-price="editForm.unitPrice"
              :table-unit-price="tableUnitPrice"
              :sum-row-qty="sumRowQty"
              :row-total-price="rowTotalPrice"
              :get-color-size-summary="getColorSizeSummary"
              @save-color-image="handleSaveColorImage"
              @update-unit-price="(value) => updateEditFormField('unitPrice', value)"
            />
          </el-tab-pane>

          <el-tab-pane label="操作记录" name="logs">
            <FinishedDetailLogsSection :logs="adjustLogs" />
          </el-tab-pane>
        </el-tabs>
      </div>
      <div v-else class="detail-muted">暂无数据</div>
    </div>
  </AppDrawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppDrawer from '@/components/AppDrawer.vue'
import { formatDateTime } from '@/utils/date-format'
import { sumRowQty } from '@/composables/useFinishedDetailHelpers'
import type { FinishedDetailEditForm } from '@/composables/useFinishedDetailData'
import { useFinishedDetailData } from '@/composables/useFinishedDetailData'
import type { NormalizedStoredBreakdownSnapshot } from '@/utils/finishedStockTableUtils'
import FinishedDetailBasicInfoSection from '@/components/inventory/finished-detail/FinishedDetailBasicInfoSection.vue'
import FinishedDetailColorSizeSection from '@/components/inventory/finished-detail/FinishedDetailColorSizeSection.vue'
import FinishedDetailLogsSection from '@/components/inventory/finished-detail/FinishedDetailLogsSection.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    stockId: number | null
    initialColorName: string | null
    initialQuantity: number | null
    groupProductImage: string
    groupSizeHeaders: string[]
    groupColorSizeSnapshot: NormalizedStoredBreakdownSnapshot | null
    inventoryTypeOptions: { id: number; label: string }[]
    warehouseOptions: { id: number; label: string }[]
    departmentOptions: { value: string; label: string }[]
  }>(),
  {
    initialColorName: null,
    initialQuantity: null,
    groupProductImage: '',
    groupSizeHeaders: () => [],
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'colorImagesSynced', stockId: number, colorImages: unknown[]): void
  (e: 'colorImageSaved', payload: { stockId: number; colorName: string; imageUrl: string }): void
  (e: 'metaSaved'): void
}>()

const activeDetailTab = ref('size')

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
  getColorSizeSummary,
  findInventoryTypeLabel,
  findWarehouseLabel,
  toggleEditMode,
  saveMeta,
  saveColorImage,
  openDetail,
} = useFinishedDetailData({
  inventoryTypeOptions: () => props.inventoryTypeOptions,
  warehouseOptions: () => props.warehouseOptions,
  onColorImagesSynced: (stockId, colorImages) => emit('colorImagesSynced', stockId, colorImages),
  onColorImageSaved: (payload) => emit('colorImageSaved', payload),
  onMetaSaved: () => emit('metaSaved'),
})

const stockInfo = computed(
  () =>
    ((data.value?.stock as Record<string, unknown> | undefined) ?? {
      createdAt: '',
      skuCode: '',
      customerName: '',
      inventoryTypeId: null,
      warehouseId: null,
      department: '',
      location: '',
    }) as {
      createdAt?: string
      skuCode?: string
      customerName?: string
      inventoryTypeId?: number | null
      warehouseId?: number | null
      department?: string
      location?: string
    },
)

const orderNo = computed(() => String((data.value?.orderNo as string | undefined) ?? ''))

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

watch(
  () => [props.modelValue, props.stockId] as const,
  ([visible, stockId]) => {
    if (visible && stockId) {
      openDetail({
        stockId,
        groupProductImage: props.groupProductImage,
        groupSizeHeaders: props.groupSizeHeaders,
        groupColorSizeSnapshot: props.groupColorSizeSnapshot,
        initialColorName: props.initialColorName,
        initialQuantity: props.initialQuantity,
      })
      activeDetailTab.value = 'size'
    }
  },
)
</script>

<style scoped>
.detail-wrap {
  padding: 0 12px 12px 12px;
}
.detail-sections {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.detail-tabs {
  min-width: 0;
}
.detail-tabs :deep(.el-tabs__content) {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.detail-tabs :deep(.el-tab-pane) {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.detail-muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* el-drawer overrides */
:deep(.el-drawer__header) { margin-bottom: 6px; padding-bottom: 0; }
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

<template>
  <AppDrawer
    :model-value="modelValue"
    :title="quickAddSource ? '新增库存数量' : '新增库存'"
    :size="980"
    :min-size="760"
    :max-size="1280"
    :resizable="true"
    class="finished-create-drawer"
    @update:model-value="onDrawerVisibleChange"
    @closed="resetCreateForm"
  >
    <el-form
      ref="createFormRef"
      :model="createForm"
      :rules="createRules"
      label-width="90px"
      class="create-form-grid"
    >
      <div class="create-sections">
        <FinishedBasicInfoGrid title="基础信息与产品图" image-label="产品图">
          <div class="detail-basic-label">SKU</div>
          <div class="detail-basic-value">
            <el-input v-model="createForm.skuCode" placeholder="选择 SKU" clearable size="small" :disabled="Boolean(quickAddSource)">
              <template #suffix>
                <el-button v-if="!quickAddSource" link type="primary" size="small" @click.stop="openCreateSkuDialog">选择</el-button>
              </template>
            </el-input>
          </div>
          <div class="detail-basic-label">部门</div>
          <div class="detail-basic-value">
            <el-select v-model="createForm.department" placeholder="请选择部门" filterable clearable size="small">
              <el-option
                v-for="opt in departmentOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
          <div class="detail-basic-label">库存类型</div>
          <div class="detail-basic-value">
            <el-select
              v-model="createForm.inventoryTypeId"
              placeholder="请选择库存类型"
              filterable
              clearable
              size="small"
            >
              <el-option
                v-for="opt in inventoryTypeOptions"
                :key="opt.id"
                :label="opt.label"
                :value="opt.id"
              />
            </el-select>
          </div>
          <div class="detail-basic-label">仓库</div>
          <div class="detail-basic-value">
            <el-select v-model="createForm.warehouseId" placeholder="请选择仓库" filterable clearable size="small">
              <el-option
                v-for="opt in warehouseOptions"
                :key="opt.id"
                :label="opt.label"
                :value="opt.id"
              />
            </el-select>
          </div>
          <div class="detail-basic-label">存放地址</div>
          <div class="detail-basic-value">
            <el-input v-model="createForm.location" placeholder="存放地址（默认值）" clearable size="small" />
          </div>
          <div class="detail-basic-label">备注</div>
          <div class="detail-basic-value">
            <el-input v-model="createForm.remark" placeholder="选填" clearable size="small" />
          </div>
          <template #image>
            <ImageUploadArea v-model="createForm.imageUrl" compact />
          </template>
        </FinishedBasicInfoGrid>

        <FinishedCreateSizeMatrix
          v-model:size-headers="createSizeHeaders"
          v-model:size-rows="createSizeRows"
          v-model:unit-price="createForm.unitPrice"
          :summary-method="getCreateColorSizeSummary"
          :sum-detail-row-qty="sumDetailRowQty"
          :create-row-total-price="createRowTotalPrice"
          :quantity-readonly="false"
          :image-editable="true"
          :show-row-meta-columns="true"
          :show-inheritance-tip="true"
          :warehouse-options="warehouseOptions"
          :inventory-type-options="inventoryTypeOptions"
          :department-options="departmentOptions"
          @add-color-row="addCreateColorRow"
          @add-size-column="addCreateSizeColumn"
          @remove-color-row="removeCreateColorRow"
          @remove-size-column="removeCreateSizeColumn"
          @apply-basic-info-to-all-rows="applyBasicInfoToAllRows"
          @row-meta-change="onRowMetaChange"
        />
      </div>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="createSubmitting" @click="submitCreate">确定</el-button>
    </template>
  </AppDrawer>

  <el-dialog v-model="createSkuDialogVisible" title="选择 SKU" width="760px" destroy-on-close>
    <el-input
      v-model="createSkuKeyword"
      placeholder="输入 SKU 或客户搜索"
      clearable
      style="max-width: 320px; margin-bottom: 10px"
    />
    <el-table
      v-loading="createSkuDialogLoading"
      :data="filteredCreateSkuProducts"
      border
      stripe
      height="420"
    >
      <el-table-column label="图片" width="90" align="center">
        <template #default="{ row }">
          <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" variant="table" />
          <span v-else class="text-placeholder">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="skuCode" label="SKU 编号" min-width="160" />
      <el-table-column label="客户" min-width="180">
        <template #default="{ row }">{{ row.customer?.companyName || '-' }}</template>
      </el-table-column>
      <el-table-column prop="productGroup" label="产品分组" min-width="180" show-overflow-tooltip />
      <el-table-column label="操作" width="90" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="onSkuSelected(row)">选择</el-button>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="createSkuDialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import AppDrawer from '@/components/AppDrawer.vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import FinishedBasicInfoGrid from '@/components/inventory/finished-shared/FinishedBasicInfoGrid.vue'
import FinishedCreateSizeMatrix from '@/components/inventory/FinishedCreateSizeMatrix.vue'
import {
  useFinishedCreateForm,
  type FinishedCreateQuickAddSource,
  type FinishedCreateRowMetaField,
  type FinishedCreateSizeRow,
} from '@/composables/useFinishedCreateForm'

const props = defineProps<{
  modelValue: boolean
  quickAddSource?: FinishedCreateQuickAddSource | null
  warehouseOptions: Array<{ id: number; label: string }>
  inventoryTypeOptions: Array<{ id: number; label: string }>
  departmentOptions: Array<{ value: string; label: string }>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'created'): void
}>()

const {
  createSubmitting,
  createFormRef,
  createSkuDialogVisible,
  createSkuDialogLoading,
  createSkuKeyword,
  quickAddSource,
  createForm,
  createRules,
  createSizeHeaders,
  createSizeRows,
  filteredCreateSkuProducts,
  sumDetailRowQty,
  createRowTotalPrice,
  getCreateColorSizeSummary,
  addCreateSizeColumn,
  addCreateColorRow,
  removeCreateColorRow,
  removeCreateSizeColumn,
  openCreateSkuDialog,
  onSkuSelected,
  resetCreateForm,
  submitCreate,
  setRowMetaField,
  applyBasicInfoToAllRows,
} = useFinishedCreateForm(
  () => emit('created'),
  () => emit('update:modelValue', false),
)

function onRowMetaChange<K extends FinishedCreateRowMetaField>(
  rowKey: string,
  field: K,
  value: FinishedCreateSizeRow[K],
) {
  setRowMetaField(rowKey, field, value)
}

function onDrawerVisibleChange(value: boolean) {
  emit('update:modelValue', value)
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    resetCreateForm(props.quickAddSource ?? null)
  },
)
</script>

<style scoped>
.create-form-grid { height: 100%; min-height: 0; }
.create-form-grid .el-form-item { margin-bottom: var(--space-sm); }
.create-sections { display: flex; flex-direction: column; gap: 10px; height: 100%; min-height: 0; overflow: hidden; padding: 0 12px 8px; }

:deep(.el-drawer__header) { margin-bottom: 0; padding-bottom: 0; }
:deep(.el-drawer__body) { padding-top: 0; }
:deep(.el-form-item__label),
:deep(.el-input__inner),
:deep(.el-select__selected-item),
:deep(.el-table),
:deep(.el-table th),
:deep(.el-table td) { font-size: 12px; }
</style>

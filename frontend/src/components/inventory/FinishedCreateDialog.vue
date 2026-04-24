<template>
  <el-dialog
    :model-value="modelValue"
    title="新增库存"
    width="960"
    destroy-on-close
    @update:model-value="onDialogVisibleChange"
    @close="resetCreateForm"
  >
    <el-form
      ref="createFormRef"
      :model="createForm"
      :rules="createRules"
      label-width="90px"
      class="create-form-grid"
    >
      <div class="create-sections">
        <div class="detail-section">
          <div class="detail-section-title">基础信息与产品图</div>
          <div class="detail-basic-main">
            <div class="detail-basic-grid">
              <div class="detail-basic-label">订单号</div>
              <div class="detail-basic-value">
                <el-input
                  v-model="createForm.orderNo"
                  placeholder="选填，不填则不关联订单"
                  clearable
                  size="small"
                  @blur="onOrderNoBlur"
                />
              </div>
              <div class="detail-basic-label">SKU</div>
              <div class="detail-basic-value">
                <el-input v-model="createForm.skuCode" placeholder="选择 SKU" clearable size="small">
                  <template #suffix>
                    <el-button link type="primary" size="small" @click.stop="openCreateSkuDialog">选择</el-button>
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
              <div class="detail-basic-label">备注</div>
              <div class="detail-basic-value detail-basic-value-span-3">
                <el-input v-model="createForm.remark" placeholder="选填" clearable size="small" />
              </div>
            </div>
            <div class="detail-product-image-panel">
              <div class="detail-image-label">产品图</div>
              <ImageUploadArea v-model="createForm.imageUrl" compact />
            </div>
          </div>
        </div>

        <FinishedCreateSizeMatrix
          v-model:size-headers="createSizeHeaders"
          v-model:size-rows="createSizeRows"
          v-model:unit-price="createForm.unitPrice"
          v-model:location="createForm.location"
          :summary-method="getCreateColorSizeSummary"
          :sum-detail-row-qty="sumDetailRowQty"
          :create-row-total-price="createRowTotalPrice"
          @add-color-row="addCreateColorRow"
          @add-size-column="addCreateSizeColumn"
          @remove-color-row="removeCreateColorRow"
          @remove-size-column="removeCreateSizeColumn"
        />
      </div>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="createSubmitting" @click="submitCreate">确定</el-button>
    </template>
  </el-dialog>

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
import AppImageThumb from '@/components/AppImageThumb.vue'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import FinishedCreateSizeMatrix from '@/components/inventory/FinishedCreateSizeMatrix.vue'
import { useFinishedCreateForm } from '@/composables/useFinishedCreateForm'

const props = defineProps<{
  modelValue: boolean
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
  onOrderNoBlur,
  submitCreate,
} = useFinishedCreateForm(
  () => emit('created'),
  () => emit('update:modelValue', false),
)

function onDialogVisibleChange(value: boolean) {
  emit('update:modelValue', value)
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    resetCreateForm()
  },
)
</script>

<style scoped>
.create-form-grid .el-form-item { margin-bottom: var(--space-sm); }
.create-sections { display: flex; flex-direction: column; gap: 10px; }
.detail-section { min-width: 0; flex: 1; padding: 10px 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; background: #fff; }
.detail-section-title { font-weight: 600; margin-bottom: 6px; font-size: 13px; color: var(--el-text-color-primary); }
.detail-basic-main { display: grid; grid-template-columns: minmax(0, 1fr) 170px; gap: 12px; align-items: stretch; }
.detail-basic-grid { display: grid; grid-template-columns: 96px minmax(0, 1fr) 96px minmax(0, 1fr); border: 1px solid var(--el-border-color-lighter); font-size: 12px; }
.detail-basic-label, .detail-basic-value { min-width: 0; padding: 7px 10px; border-right: 1px solid var(--el-border-color-lighter); border-bottom: 1px solid var(--el-border-color-lighter); display: flex; align-items: center; box-sizing: border-box; }
.detail-basic-label { font-weight: 600; color: var(--el-text-color-primary); background: var(--el-fill-color-lighter); }
.detail-basic-value { color: var(--el-text-color-regular); overflow: hidden; }
.detail-basic-value-span-3 { grid-column: 2 / 5; }
.detail-basic-grid > :nth-child(4n) { border-right: none; }
.detail-basic-grid > :nth-last-child(-n + 2) { border-bottom: none; }
.detail-product-image-panel { display: flex; flex-direction: column; gap: 6px; width: 170px; min-width: 170px; }
.detail-image-label { font-size: 12px; color: var(--el-text-color-secondary); }
</style>

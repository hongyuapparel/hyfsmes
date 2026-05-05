<template>
  <el-dialog
    v-model="dialogVisible"
    title="登记实际采购"
    width="1300"
    destroy-on-close
    @close="emit('closed')"
  >
    <template v-if="rows.length">
      <div class="register-batch-summary">已选 {{ rows.length }} 条采购物料</div>
      <el-table :data="rows" border size="small" max-height="420" class="register-batch-table">
        <el-table-column prop="orderNo" label="订单号" width="110" show-overflow-tooltip />
        <el-table-column prop="skuCode" label="SKU" width="100" show-overflow-tooltip />
        <el-table-column label="采购物料" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="register-material-cell">
              <div>{{ row.materialName || '-' }}</div>
              <div class="register-material-meta">
                {{ [row.materialType, row.color].filter(Boolean).join(' - ') || '-' }}
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="供应商" min-width="190">
          <template #default="{ row }">
            <el-select
              v-model="row.supplierName"
              filterable
              remote
              allow-create
              default-first-option
              clearable
              placeholder="选择或输入供应商"
              :remote-method="onSearchSuppliers"
              :loading="supplierLoading"
              @visible-change="onSupplierVisibleChange"
            >
              <el-option
                v-for="supplier in supplierOptions"
                :key="supplier.id"
                :label="supplier.name"
                :value="supplier.name"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="计划用量" width="100" align="center">
          <template #default="{ row }">{{ formatMaterialQuantity(row.planQuantity, row) }}</template>
        </el-table-column>
        <el-table-column label="实际数量" width="110" align="center">
          <template #default="{ row }">
            <el-input-number
              v-model="row.actualPurchaseQuantity"
              :min="0"
              :precision="2"
              :controls="false"
              style="width: 100%"
            />
          </template>
        </el-table-column>
        <el-table-column label="单价" width="100" align="center">
          <template #default="{ row }">
            <el-input v-model="row.unitPrice" clearable placeholder="0" :input-style="{ textAlign: 'center' }" />
          </template>
        </el-table-column>
        <el-table-column label="其他费用" width="105" align="center">
          <template #default="{ row }">
            <el-input v-model="row.otherCost" clearable placeholder="0" :input-style="{ textAlign: 'center' }" />
          </template>
        </el-table-column>
        <el-table-column label="金额" width="100" align="center">
          <template #default="{ row }">{{ calcPurchaseRegisterRowAmount(row) }}</template>
        </el-table-column>
        <el-table-column label="采购凭证" width="110" align="center">
          <template #default="{ row }">
            <ImageUploadArea v-model="row.imageUrl" :compact="true" class="register-row-upload" />
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="150">
          <template #default="{ row }">
            <el-input
              v-model="row.remark"
              placeholder="本行备注"
              maxlength="200"
              clearable
            />
          </template>
        </el-table-column>
      </el-table>
    </template>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="emit('submit')">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import { formatMaterialQuantity } from '@/utils/material-quantity-unit'
import {
  calcPurchaseRegisterRowAmount,
  type PurchaseRegisterDraftRow,
  type PurchaseSupplierOption,
} from '@/composables/usePurchaseRegisterDialog'

const props = defineProps<{
  modelValue: boolean
  rows: PurchaseRegisterDraftRow[]
  submitting: boolean
  supplierOptions: PurchaseSupplierOption[]
  supplierLoading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  closed: []
  submit: []
  'search-suppliers': [keyword: string]
  'supplier-visible-change': [visible: boolean]
}>()

const rows = toRef(props, 'rows')
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

function onSearchSuppliers(keyword: string) {
  emit('search-suppliers', keyword)
}

function onSupplierVisibleChange(visible: boolean) {
  emit('supplier-visible-change', visible)
}
</script>

<style scoped>
.register-batch-summary {
  margin-bottom: var(--space-sm);
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-caption);
}

.register-batch-table {
  margin-bottom: var(--space-md);
}

.register-batch-table :deep(.cell) {
  padding-left: 6px;
  padding-right: 6px;
}

.register-material-cell {
  line-height: 20px;
}

.register-material-meta {
  margin-top: 2px;
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-caption);
}

.register-row-upload {
  min-height: 48px;
}

.register-row-upload :deep(.image-upload-area) {
  min-height: 48px;
  padding: 4px;
}

.register-row-upload :deep(.placeholder-text) {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="领料"
    width="620"
    destroy-on-close
    @close="emit('closed')"
  >
    <template v-if="dialog.row">
      <div class="register-brief pick-brief-grid">
        <div><span class="pick-brief-label">订单号：</span>{{ dialog.row.orderNo }}</div>
        <div><span class="pick-brief-label">SKU：</span>{{ dialog.row.skuCode }}</div>
        <div><span class="pick-brief-label">物料：</span>{{ dialog.row.materialName }}</div>
        <div><span class="pick-brief-label">物料类型：</span>{{ displayMaterialType(dialog.row) }}</div>
        <div><span class="pick-brief-label">物料来源：</span>{{ dialog.row.materialSource || '-' }}</div>
        <div><span class="pick-brief-label">颜色：</span>{{ dialog.row.color || '-' }}</div>
        <div>
          <span class="pick-brief-label">计划用量：</span>{{ formatMaterialQuantity(dialog.row.planQuantity, dialog.row) }}
        </div>
        <div v-if="dialog.total > 1">
          <span class="pick-brief-label">当前处理：</span>{{ dialog.index + 1 }} / {{ dialog.total }}
        </div>
      </div>
      <el-alert
        v-if="dialog.row.materialSource === '客供面料'"
        type="warning"
        :closable="false"
        title="请联系对应业务员或跟单领取客供面料"
        style="margin-bottom: 12px"
      />
      <el-form ref="pickFormRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="库存来源类型">
          <el-select
            v-model="form.inventorySourceType"
            clearable
            placeholder="可选（不选则仅备注处理）"
            @change="onSourceTypeChange"
          >
            <el-option label="面料库存" value="fabric" />
            <el-option label="辅料库存" value="accessory" />
            <el-option label="成衣库存" value="finished" />
          </el-select>
        </el-form-item>
        <el-form-item label="具体库存">
          <el-select
            v-model="form.inventoryId"
            clearable
            filterable
            remote
            :remote-method="onInventorySearch"
            :loading="inventoryLoading"
            placeholder="先选择库存来源类型，再输入关键字搜索"
            :disabled="!form.inventorySourceType"
          >
            <el-option v-for="opt in inventoryOptions" :key="opt.id" :label="opt.label" :value="opt.id">
              <div class="pick-stock-option">
                <AppImageThumb
                  v-if="opt.imageUrl"
                  :raw-url="opt.imageUrl"
                  :width="28"
                  :height="28"
                />
                <span v-else class="pick-stock-thumb-empty">-</span>
                <span class="pick-stock-option-label">{{ opt.label }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="调取数量" prop="quantity">
          <div class="pick-qty-row">
            <el-input-number v-model="form.quantity" :min="0" :precision="2" :controls="false" style="width: 100%" />
            <span class="pick-qty-unit">{{ getMaterialQuantityUnit(dialog.row) || '单位' }}</span>
          </div>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="300" show-word-limit />
        </el-form-item>
      </el-form>
    </template>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="dialog.submitting" @click="submitForm">确认</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { PurchaseItemRow } from '@/api/production-purchase'
import AppImageThumb from '@/components/AppImageThumb.vue'
import { formatMaterialQuantity, getMaterialQuantityUnit } from '@/utils/material-quantity-unit'
import type {
  PickInventorySourceType,
  PurchasePickDialogState,
  PurchasePickForm,
  PurchasePickInventoryOption,
} from '@/composables/usePurchasePickDialog'

const props = defineProps<{
  modelValue: boolean
  dialog: PurchasePickDialogState
  form: PurchasePickForm
  rules: FormRules
  inventoryOptions: PurchasePickInventoryOption[]
  inventoryLoading: boolean
  displayMaterialType: (row: PurchaseItemRow) => string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  closed: []
  submit: []
  'source-type-change': [value: PickInventorySourceType | null]
  'inventory-search': [query: string]
}>()

const pickFormRef = ref<FormInstance>()
const dialog = toRef(props, 'dialog')
const form = toRef(props, 'form')
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

function onSourceTypeChange(value: string | number | boolean | null | undefined) {
  const next = value === 'fabric' || value === 'accessory' || value === 'finished' ? value : null
  emit('source-type-change', next)
}

function onInventorySearch(query: string) {
  emit('inventory-search', query)
}

async function submitForm() {
  await pickFormRef.value?.validate()
  emit('submit')
}
</script>

<style scoped>
.register-brief {
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  background: var(--el-fill-color-light);
  border-radius: var(--radius);
  font-size: var(--font-size-caption);
  color: var(--el-text-color-regular);
}

.register-brief > div + div {
  margin-top: 4px;
}

.pick-brief-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 16px;
}

.pick-brief-grid > div + div {
  margin-top: 0;
}

.pick-brief-label {
  color: var(--el-text-color-secondary);
}

.pick-stock-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pick-stock-thumb-empty {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 1px dashed var(--el-border-color-lighter);
  color: var(--el-text-color-placeholder);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.pick-stock-option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pick-qty-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.pick-qty-unit {
  color: var(--el-text-color-secondary);
  flex: 0 0 auto;
}
</style>

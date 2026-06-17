<template>
  <AppDrawer
    :model-value="visible"
    :title="titleText"
    :size="780"
    :min-size="600"
    :max-size="1120"
    :resizable="true"
    class="fabric-form-drawer"
    @update:model-value="emit('update:visible', $event)"
    @closed="onClose"
  >
    <div class="fabric-form-scroll">
      <!-- 新增面料：录入表单 -->
      <el-form v-if="isCreate" ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <div class="form-grid">
          <el-alert
            v-if="quickAddSource"
            class="span-2"
            type="info"
            :closable="false"
            show-icon
            :title="`已按「${quickAddSource.name || '-'}」回填，提交后会把本次数量增量到该记录`"
          />
          <el-form-item label="名称" prop="name">
            <el-input v-model="form.name" placeholder="面料名称/编号" clearable :disabled="Boolean(quickAddSource)" />
          </el-form-item>
          <el-form-item label="客户">
            <el-select v-model="form.customerName" placeholder="请选择客户（可选）" filterable clearable style="width: 100%" :disabled="Boolean(quickAddSource)">
              <el-option v-for="opt in customerOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="供应商">
            <el-select
              :key="fabricSupplierSelectKey"
              v-model="form.supplierId"
              placeholder="面料供应商（可选）"
              filterable
              clearable
              style="width: 100%"
              :loading="fabricSupplierOptionsLoading"
              :disabled="Boolean(quickAddSource)"
            >
              <el-option v-for="opt in fabricSupplierOptions" :key="opt.id" :label="opt.name" :value="opt.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="库存类型">
            <el-select v-model="form.inventoryTypeId" placeholder="库存类型（可选）" filterable clearable style="width: 100%" :disabled="Boolean(quickAddSource)">
              <el-option v-for="opt in inventoryTypeOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="仓库">
            <el-select v-model="form.warehouseId" placeholder="仓库（可选）" filterable clearable style="width: 100%" :disabled="Boolean(quickAddSource)">
              <el-option v-for="opt in warehouseOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="存放地址">
            <el-input v-model="form.storageLocation" placeholder="存放位置（可选）" clearable :disabled="Boolean(quickAddSource)" />
          </el-form-item>
          <el-form-item label="数量" prop="quantity">
            <el-input-number v-model="form.quantity" :min="0" :precision="2" controls-position="right" style="width: 100%" />
          </el-form-item>
          <el-form-item label="单位" prop="unit">
            <el-input v-model="form.unit" placeholder="如米、公斤" clearable :disabled="Boolean(quickAddSource)" />
          </el-form-item>
          <el-form-item class="span-2" label="图片" prop="imageUrl">
            <ImageUploadArea v-model="form.imageUrl" />
          </el-form-item>
          <el-form-item class="span-2" label="备注" prop="remark">
            <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注" clearable />
          </el-form-item>
        </div>
      </el-form>

      <!-- 详情 / 编辑：成品同款表格卡片 -->
      <FabricDetailView
        v-else
        :form="form"
        :is-view="isView"
        :is-edit="isEdit"
        :submitting="submitting"
        :customer-options="customerOptions"
        :fabric-supplier-options="fabricSupplierOptions"
        :fabric-supplier-select-key="fabricSupplierSelectKey"
        :fabric-supplier-options-loading="fabricSupplierOptionsLoading"
        :warehouse-options="warehouseOptions"
        :inventory-type-options="inventoryTypeOptions"
        :logs="logs"
        :logs-loading="logsLoading"
        :format-log-action="formatLogAction"
        @edit="emit('edit')"
        @exit-edit="emit('exitEdit')"
        @confirm="emit('confirm')"
      />
    </div>
    <template #footer>
      <el-button @click="emit('update:visible', false)">{{ isCreate ? '取消' : '关闭' }}</el-button>
      <el-button v-if="isCreate" type="primary" :loading="submitting" @click="emit('confirm')">确定</el-button>
    </template>
  </AppDrawer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { FabricItem, FabricSupplierOption, FabricOperationLog } from '@/api/inventory'
import type { FabricFormMode, FabricFormModel } from '@/composables/useFabricFormDialog'
import AppDrawer from '@/components/AppDrawer.vue'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import FabricDetailView from '@/components/inventory/FabricDetailView.vue'

const props = defineProps<{
  visible: boolean
  submitting: boolean
  mode: FabricFormMode
  quickAddSource: FabricItem | null
  form: FabricFormModel
  formRules: FormRules
  customerOptions: Array<{ label: string; value: string }>
  fabricSupplierOptions: FabricSupplierOption[]
  fabricSupplierSelectKey: number
  fabricSupplierOptionsLoading: boolean
  warehouseOptions: Array<{ id: number; label: string }>
  inventoryTypeOptions: Array<{ id: number; label: string }>
  logs: FabricOperationLog[]
  logsLoading: boolean
  formatLogAction: (action: string) => string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
  (e: 'close'): void
  (e: 'edit'): void
  (e: 'exitEdit'): void
}>()

const formRef = ref<FormInstance>()

const isView = computed(() => props.mode === 'view')
const isEdit = computed(() => props.mode === 'edit')
const isCreate = computed(() => props.mode === 'create')
const titleText = computed(() => (isView.value ? '面料详情' : isEdit.value ? '编辑面料' : '新增面料'))

function onClose() {
  formRef.value?.clearValidate()
  emit('close')
}

defineExpose({
  // 编辑态没有 el-form(formRef 为空)，返回已 resolve 的 Promise，避免 submitForm 里 .catch 报错
  validate: () => formRef.value?.validate() ?? Promise.resolve(),
  clearValidate: () => formRef.value?.clearValidate(),
})
</script>

<style scoped>
.fabric-form-scroll { height: 100%; min-height: 0; overflow-y: auto; padding: 4px 12px 8px 0; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 20px; align-items: start; }
.form-grid :deep(.el-form-item) { margin-bottom: 0; }
.span-2 { grid-column: 1 / -1; }
</style>

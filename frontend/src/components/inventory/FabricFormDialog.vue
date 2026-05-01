<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑面料' : '新增面料'"
    width="560"
    destroy-on-close
    @close="onClose"
  >
    <el-form ref="formRef" :model="form" :rules="formRules" label-width="88px">
      <el-alert
        v-if="quickAddSource"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 10px"
        :title="`已按「${quickAddSource.name || '-'}」回填，提交后会把本次数量增量到该记录`"
      />
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" placeholder="面料名称/编号" clearable :disabled="Boolean(quickAddSource)" />
      </el-form-item>
      <el-form-item label="数量" prop="quantity">
        <el-input-number
          v-model="form.quantity"
          :min="0"
          :precision="2"
          controls-position="right"
          style="width: 100%"
          :disabled="isEdit"
        />
      </el-form-item>
      <el-form-item label="单位" prop="unit">
        <el-input v-model="form.unit" placeholder="如米、公斤" clearable :disabled="Boolean(quickAddSource)" />
      </el-form-item>
      <el-form-item label="客户">
        <el-select
          v-model="form.customerName"
          placeholder="请选择客户（可选）"
          filterable
          clearable
          :disabled="Boolean(quickAddSource)"
        >
          <el-option
            v-for="opt in customerOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="供应商">
        <el-select
          :key="fabricSupplierSelectKey"
          v-model="form.supplierId"
          placeholder="面料供应商（可选），按名称中的连续文字筛选"
          filterable
          clearable
          :loading="fabricSupplierOptionsLoading"
          :disabled="Boolean(quickAddSource)"
        >
          <el-option
            v-for="opt in fabricSupplierOptions"
            :key="opt.id"
            :label="opt.name"
            :value="opt.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="仓库">
        <el-select v-model="form.warehouseId" placeholder="仓库（可选）" filterable clearable :disabled="Boolean(quickAddSource)">
          <el-option
            v-for="opt in warehouseOptions"
            :key="opt.id"
            :label="opt.label"
            :value="opt.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="存放地址">
        <el-input v-model="form.storageLocation" placeholder="存放位置（可选）" clearable :disabled="Boolean(quickAddSource)" />
      </el-form-item>
      <el-form-item label="图片" prop="imageUrl">
        <ImageUploadArea v-model="form.imageUrl" />
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注" clearable />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="emit('confirm')">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { FabricItem, FabricSupplierOption } from '@/api/inventory'
import ImageUploadArea from '@/components/ImageUploadArea.vue'

interface FabricFormModel {
  name: string
  quantity: number
  unit: string
  customerName: string
  supplierId: number | null
  warehouseId: number | null
  storageLocation: string
  imageUrl: string
  remark: string
}

const props = defineProps<{
  visible: boolean
  submitting: boolean
  isEdit: boolean
  quickAddSource: FabricItem | null
  form: FabricFormModel
  formRules: FormRules
  customerOptions: Array<{ label: string; value: string }>
  fabricSupplierOptions: FabricSupplierOption[]
  fabricSupplierSelectKey: number
  fabricSupplierOptionsLoading: boolean
  warehouseOptions: Array<{ id: number; label: string }>
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'confirm'): void
  (e: 'close'): void
}>()

const formRef = ref<FormInstance>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (v: boolean) => emit('update:visible', v),
})

function onClose() {
  formRef.value?.clearValidate()
  emit('close')
}

defineExpose({
  validate: () => formRef.value?.validate(),
  clearValidate: () => formRef.value?.clearValidate(),
})
</script>

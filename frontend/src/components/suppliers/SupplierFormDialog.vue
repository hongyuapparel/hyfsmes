<template>
  <el-dialog
    :model-value="visible"
    :title="isEdit ? '编辑供应商' : '新建供应商'"
    width="560"
    destroy-on-close
    @update:model-value="onVisibleChange"
    @close="handleClose"
  >
    <el-form :ref="setFormRef" :model="form" :rules="formRules" label-width="100px">
      <el-form-item label="供应商名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入供应商名称" clearable />
      </el-form-item>
      <el-form-item label="供应商类型" prop="supplierTypeId">
        <el-select
          v-model="form.supplierTypeId"
          placeholder="请选择供应商类型"
          clearable
          filterable
          style="width: 100%"
          @change="emit('form-type-change')"
        >
          <el-option
            v-for="option in supplierTypeOptions"
            :key="option.id"
            :label="option.label"
            :value="option.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="业务范围" prop="businessScopeIds">
        <el-tree-select
          v-model="form.businessScopeIds"
          placeholder="先选供应商类型后选择业务范围"
          clearable
          filterable
          multiple
          show-checkbox
          collapse-tags
          collapse-tags-tooltip
          :check-strictly="false"
          style="width: 100%"
          :disabled="!form.supplierTypeId"
          :data="businessScopeOptions"
          value-key="value"
          :props="{ label: 'label', value: 'value', children: 'children' }"
        />
      </el-form-item>
      <el-form-item label="联系人" prop="contactPerson">
        <el-input v-model="form.contactPerson" placeholder="联系人" clearable />
      </el-form-item>
      <el-form-item label="联系电话" prop="contactInfo">
        <el-input v-model="form.contactInfo" placeholder="联系电话" clearable />
      </el-form-item>
      <el-form-item label="工厂地址" prop="factoryAddress">
        <el-input v-model="form.factoryAddress" placeholder="工厂地址" type="textarea" :rows="2" clearable />
      </el-form-item>
      <el-form-item label="结款时间" prop="settlementTime">
        <el-input
          v-model="form.settlementTime"
          placeholder="如月结30天、季结、货到付款"
          clearable
        />
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="2"
          maxlength="500"
          show-word-limit
          placeholder="备注"
          clearable
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="onVisibleChange(false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="emit('submit')">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'
import type { SupplierFormModel } from '@/composables/useSupplierForm'
import type { BusinessScopeTreeNode } from '@/composables/useSupplierOptions'

const props = defineProps<{
  visible: boolean
  isEdit: boolean
  submitting: boolean
  formRef: { value: FormInstance | undefined }
  form: SupplierFormModel
  formRules: FormRules
  supplierTypeOptions: { id: number; label: string }[]
  businessScopeOptions: BusinessScopeTreeNode[]
}>()

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'form-type-change'): void
  (event: 'submit'): void
  (event: 'close'): void
}>()

function setFormRef(instance: FormInstance | undefined) {
  props.formRef.value = instance
}

function onVisibleChange(visible: boolean) {
  emit('update:visible', visible)
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <AppDialog
    v-model="visible"
    title="分单"
    width="460"
    destroy-on-close
    @close="emit('close')"
  >
    <el-form
      ref="internalFormRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      class="assign-form"
    >
      <el-form-item label="分单时间" prop="distributedAt">
        <el-date-picker
          v-model="form.distributedAt"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          placeholder="选择分单时间"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="交期" prop="factoryDueDate">
        <el-date-picker
          v-model="form.factoryDueDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="加工供应商需交货给我们的日期"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="加工供应商" prop="factoryName">
        <el-select
          v-model="form.factoryName"
          placeholder="请选择加工供应商"
          filterable
          clearable
          style="width: 100%"
        >
          <el-option
            v-for="s in factorySuppliers"
            :key="s.id"
            :label="s.name"
            :value="s.name"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="车缝加工费" prop="sewingFee">
        <el-input v-model="form.sewingFee" placeholder="0" clearable style="width: 100%">
          <template #prefix>
            <span class="currency-prefix">¥</span>
          </template>
        </el-input>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="dialog.submitting" @click="emit('submit')">确定</el-button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { SupplierItem } from '@/api/suppliers'

interface AssignForm {
  distributedAt: string
  factoryDueDate: string
  factoryName: string
  sewingFee: string
}

interface DialogState {
  visible: boolean
  submitting: boolean
}

const props = defineProps<{
  dialog: DialogState
  form: AssignForm
  rules: FormRules
  factorySuppliers: SupplierItem[]
}>()

const emit = defineEmits<{
  (e: 'update:dialog', val: DialogState): void
  (e: 'close'): void
  (e: 'submit'): void
}>()

const visible = computed({
  get: () => props.dialog.visible,
  set: (v) => emit('update:dialog', { ...props.dialog, visible: v }),
})

const internalFormRef = ref<FormInstance>()

defineExpose({ formRef: internalFormRef })
</script>

<style scoped>
.currency-prefix {
  color: var(--el-text-color-regular);
}
</style>

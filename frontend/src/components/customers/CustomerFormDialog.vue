<template>
  <el-dialog
    v-model="visibleModel"
    :title="isEdit ? '编辑客户' : '新建客户'"
    width="520"
    class="customer-form-dialog"
    @close="handleClose"
  >
    <el-form ref="formRef" :model="form" :rules="formRules" label-width="100">
      <el-form-item
        v-for="field in fields"
        :key="field.code"
        :label="field.label"
        :prop="field.code"
      >
        <el-input
          v-if="field.type === 'text'"
          v-model="form[field.code]"
          :placeholder="field.placeholder"
          :disabled="field.code === 'customerId'"
          type="text"
          size="default"
        />
        <el-date-picker
          v-else-if="field.type === 'date'"
          v-model="form[field.code]"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          size="default"
          style="width: 100%"
        />
        <el-tree-select
          v-else-if="field.type === 'select' && field.optionsKey === 'productGroups'"
          v-model="form[field.code]"
          :data="productGroupTreeSelectData"
          :placeholder="field.placeholder"
          filterable
          default-expand-all
          :render-after-expand="false"
          node-key="value"
          :props="{ label: 'label', value: 'value', children: 'children', disabled: 'disabled' }"
          size="default"
          style="width: 100%"
        />
        <el-select
          v-else-if="field.type === 'select'"
          v-model="form[field.code]"
          :placeholder="field.placeholder"
          filterable
          clearable
          size="default"
          style="width: 100%"
        >
          <el-option
            v-for="option in field.optionsKey === 'salespeople' ? salespeople : []"
            :key="option"
            :label="option"
            :value="option"
          />
        </el-select>
        <div v-else-if="field.type === 'phone'" class="phone-inputs">
          <el-input
            v-model="form.contactCountryCode"
            :placeholder="field.placeholder || '国家代码'"
            type="text"
            size="default"
            class="phone-country-code"
          />
          <el-input
            v-model="form.contactPhone"
            :placeholder="field.placeholderSuffix || '电话号码'"
            type="text"
            size="default"
            class="phone-number"
          />
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visibleModel = false">取消</el-button>
      <el-button type="primary" :loading="submitLoading" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { FieldDefinition } from '@/fields'
import type { ProductGroupTreeSelectNode } from '@/composables/useCustomerPage'

const props = defineProps<{
  visible: boolean
  isEdit: boolean
  fields: FieldDefinition[]
  form: Record<string, string | number | null>
  formRules: FormRules
  submitLoading: boolean
  salespeople: string[]
  productGroupTreeSelectData: ProductGroupTreeSelectNode[]
}>()

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void
  (event: 'submit'): void
  (event: 'close'): void
}>()

const formRef = ref<FormInstance>()
const visibleModel = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  emit('submit')
}

function handleClose() {
  formRef.value?.resetFields()
  emit('close')
}
</script>

<style scoped>
.phone-inputs {
  display: flex;
  gap: var(--space-sm);
  width: 100%;
}

.phone-inputs .phone-country-code {
  width: 100px;
  flex-shrink: 0;
}

.phone-inputs .phone-number {
  flex: 1;
}
</style>

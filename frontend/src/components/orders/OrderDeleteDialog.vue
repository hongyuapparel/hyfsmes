<template>
  <AppDialog
    :model-value="modelValue"
    title="移入回收站"
    width="480"
    destroy-on-close
    append-to-body
    @update:model-value="onDialogVisibleChange"
    @closed="resetForm"
  >
    <p class="delete-tip">
      将 {{ orderCount }} 条订单移入回收站，请选择删除原因；可在下方补充备注。
    </p>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="0">
      <el-form-item prop="reasonValue">
        <el-radio-group v-model="form.reasonValue" class="delete-reason-group">
          <el-radio
            v-for="item in ORDER_DELETE_REASON_OPTIONS"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item prop="remark">
        <el-input
          v-model="form.remark"
          type="textarea"
          :rows="3"
          maxlength="200"
          show-word-limit
          :placeholder="remarkPlaceholder"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="danger" :loading="submitting" @click="onSubmit">确认删除</el-button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { deleteOrders } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import {
  ORDER_DELETE_REASON_OPTIONS,
  formatOrderDeleteReason,
  getOrderDeleteReasonLabel,
  type OrderDeleteReasonValue,
} from '@/constants/order-delete-reasons'

const props = defineProps<{
  modelValue: boolean
  orderIds: number[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'deleted'): void
}>()

const formRef = ref<FormInstance>()
const submitting = ref(false)
const form = ref<{ reasonValue: OrderDeleteReasonValue; remark: string }>({
  reasonValue: 'customer_cancel',
  remark: '',
})

const orderCount = computed(() => props.orderIds.length)

const remarkPlaceholder = computed(() =>
  form.value.reasonValue === 'other'
    ? '请填写具体原因（必填）'
    : '可选：补充说明',
)

const rules = computed<FormRules>(() => ({
  reasonValue: [{ required: true, message: '请选择删除原因', trigger: 'change' }],
  remark: [
    {
      validator: (_rule, value, callback) => {
        if (form.value.reasonValue === 'other' && !(value ?? '').trim()) {
          callback(new Error('选择「其他」时请填写备注'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}))

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    resetForm()
  },
)

function onDialogVisibleChange(value: boolean) {
  emit('update:modelValue', value)
}

function closeDialog() {
  emit('update:modelValue', false)
}

function resetForm() {
  form.value = { reasonValue: 'customer_cancel', remark: '' }
  formRef.value?.clearValidate()
}

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || !props.orderIds.length) return

  const deleteReason = formatOrderDeleteReason(
    getOrderDeleteReasonLabel(form.value.reasonValue),
    form.value.remark,
  )

  submitting.value = true
  try {
    await deleteOrders(props.orderIds, deleteReason)
    ElMessage.success('已移入回收站')
    emit('update:modelValue', false)
    emit('deleted')
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '删除失败'))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.delete-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
}

.delete-reason-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.delete-reason-group :deep(.el-radio) {
  height: auto;
  margin-right: 0;
}
</style>

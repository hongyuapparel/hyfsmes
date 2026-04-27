<template>
  <el-dialog
    :model-value="modelValue"
    title="订单备注"
    width="640"
    destroy-on-close
    @update:model-value="onDialogVisibleChange"
  >
    <div class="remark-editor">
      <div class="remark-editor-label">备注内容：</div>
      <el-input
        v-model="remarkContent"
        type="textarea"
        :rows="4"
        maxlength="500"
        show-word-limit
        placeholder="填写本次特殊情况说明"
      />
    </div>
    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitRemark">
        提交备注
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { addOrderRemark } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const props = defineProps<{
  modelValue: boolean
  orderId: number | null
  initialRemark: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved'): void
}>()

const remarkContent = ref('')
const submitting = ref(false)

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    remarkContent.value = props.initialRemark ?? ''
  },
)

function onDialogVisibleChange(value: boolean) {
  emit('update:modelValue', value)
}

function closeDialog() {
  emit('update:modelValue', false)
}

async function submitRemark() {
  const content = remarkContent.value.trim()
  if (!props.orderId) {
    ElMessage.warning('未选择订单')
    return
  }
  if (!content) {
    ElMessage.warning('请先填写备注内容')
    return
  }
  submitting.value = true
  try {
    await addOrderRemark(props.orderId, content)
    ElMessage.success('备注已提交')
    emit('saved')
    emit('update:modelValue', false)
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '备注提交失败'))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.remark-editor {
  margin-top: 4px;
}

.remark-editor-label {
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--color-text, #303133);
}
</style>

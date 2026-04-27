<template>
  <el-dialog
    :model-value="modelValue"
    title="审核确认"
    width="520"
    destroy-on-close
    @update:model-value="onDialogVisibleChange"
    @closed="resetForm"
  >
    <div class="review-dialog-body">
      <p class="review-tip">
        请选择本次审核结果，可以退回为草稿并填写原因，或确认审单进入下一流程。
      </p>
      <p v-if="displayOrderNo" class="review-order-no">订单：{{ displayOrderNo }}</p>
      <el-input
        v-model="reason"
        type="textarea"
        :rows="3"
        maxlength="300"
        show-word-limit
        placeholder="退回为草稿时，请在此填写退回原因（必填）；确认审单时可留空。"
      />
    </div>
    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="warning" :loading="submittingReject" @click="reviewReject">
        退回为草稿
      </el-button>
      <el-button type="primary" :loading="submittingApprove" @click="reviewApprove">
        确认审单
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { reviewOrders, reviewRejectOrders } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const props = defineProps<{
  modelValue: boolean
  orderId: number | null
  orderNo: string
  orderIds?: number[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'reviewed'): void
}>()

const reason = ref('')
const submittingApprove = ref(false)
const submittingReject = ref(false)

const reviewIds = computed(() => {
  if (props.orderIds?.length) return props.orderIds.filter((id) => Number.isFinite(id))
  if (props.orderId) return [props.orderId]
  return []
})

const displayOrderNo = computed(() => {
  if (props.orderNo) return props.orderNo
  if (reviewIds.value.length > 1) return `已选 ${reviewIds.value.length} 条`
  return ''
})

function onDialogVisibleChange(value: boolean) {
  emit('update:modelValue', value)
}

function closeDialog() {
  emit('update:modelValue', false)
}

function resetForm() {
  reason.value = ''
}

async function reviewApprove() {
  if (!reviewIds.value.length) {
    ElMessage.warning('未选择待审核订单')
    return
  }
  submittingApprove.value = true
  try {
    await reviewOrders(reviewIds.value)
    ElMessage.success('审核成功')
    emit('reviewed')
    emit('update:modelValue', false)
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '审核失败'))
  } finally {
    submittingApprove.value = false
  }
}

async function reviewReject() {
  if (!reviewIds.value.length) {
    ElMessage.warning('未选择待审核订单')
    return
  }
  const rejectReason = reason.value.trim()
  if (!rejectReason) {
    ElMessage.warning('请输入退回原因')
    return
  }
  submittingReject.value = true
  try {
    await reviewRejectOrders(reviewIds.value, rejectReason)
    ElMessage.success('已退回为草稿')
    emit('reviewed')
    emit('update:modelValue', false)
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '退回失败'))
  } finally {
    submittingReject.value = false
  }
}
</script>

<style scoped>
.review-dialog-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.review-tip {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.review-order-no {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>

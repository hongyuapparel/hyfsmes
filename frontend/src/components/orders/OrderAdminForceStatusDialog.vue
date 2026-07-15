<template>
  <el-dialog
    v-model="visibleProxy"
    title="强制改状态"
    width="520px"
    destroy-on-close
    append-to-body
    align-center
    class="force-status-dialog"
    @closed="onClosed"
  >
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      class="force-status-alert"
      title="仅改订单主状态，不自动改生产登记，也不回滚库存出库/入库。"
      description="若相关工序仍为「完成」，约 2 分钟内定时调和可能再次推进状态——请同步用「编辑已提交生产数据」权限改正工序数据。"
    />
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" class="force-status-form">
      <el-form-item label="目标状态" prop="targetStatus">
        <el-select v-model="form.targetStatus" placeholder="选择目标状态" filterable style="width: 100%">
          <el-option
            v-for="item in statusOptions"
            :key="item.code"
            :label="item.label"
            :value="item.code"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="操作原因" prop="reason">
        <el-input
          v-model="form.reason"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          placeholder="请填写强制改状态的原因（必填）"
        />
      </el-form-item>
      <div v-if="orderIds.length > 1" class="batch-hint">
        将对已选的 {{ orderIds.length }} 条订单执行相同操作。
      </div>
    </el-form>
    <template #footer>
      <el-button @click="visibleProxy = false">取消</el-button>
      <el-button type="danger" :loading="submitting" @click="onSubmit">确认修改</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { forceOrderStatus } from '@/api/orders'
import { getOrderStatuses, type OrderStatusItem } from '@/api/order-status-config'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const props = defineProps<{
  modelValue: boolean
  orderIds: number[]
  getStatusLabel: (status: string) => string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'done'): void
}>()

const visibleProxy = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const formRef = ref<FormInstance>()
const submitting = ref(false)
const statusOptions = ref<OrderStatusItem[]>([])
const form = ref({
  targetStatus: '',
  reason: '',
})

const rules: FormRules = {
  targetStatus: [{ required: true, message: '请选择目标状态', trigger: 'change' }],
  reason: [{ required: true, message: '请填写操作原因', trigger: 'blur' }],
}

async function loadStatuses() {
  try {
    const res = await getOrderStatuses()
    statusOptions.value = (res.data ?? []).filter((s) => s.enabled)
  } catch {
    statusOptions.value = []
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    void loadStatuses()
    form.value = { targetStatus: '', reason: '' }
  },
)

function onClosed() {
  formRef.value?.resetFields()
}

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (!props.orderIds.length) return

  const targetLabel = statusOptions.value.find((s) => s.code === form.value.targetStatus)?.label
    ?? props.getStatusLabel(form.value.targetStatus)

  try {
    await ElMessageBox.confirm(
      `确定将 ${props.orderIds.length} 条订单强制改为「${targetLabel}」吗？\n仅改主状态，不自动修改生产登记数据。`,
      '二次确认',
      { type: 'warning', confirmButtonText: '确认修改', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  submitting.value = true
  const warnings: string[] = []
  let successCount = 0
  try {
    for (const id of props.orderIds) {
      try {
        const res = await forceOrderStatus(id, {
          targetStatus: form.value.targetStatus,
          reason: form.value.reason.trim(),
          resetSubsequent: false,
        })
        successCount += 1
        if (res.data?.warning) warnings.push(`订单 #${id}：${res.data.warning}`)
      } catch (e: unknown) {
        if (!isErrorHandled(e)) {
          ElMessage.error(getErrorMessage(e, `订单 #${id} 修改失败`))
        }
      }
    }
    if (successCount > 0) {
      ElMessage.success(`已成功修改 ${successCount} 条订单状态`)
      if (warnings.length) {
        ElMessage.warning(warnings.join('；'))
      }
      visibleProxy.value = false
      emit('done')
    }
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.force-status-alert {
  margin-bottom: 16px;
}

.force-status-form {
  margin-top: 8px;
}

.force-status-form :deep(.el-form-item__content) {
  min-width: 0;
}

.batch-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding-left: 100px;
}
</style>

<style>
.force-status-dialog .el-dialog__body {
  background: var(--el-bg-color);
}
</style>

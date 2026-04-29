<template>
  <el-dialog
    :model-value="modelValue"
    title="订单备注"
    width="640"
    destroy-on-close
    @update:model-value="onDialogVisibleChange"
  >
    <div class="remark-history" v-loading="loading">
      <div class="remark-section-title">历史备注</div>
      <el-empty v-if="!loading && !remarks.length" description="暂无备注" :image-size="64" />
      <div v-else class="remark-list">
        <div v-for="item in remarks" :key="item.id" class="remark-item">
          <div class="remark-meta">
            <span>{{ item.operatorUsername || '-' }}</span>
            <span>{{ formatRemarkTime(item.createdAt) }}</span>
          </div>
          <div class="remark-content">{{ item.content }}</div>
        </div>
      </div>
    </div>

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
import { addOrderRemark, getOrderRemarks, type OrderRemarkItem } from '@/api/orders'
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
const loading = ref(false)
const remarks = ref<OrderRemarkItem[]>([])
let loadSeq = 0

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    remarkContent.value = props.initialRemark ?? ''
    void loadRemarks()
  },
)

watch(
  () => props.orderId,
  () => {
    if (props.modelValue) void loadRemarks()
  },
)

function onDialogVisibleChange(value: boolean) {
  emit('update:modelValue', value)
}

function closeDialog() {
  emit('update:modelValue', false)
}

async function loadRemarks() {
  const orderId = props.orderId
  const seq = ++loadSeq
  remarks.value = []
  if (!orderId) return
  loading.value = true
  try {
    const res = await getOrderRemarks(orderId)
    if (seq === loadSeq) remarks.value = res.data ?? []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '备注加载失败'))
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

function formatRemarkTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || '-'
  return date.toLocaleString('zh-CN', { hour12: false })
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
.remark-history {
  min-height: 92px;
  margin-bottom: 16px;
}

.remark-section-title {
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--color-text, #303133);
}

.remark-list {
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--color-border, #dcdfe6);
  border-radius: var(--radius, 4px);
}

.remark-item {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border-light, #ebeef5);
}

.remark-item:last-child {
  border-bottom: 0;
}

.remark-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--color-muted-foreground, #7f8b99);
}

.remark-content {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  color: var(--color-text, #303133);
}

.remark-editor {
  margin-top: 4px;
}

.remark-editor-label {
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--color-text, #303133);
}
</style>

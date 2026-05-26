<template>
  <AppDialog
    v-model="visible"
    title="登记车缝完成"
    width="720"
    destroy-on-close
    @close="emit('close')"
  >
    <template v-if="dialog.row">
      <div class="register-brief">
        <div>订单号：{{ dialog.row.orderNo }}</div>
        <div>SKU：{{ dialog.row.skuCode }}</div>
      </div>
      <div v-if="completeLoading" class="register-loading">加载尺寸细数...</div>
      <template v-else-if="form.headers?.length">
        <div class="register-qty-title">尺寸细数</div>
        <el-table :data="sizeTableRows" border size="small" class="register-qty-table" style="width: 100%">
          <el-table-column prop="label" label="" width="90" align="right" />
          <el-table-column
            v-for="(h, idx) in form.headers"
            :key="idx"
            :label="h"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              <template v-if="row.key === 'order' || row.key === 'cut'">
                {{ row.values[idx] != null ? formatDisplayNumber(row.values[idx]) : '-' }}
              </template>
              <template
                v-else-if="row.key === 'sewing' && idx === form.headers.length - 1 && form.headers.length > 1"
              >
                {{ formatDisplayNumber(sewingTotal) }}
              </template>
              <template v-else>
                <el-input-number
                  v-model="form.sewingQuantities[idx]"
                  :min="0"
                  :max="form.cutRow[idx] != null ? Number(form.cutRow[idx]) : undefined"
                  :precision="0"
                  controls-position="right"
                  size="small"
                  style="width: 100%"
                />
              </template>
            </template>
          </el-table-column>
        </el-table>
        <p class="register-qty-sum">车缝数量合计：{{ formatDisplayNumber(sewingTotal) }}</p>
      </template>
      <el-form
        ref="internalFormRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        class="register-form"
      >
        <el-form-item label="次品数量" prop="defectQuantity">
          <el-input-number
            v-model="form.defectQuantity"
            :min="0"
            :precision="0"
            controls-position="right"
            style="width: 160px"
          />
        </el-form-item>
        <el-form-item label="次品说明" prop="defectReason">
          <el-input
            v-model="form.defectReason"
            type="textarea"
            :rows="3"
            placeholder="填写次品原因或说明"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
    </template>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="dialog.submitting" @click="emit('submit')">完成</el-button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { SewingListItem } from '@/api/production-sewing'
import { formatDisplayNumber } from '@/utils/display-number'

interface RegisterForm {
  headers: string[]
  orderRow: (number | null)[]
  cutRow: (number | null)[]
  sewingQuantities: number[]
  defectQuantity: number
  defectReason: string
}

interface SizeTableRow {
  key: string
  label: string
  values: (number | null)[]
}

interface DialogState {
  visible: boolean
  submitting: boolean
  row: SewingListItem | null
}

const props = defineProps<{
  dialog: DialogState
  form: RegisterForm
  rules: FormRules
  completeLoading: boolean
  sizeTableRows: SizeTableRow[]
  sewingTotal: number
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
.register-brief {
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  background: var(--el-fill-color-light);
  border-radius: var(--radius);
  font-size: var(--font-size-caption, 12px);
}

.register-brief > div + div {
  margin-top: 4px;
}

.register-loading {
  padding: var(--space-md);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.register-qty-title {
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 13px;
}

.register-qty-table {
  margin-bottom: 8px;
}

.register-qty-sum {
  margin: 0 0 var(--space-sm);
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.register-form {
  margin-top: var(--space-sm);
}
</style>

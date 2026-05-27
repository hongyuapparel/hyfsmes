<template>
  <AppDialog
    v-model="visible"
    title="登记收货"
    width="720"
    destroy-on-close
    @close="emit('close')"
  >
    <template v-if="dialog.row">
      <div class="register-brief">
        <div>订单号：{{ dialog.row.orderNo }}</div>
        <div>SKU：{{ dialog.row.skuCode }}</div>
      </div>
      <div v-if="dialog.formLoading" class="register-loading">加载尺寸细数...</div>
      <template v-else-if="dialog.headers?.length">
        <div class="register-qty-title">尺寸细数</div>
        <el-table :data="sizeTableRows" border size="small" class="register-qty-table" style="width: 100%">
          <el-table-column prop="label" label="" width="90" align="right" />
          <el-table-column
            v-for="(h, idx) in dialog.headers"
            :key="idx"
            :label="h"
            min-width="100"
            align="center"
          >
            <template #default="{ row }">
              <template v-if="row.key === 'order' || row.key === 'cut' || row.key === 'sewing'">
                {{ row.values[idx] != null ? formatDisplayNumber(row.values[idx]) : '-' }}
              </template>
              <template v-else-if="row.key === 'tail' && idx === dialog.headers.length - 1 && dialog.headers.length > 1">
                {{ tailTotal }}
              </template>
              <template v-else>
                <el-input-number
                  v-model="dialog.tailReceivedQuantities[idx]"
                  :min="0"
                  :max="dialog.sewingRow[idx] != null ? Number(dialog.sewingRow[idx]) : undefined"
                  :precision="0"
                  controls-position="right"
                  size="small"
                  style="width: 100%"
                />
              </template>
            </template>
          </el-table-column>
        </el-table>
        <p class="register-qty-sum">尾部收货数合计：{{ tailTotal }}</p>
      </template>
    </template>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="dialog.submitting" @click="emit('submit')">确定</el-button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatDisplayNumber } from '@/utils/display-number'
import type { FinishingListItem } from '@/api/production-finishing'

interface SizeTableRow {
  key: string
  label: string
  values: (number | null)[]
}

interface ReceiveDialogState {
  visible: boolean
  submitting: boolean
  formLoading: boolean
  row: FinishingListItem | null
  headers: string[]
  sewingRow: (number | null)[]
  tailReceivedQuantities: number[]
}

const props = defineProps<{
  modelValue: boolean
  dialog: ReceiveDialogState
  sizeTableRows: SizeTableRow[]
  tailTotal: number | string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  submit: []
}>()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => emit('update:modelValue', v))
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
</style>

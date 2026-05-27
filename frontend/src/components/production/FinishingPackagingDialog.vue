<template>
  <AppDialog
    v-model="visible"
    :title="dialog.mode === 'amend' ? '修改入库/次品' : '登记入库'"
    width="800"
    destroy-on-close
    @close="emit('close')"
  >
    <p v-if="dialog.mode === 'register'" class="dialog-tip">
      可分多次登记。「部分入库」保留在「尾部中」等待下一批；「全部入库」补齐剩余并推进到「尾部完成」。
    </p>
    <p v-else class="dialog-tip">
      在仓库尚未对「待仓处理」记录完成入库或发货前，可修正入库数与次品数；保存后将按新数量重建待仓记录。若待仓已处理，请改走仓库调整流程。
    </p>
    <div v-if="dialog.formLoading" class="register-loading">加载尺寸细数...</div>
    <template v-else>
      <div
        v-for="item in dialog.items"
        :key="item.row.orderId"
        class="packaging-block"
      >
        <div class="register-brief">
          <div>订单号：{{ item.row.orderNo }}</div>
          <div>SKU：{{ item.row.skuCode }}</div>
          <div>尾部收货数合计：{{ formatDisplayNumber(item.row.tailReceivedQty ?? 0) }}</div>
          <template v-if="dialog.mode === 'register'">
            <div v-if="alreadyInboundQty(item) > 0">
              已登记入库：{{ formatDisplayNumber(alreadyInboundQty(item)) }}
              <el-tag size="small" type="warning">本次为分批续登</el-tag>
            </div>
            <div>剩余可登记：{{ formatDisplayNumber(remainingQty(item)) }}</div>
          </template>
        </div>
        <template v-if="item.headers?.length">
          <div class="register-qty-title">尾部收货数 / 入库数</div>
          <el-table :data="packagingSizeTableRows(item)" border size="small" class="register-qty-table" style="width: 100%">
            <el-table-column prop="label" label="" width="100" align="right" />
            <el-table-column
              v-for="(h, hIdx) in item.headers"
              :key="hIdx"
              :label="h"
              min-width="90"
              align="center"
            >
              <template #default="{ row }">
                <template v-if="row.key === 'tail_received'">
                  {{ row.values[hIdx] != null ? formatDisplayNumber(row.values[hIdx]) : '-' }}
                </template>
                <template v-else-if="row.key === 'inbound'">
                  <template v-if="item.headers.length > 1 && hIdx === item.headers.length - 1">
                    {{ row.values[hIdx] != null ? formatDisplayNumber(row.values[hIdx]) : formatDisplayNumber(0) }}
                  </template>
                  <el-input-number
                    v-else
                    v-model="item.inboundQuantities[hIdx]"
                    :min="0"
                    :max="maxPackagingQtyForSize(item, hIdx)"
                    :precision="0"
                    controls-position="right"
                    size="small"
                    style="width: 100%"
                  />
                </template>
                <template v-else-if="row.key === 'defect'">
                  <template v-if="item.headers.length > 1 && hIdx === item.headers.length - 1">
                    {{ formatDisplayNumber(defectTotal(item)) }}
                  </template>
                  <el-input-number
                    v-else
                    v-model="item.defectQuantities[hIdx]"
                    :min="0"
                    :max="maxDefectQtyForSize(item, hIdx)"
                    :precision="0"
                    controls-position="right"
                    size="small"
                    style="width: 100%"
                  />
                </template>
                <template v-else>
                  {{ row.values[hIdx] != null ? formatDisplayNumber(row.values[hIdx]) : '-' }}
                </template>
              </template>
            </el-table-column>
          </el-table>
          <div class="packaging-extra">
            <el-form-item label="备注" class="packaging-form-item">
              <el-input
                v-model="item.remark"
                type="textarea"
                :rows="2"
                placeholder="选填"
                size="small"
                maxlength="200"
                show-word-limit
                style="width: 360px"
              />
            </el-form-item>
          </div>
        </template>
      </div>
    </template>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <template v-if="dialog.mode === 'amend'">
        <el-button type="primary" :loading="dialog.submitting" @click="emit('submit', 'full')">
          保存修改
        </el-button>
      </template>
      <template v-else>
        <el-button :loading="dialog.submitting" @click="emit('submit', 'partial')">部分入库</el-button>
        <el-button type="primary" :loading="dialog.submitting" @click="emit('submit', 'full')">全部入库</el-button>
      </template>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { formatDisplayNumber } from '@/utils/display-number'
import type { PackagingCompleteItem } from '@/composables/useFinishingPackaging'

interface PackagingSizeTableRow {
  key: string
  label: string
  values: (number | null | string)[]
}

interface PackagingDialogState {
  visible: boolean
  submitting: boolean
  formLoading: boolean
  mode: 'register' | 'amend'
  items: PackagingCompleteItem[]
}

const props = defineProps<{
  modelValue: boolean
  dialog: PackagingDialogState
  packagingSizeTableRows: (item: PackagingCompleteItem) => PackagingSizeTableRow[]
  defectTotal: (item: PackagingCompleteItem) => number
  alreadyInboundQty: (item: PackagingCompleteItem) => number
  remainingQty: (item: PackagingCompleteItem) => number
  maxPackagingQtyForSize: (item: PackagingCompleteItem, idx: number) => number
  maxDefectQtyForSize: (item: PackagingCompleteItem, idx: number) => number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  submit: [mode: 'partial' | 'full']
}>()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => emit('update:modelValue', v))
</script>

<style scoped>
.dialog-tip {
  margin: 0 0 var(--space-md);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

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

.packaging-block {
  margin-bottom: var(--space-md);
}

.packaging-block:last-child {
  margin-bottom: 0;
}

.packaging-extra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-md);
  margin-top: 8px;
}

.packaging-extra .packaging-form-item {
  margin-bottom: 0;
}
</style>

<template>
  <el-dialog
    :model-value="modelValue"
    title="出库"
    width="920"
    destroy-on-close
    @update:model-value="onDialogVisibleChange"
    @close="resetOutboundForm"
  >
    <el-form ref="outboundFormRef" :model="outboundForm" :rules="outboundRules" label-width="80px">
      <el-form-item label="领取人" prop="pickupUserId">
        <el-select
          v-model="outboundForm.pickupUserId"
          placeholder="请选择业务员"
          filterable
          clearable
          style="width: 260px"
        >
          <el-option
            v-for="opt in pickupUserOptions"
            :key="opt.id"
            :label="opt.displayName || opt.username"
            :value="opt.id"
          />
        </el-select>
      </el-form-item>

      <div class="outbound-batch-head">
        <span>客户：{{ selectedCustomer }}</span>
        <span>选中记录：{{ outboundItems.length }} 条</span>
        <span>出库总数：{{ outboundGrandTotal }}</span>
      </div>

      <div v-loading="outboundLoading" class="outbound-batch-list">
        <div v-for="group in groupedOutboundItems" :key="group.key" class="outbound-batch-card">
          <div class="outbound-card-meta">
            <div>SKU：{{ group.skuCode }}</div>
            <div>选中记录：{{ group.recordCount }} 条</div>
            <div>当前库存：{{ group.stockQuantity }}</div>
          </div>

          <el-table
            v-if="group.headers.length && group.rows.length"
            :data="group.rows"
            border
            size="small"
            class="outbound-size-table"
          >
            <el-table-column label="颜色" min-width="100" align="center" header-align="center">
              <template #default="{ row }">
                {{ row.row.colorName || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="图片" width="90" align="center" header-align="center">
              <template #default="{ row }">
                <AppImageThumb v-if="row.row.imageUrl" :raw-url="row.row.imageUrl" variant="table" />
                <span v-else class="text-placeholder">-</span>
              </template>
            </el-table-column>
            <el-table-column
              v-for="(header, hIdx) in group.headers"
              :key="`${group.key}-${header}-${hIdx}`"
              :label="header"
              min-width="82"
              align="center"
              header-align="center"
            >
              <template #default="{ row }">
                <el-input-number
                  :model-value="getDisplayQuantity(row, header)"
                  :min="0"
                  :precision="0"
                  :disabled="!hasSizeHeader(row.item, header)"
                  controls-position="right"
                  size="small"
                  class="outbound-qty-input"
                  @update:model-value="setDisplayQuantity(row, header, $event)"
                />
              </template>
            </el-table-column>
            <el-table-column label="合计" width="76" align="center" header-align="center">
              <template #default="{ row }">
                {{ getDisplayRowTotal(row) }}
              </template>
            </el-table-column>
          </el-table>
          <div v-else class="detail-muted">该记录暂无颜色尺码明细，无法按明细出库。</div>
          <div class="outbound-size-footer">该 SKU 合计：{{ getGroupTotal(group) }}</div>
        </div>
      </div>
    </el-form>

    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitOutbound">确定出库</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import {
  useFinishedOutboundDialog,
  type FinishedOutboundDialogItem,
  type FinishedOutboundDialogRow,
  type FinishedOutboundStockInfo,
} from '@/composables/useFinishedOutboundDialog'
import { getSizeHeaderKey, sortSizeHeaders } from '@/utils/sizeHeaders'

const props = defineProps<{
  modelValue: boolean
  stockItems: FinishedOutboundStockInfo[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submitted'): void
}>()

function closeDialog() {
  emit('update:modelValue', false)
}

const {
  outboundLoading,
  submitting,
  outboundFormRef,
  outboundForm,
  outboundRules,
  pickupUserOptions,
  outboundItems,
  outboundGrandTotal,
  loadPickupUsers,
  resetOutboundForm,
  initOutboundSizeList,
  getRowTotal,
  submitOutbound,
} = useFinishedOutboundDialog(() => emit('submitted'), closeDialog)

const selectedCustomer = computed(() => props.stockItems[0]?.customerName?.trim() || '-')

type DisplayOutboundRow = {
  item: FinishedOutboundDialogItem
  row: FinishedOutboundDialogRow
}

type OutboundSkuGroup = {
  key: string
  skuCode: string
  recordCount: number
  stockQuantity: number
  headers: string[]
  rows: DisplayOutboundRow[]
}

function mergeHeaders(left: string[], right: string[]): string[] {
  const merged = [...left]
  right.forEach((header) => {
    if (!merged.some((item) => getSizeHeaderKey(item) === getSizeHeaderKey(header))) merged.push(header)
  })
  return sortSizeHeaders(merged)
}

const groupedOutboundItems = computed<OutboundSkuGroup[]>(() => {
  const groups = new Map<string, OutboundSkuGroup>()
  outboundItems.value.forEach((item) => {
    const skuCode = item.stock.skuCode?.trim() || '-'
    const key = skuCode === '-' ? `stock-${item.stock.id}` : skuCode.toLowerCase()
    let group = groups.get(key)
    if (!group) {
      group = { key, skuCode, recordCount: 0, stockQuantity: 0, headers: [], rows: [] }
      groups.set(key, group)
    }
    group.recordCount += 1
    group.stockQuantity += Math.max(0, Math.trunc(Number(item.stock.quantity) || 0))
    group.headers = mergeHeaders(group.headers, item.headers)
    item.rows.forEach((row) => group.rows.push({ item, row }))
  })
  return Array.from(groups.values())
})

function findSizeIndex(item: FinishedOutboundDialogItem, header: string): number {
  return item.headers.findIndex((itemHeader) => getSizeHeaderKey(itemHeader) === getSizeHeaderKey(header))
}

function hasSizeHeader(item: FinishedOutboundDialogItem, header: string): boolean {
  return findSizeIndex(item, header) >= 0
}

function getDisplayQuantity(row: DisplayOutboundRow, header: string): number {
  const index = findSizeIndex(row.item, header)
  return index >= 0 ? Math.max(0, Math.trunc(Number(row.row.quantities[index]) || 0)) : 0
}

function setDisplayQuantity(row: DisplayOutboundRow, header: string, value: number | undefined) {
  const index = findSizeIndex(row.item, header)
  if (index >= 0) row.row.quantities[index] = Math.max(0, Math.trunc(Number(value) || 0))
}

function getDisplayRowTotal(row: DisplayOutboundRow): number {
  return getRowTotal(row.row)
}

function getGroupTotal(group: OutboundSkuGroup): number {
  return group.rows.reduce((sum, row) => sum + getDisplayRowTotal(row), 0)
}

function onDialogVisibleChange(value: boolean) {
  emit('update:modelValue', value)
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    void loadPickupUsers()
    void initOutboundSizeList(props.stockItems)
  },
)

watch(
  () => props.stockItems,
  (items) => {
    if (props.modelValue) void initOutboundSizeList(items)
  },
  { deep: true },
)
</script>

<style scoped>
.outbound-batch-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-bottom: 12px;
  color: var(--el-text-color-secondary);
}

.outbound-batch-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 58vh;
  overflow: auto;
  padding-right: 4px;
}

.outbound-batch-card {
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.outbound-card-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 8px 12px;
  margin-bottom: 10px;
  color: var(--el-text-color-regular);
}

.outbound-size-table :deep(.cell) {
  text-align: center;
}

.outbound-qty-input {
  width: 100%;
}

.outbound-qty-input :deep(.el-input__inner) {
  text-align: center;
}

.outbound-size-footer {
  margin-top: 8px;
  text-align: right;
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
}
</style>

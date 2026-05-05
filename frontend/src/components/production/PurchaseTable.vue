<template>
  <div ref="tableShellRef" class="list-page-table-shell">
    <el-table
      ref="purchaseTableRef"
      v-loading="loading"
      :data="list"
      border
      stripe
      class="purchase-table"
      :height="tableHeight"
      :row-style="compactRowStyle"
      :cell-style="compactCellStyle"
      :header-cell-style="compactHeaderCellStyle"
      @header-dragend="(newWidth, oldWidth, column) => emit('header-dragend', newWidth, oldWidth, column)"
      @selection-change="emit('selection-change', $event)"
    >
      <el-table-column type="selection" width="48" align="center" :selectable="props.rowSelectable" />
      <el-table-column prop="orderNo" label="订单号" min-width="100" />
      <el-table-column prop="skuCode" label="SKU" min-width="100" />
      <el-table-column label="图片" :width="compactImageColumnMinWidth" align="center">
        <template #default="{ row }">
          <AppImageThumb
            v-if="row.imageUrl"
            :raw-url="row.imageUrl"
            :width="compactImageSize"
            :height="compactImageSize"
          />
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="采购物料" min-width="150" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="material-cell">
            <div class="material-cell-main">{{ displayMaterialName(row) }}</div>
            <div v-if="displayMaterialMeta(row)" class="material-cell-meta">
              {{ displayMaterialMeta(row) }}
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="供应商" min-width="110" show-overflow-tooltip>
        <template #default="{ row }">
          <span :class="{ 'text-muted': isMissingSupplier(row) }">{{ displaySupplier(row) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="计划用量" width="96" align="center">
        <template #default="{ row }">
          {{ formatMaterialQuantity(row.planQuantity, row) }}
        </template>
      </el-table-column>
      <el-table-column prop="customerName" label="客户" min-width="90" show-overflow-tooltip />
      <el-table-column prop="merchandiser" label="跟单" width="80" show-overflow-tooltip />
      <el-table-column label="订单件数" width="88" align="center">
        <template #default="{ row }">{{ formatDisplayNumber(row.orderQuantity) }}</template>
      </el-table-column>
      <el-table-column prop="pendingPurchaseAt" label="到采购时间" width="155" align="center">
        <template #default="{ row }">
          {{ formatDateTime(row.pendingPurchaseAt) }}
        </template>
      </el-table-column>
      <el-table-column prop="purchaseCompletedAt" label="完成时间" width="155" align="center">
        <template #default="{ row }">
          {{ formatDateTime(row.processRoute === 'picking' ? row.pickCompletedAt : row.purchaseCompletedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="时效判定" width="96" align="center">
        <template #default="{ row }">
          <SlaJudgeTag :text="row.timeRating" />
        </template>
      </el-table-column>
      <el-table-column prop="purchaseStatus" :label="materialProgressColumnLabel" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="displayStatus(row) === 'completed' ? 'success' : 'warning'" size="small">
            {{ displayStatusLabel(row) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="概要" width="64" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click.stop="emit('open-brief', row)">查看</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { PurchaseItemRow } from '@/api/production-purchase'
import { formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import { formatMaterialQuantity } from '@/utils/material-quantity-unit'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'

const props = defineProps<{
  list: PurchaseItemRow[]
  loading: boolean
  materialProgressColumnLabel: string
  rowSelectable?: (row: PurchaseItemRow, index: number) => boolean
}>()

const emit = defineEmits<{
  (e: 'header-dragend', newWidth: number, oldWidth: number, column: unknown): void
  (e: 'selection-change', rows: PurchaseItemRow[]): void
  (e: 'open-brief', row: PurchaseItemRow): void
}>()

const purchaseTableRef = ref()
const tableShellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(tableShellRef)
const {
  compactHeaderCellStyle,
  compactCellStyle,
  compactRowStyle,
  compactImageSize,
  compactImageColumnMinWidth,
} = useCompactTableStyle()

function displayStatus(row: PurchaseItemRow): 'pending' | 'completed' {
  if (row.processRoute === 'picking') {
    return row.pickStatus === 'completed' ? 'completed' : 'pending'
  }
  return row.purchaseStatus === 'completed' ? 'completed' : 'pending'
}

function displayStatusLabel(row: PurchaseItemRow): string {
  if (row.processRoute === 'picking') return displayStatus(row) === 'completed' ? '领料完成' : '待领料'
  return displayStatus(row) === 'completed' ? '采购完成' : '等待采购'
}

function normalizeCellText(value: string | null | undefined): string {
  const text = (value ?? '').trim()
  return text && text !== '-' ? text : ''
}

function displayMaterialName(row: PurchaseItemRow): string {
  return normalizeCellText(row.materialName) || '-'
}

function displayMaterialMeta(row: PurchaseItemRow): string {
  return [normalizeCellText(row.materialType), normalizeCellText(row.color)].filter(Boolean).join(' - ')
}

function displaySupplier(row: PurchaseItemRow): string {
  return normalizeCellText(row.supplierName) || '未指定'
}

function isMissingSupplier(row: PurchaseItemRow): boolean {
  return !normalizeCellText(row.supplierName)
}

defineExpose({
  purchaseTableRef,
  tableShellRef,
})
</script>

<style scoped>
.purchase-table {
  flex: 1;
  min-height: 0;
}

.purchase-table :deep(.cell) {
  padding-left: 6px;
  padding-right: 6px;
  line-height: 20px;
}

.text-muted {
  color: var(--el-text-color-secondary);
}

.material-cell {
  min-width: 0;
}

.material-cell-main,
.material-cell-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-cell-main {
  color: var(--el-text-color-primary);
}

.material-cell-meta {
  margin-top: 2px;
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-caption);
}
</style>


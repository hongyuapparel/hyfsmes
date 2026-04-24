<template>
  <el-table
    ref="tableRef"
    v-loading="loading"
    :data="list"
    border
    stripe
    class="pattern-table"
    :height="tableHeight"
    :row-style="compactRowStyle"
    :cell-style="compactCellStyle"
    :header-cell-style="compactHeaderCellStyle"
    @header-dragend="onHeaderDragEnd"
    @selection-change="onSelectionChange"
  >
    <el-table-column type="selection" width="48" align="center" />
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
    <el-table-column prop="customerName" label="客户" min-width="90" show-overflow-tooltip />
    <el-table-column prop="merchandiser" label="跟单" width="80" show-overflow-tooltip />
    <el-table-column label="订单数量" width="88" align="right">
      <template #default="{ row }">{{ formatDisplayNumber(row.quantity) }}</template>
    </el-table-column>
    <el-table-column label="客户交期" width="110" align="center">
      <template #default="{ row }">{{ formatDate(row.customerDueDate) }}</template>
    </el-table-column>
    <el-table-column label="下单日期" width="110" align="center">
      <template #default="{ row }">{{ formatDate(row.orderDate) }}</template>
    </el-table-column>
    <el-table-column prop="arrivedAtPattern" label="到纸样时间" width="110" align="center">
      <template #default="{ row }">{{ formatDateTime(row.arrivedAtPattern) }}</template>
    </el-table-column>
    <el-table-column prop="completedAt" label="完成时间" width="110" align="center">
      <template #default="{ row }">{{ formatDateTime(row.completedAt) }}</template>
    </el-table-column>
    <el-table-column label="时效判定" width="96" align="center">
      <template #default="{ row }">
        <SlaJudgeTag :text="row.timeRating" />
      </template>
    </el-table-column>
    <el-table-column label="订单属性" min-width="108">
      <template #default="{ row }">
        <div>{{ findOrderTypeLabelById(row.orderTypeId) }}</div>
        <div class="text-muted pattern-sub-attr">{{ findCollaborationLabelById(row.collaborationTypeId) }}</div>
      </template>
    </el-table-column>
    <el-table-column label="采购" width="80" align="center">
      <template #default="{ row }">
        <el-tag :type="row.purchaseStatus === 'completed' ? 'success' : 'info'" size="small">
          {{ purchaseStatusLabel(row.purchaseStatus) }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="patternMaster" label="纸样师" width="90" />
    <el-table-column prop="sampleMaker" label="车版师" width="90" />
    <el-table-column label="详情" width="84" align="center" fixed="right">
      <template #default="{ row }">
        <el-button link type="primary" size="small" @click.stop="emit('open-detail', row)">
          查看
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { formatDate, formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import type { PatternListItem } from '@/api/production-pattern'

defineProps<{
  loading: boolean
  list: PatternListItem[]
  tableHeight: number | string
  compactRowStyle: ((data: { row: PatternListItem; rowIndex: number }) => Record<string, string>) | Record<string, string>
  compactCellStyle: ((data: { row: PatternListItem; column: unknown; rowIndex: number; columnIndex: number }) => Record<string, string>) | Record<string, string>
  compactHeaderCellStyle: ((data: { column: unknown; columnIndex: number }) => Record<string, string>) | Record<string, string>
  compactImageSize: number
  compactImageColumnMinWidth: number
  findOrderTypeLabelById: (id: number | null | undefined) => string
  findCollaborationLabelById: (id: number | null | undefined) => string
  purchaseStatusLabel: (value: string) => string
}>()

const emit = defineEmits<{
  (e: 'header-dragend', ...args: unknown[]): void
  (e: 'selection-change', rows: PatternListItem[]): void
  (e: 'open-detail', row: PatternListItem): void
}>()

const tableRef = ref()

function onHeaderDragEnd(...args: unknown[]) {
  emit('header-dragend', ...args)
}

function onSelectionChange(rows: PatternListItem[]) {
  emit('selection-change', rows)
}

function getTableRef() {
  return tableRef.value
}

defineExpose({ getTableRef })
</script>

<template>
  <el-table
    ref="tableRef"
    v-loading="loading"
    :data="list"
    border
    stripe
    class="finishing-table"
    :height="tableHeight"
    :row-style="compactRowStyle"
    :cell-style="compactCellStyle"
    :header-cell-style="compactHeaderCellStyle"
    @header-dragend="onHeaderDragEnd"
    @selection-change="(rows) => emit('selection-change', rows)"
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
    <el-table-column prop="factoryName" label="加工供应商" min-width="100" show-overflow-tooltip />
    <el-table-column prop="customerName" label="客户" min-width="90" show-overflow-tooltip />
    <el-table-column prop="merchandiser" label="跟单" width="80" show-overflow-tooltip />
    <el-table-column label="客户交期" width="110" align="center">
      <template #default="{ row }">{{ formatDate(row.customerDueDate) }}</template>
    </el-table-column>
    <el-table-column label="订单数量" width="88" align="right">
      <template #default="{ row }">
        <QtyTracePopover
          :order-id="row.orderId"
          :width="qtyPopoverWidth(row.orderId)"
          :loading-id="sizePopoverLoadingId"
          :headers="sizeBreakdownCache[row.orderId]?.headers ?? []"
          :blocks="qtyPopoverBlocks(row.orderId)"
          @show="emit('show-qty-popover', row)"
        >
          <template #reference>
            <span class="qty-trigger">{{ formatDisplayNumber(row.quantity) }}</span>
          </template>
        </QtyTracePopover>
      </template>
    </el-table-column>
    <el-table-column prop="arrivedAt" label="到尾部时间" width="110" align="center">
      <template #default="{ row }">{{ formatDateTime(row.arrivedAt) }}</template>
    </el-table-column>
    <el-table-column prop="completedAt" label="完成时间" width="110" align="center">
      <template #default="{ row }">{{ formatDateTime(row.completedAt) }}</template>
    </el-table-column>
    <el-table-column label="时效判定" width="96" align="center">
      <template #default="{ row }">
        <SlaJudgeTag :text="row.timeRating" />
      </template>
    </el-table-column>
    <el-table-column label="裁床数量" width="96" align="right">
      <template #default="{ row }">
        <QtyTracePopover
          :order-id="row.orderId"
          :width="qtyPopoverWidth(row.orderId)"
          :loading-id="sizePopoverLoadingId"
          :headers="sizeBreakdownCache[row.orderId]?.headers ?? []"
          :blocks="qtyPopoverBlocks(row.orderId)"
          @show="emit('show-qty-popover', row)"
        >
          <template #reference>
            <span class="qty-trigger">{{ row.cutTotal != null ? formatDisplayNumber(row.cutTotal) : '-' }}</span>
          </template>
        </QtyTracePopover>
      </template>
    </el-table-column>
    <el-table-column label="车缝数量" width="96" align="right">
      <template #default="{ row }">
        <QtyTracePopover
          :order-id="row.orderId"
          :width="qtyPopoverWidth(row.orderId)"
          :loading-id="sizePopoverLoadingId"
          :headers="sizeBreakdownCache[row.orderId]?.headers ?? []"
          :blocks="qtyPopoverBlocks(row.orderId)"
          @show="emit('show-qty-popover', row)"
        >
          <template #reference>
            <span class="qty-trigger">{{
              row.sewingQuantity != null ? formatDisplayNumber(row.sewingQuantity) : '-'
            }}</span>
          </template>
        </QtyTracePopover>
      </template>
    </el-table-column>
    <el-table-column label="尾部收货数" width="100" align="right">
      <template #default="{ row }">
        <QtyTracePopover
          :order-id="row.orderId"
          :width="qtyPopoverWidth(row.orderId)"
          :loading-id="sizePopoverLoadingId"
          :headers="sizeBreakdownCache[row.orderId]?.headers ?? []"
          :blocks="qtyPopoverBlocks(row.orderId)"
          @show="emit('show-qty-popover', row)"
        >
          <template #reference>
            <span class="qty-trigger">{{
              row.tailReceivedQty != null ? formatDisplayNumber(row.tailReceivedQty) : '-'
            }}</span>
          </template>
        </QtyTracePopover>
      </template>
    </el-table-column>
    <el-table-column label="尾部入库数" width="100" align="right">
      <template #default="{ row }">
        <QtyTracePopover
          :order-id="row.orderId"
          :width="qtyPopoverWidth(row.orderId)"
          :loading-id="sizePopoverLoadingId"
          :headers="sizeBreakdownCache[row.orderId]?.headers ?? []"
          :blocks="qtyPopoverBlocks(row.orderId)"
          @show="emit('show-qty-popover', row)"
        >
          <template #reference>
            <span class="qty-trigger">{{
              row.tailInboundQty != null ? formatDisplayNumber(row.tailInboundQty) : '-'
            }}</span>
          </template>
        </QtyTracePopover>
      </template>
    </el-table-column>
    <el-table-column label="次品数" width="80" align="right">
      <template #default="{ row }">{{
        row.defectQuantity != null ? formatDisplayNumber(row.defectQuantity) : '-'
      }}</template>
    </el-table-column>
    <el-table-column label="概要" width="64" align="center" fixed="right">
      <template #default="{ row }">
        <el-button link type="primary" @click.stop="emit('open-brief', row)">查看</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { type FinishingListItem } from '@/api/production-finishing'
import { type OrderSizeBreakdownRes } from '@/api/orders'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { formatDate, formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import QtyTracePopover from '@/components/production/QtyTracePopover.vue'

interface QtyPopoverRow {
  label: string
  values: Array<number | null>
}

interface QtyPopoverBlock {
  colorName: string
  rows: QtyPopoverRow[]
}

const props = defineProps<{
  loading: boolean
  list: FinishingListItem[]
  tableHeight: number
  compactHeaderCellStyle: unknown
  compactCellStyle: unknown
  compactRowStyle: unknown
  compactImageSize: number
  compactImageColumnMinWidth: number
  sizeBreakdownCache: Record<number, OrderSizeBreakdownRes>
  sizePopoverLoadingId: number | null
  qtyPopoverWidth: (orderId: number) => number
  qtyPopoverBlocks: (orderId: number) => QtyPopoverBlock[]
}>()

const emit = defineEmits<{
  (e: 'selection-change', rows: FinishingListItem[]): void
  (e: 'show-qty-popover', row: FinishingListItem): void
  (e: 'open-brief', row: FinishingListItem): void
}>()

const tableRef = ref()
const { onHeaderDragEnd, restoreColumnWidths } = useTableColumnWidthPersist('production-finishing-main')

watch(
  () => props.list,
  async () => {
    await nextTick()
    restoreColumnWidths(tableRef.value)
  },
  { deep: true },
)
</script>

<style scoped>
.finishing-table {
  flex: 1;
  min-height: 0;
}

.finishing-table :deep(.cell) {
  padding-left: 6px;
  padding-right: 6px;
  line-height: 20px;
}

.text-muted {
  color: var(--el-text-color-secondary);
}

.qty-trigger {
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}
</style>

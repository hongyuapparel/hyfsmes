<template>
  <el-table
      ref="tableRef"
      v-loading="loading"
      :data="list"
      border
      stripe
      class="sewing-table"
      :height="tableHeight"
      :row-style="compactRowStyle"
      :cell-style="compactCellStyle"
      :header-cell-style="compactHeaderCellStyle"
      @header-dragend="onHeaderDragEnd"
      @selection-change="emit('selection-change', $event)"
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
      <el-table-column label="客户交期" width="110" align="center">
        <template #default="{ row }">{{ formatDate(row.customerDueDate) }}</template>
      </el-table-column>
      <el-table-column prop="arrivedAt" label="到车缝时间" width="110" align="center">
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
      <el-table-column prop="factoryName" label="加工供应商" min-width="100" show-overflow-tooltip />
      <el-table-column label="分单时间" width="110" align="center">
        <template #default="{ row }">{{ formatDateTime(row.distributedAt) }}</template>
      </el-table-column>
      <el-table-column label="加工供应商交期" width="110" align="center">
        <template #default="{ row }">{{ formatDate(row.factoryDueDate) }}</template>
      </el-table-column>
      <el-table-column label="加工费(元)" width="100" align="right">
        <template #default="{ row }">
          {{ row.sewingFee != null && String(row.sewingFee).trim() !== '' ? formatDisplayNumber(row.sewingFee) : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="订单数量" width="96" align="right">
        <template #default="{ row }">
          <el-popover
            placement="top-start"
            trigger="hover"
            :width="qtyPopoverWidth(row.orderId)"
            :show-arrow="true"
            @show="emit('show-qty-popover', row)"
          >
            <template #reference>
              <span class="qty-trigger">{{ formatDisplayNumber(row.quantity) }}</span>
            </template>
            <div class="qty-popover">
              <div class="qty-popover-title">数量追踪</div>
              <div v-if="sizePopoverLoadingId === row.orderId" class="qty-popover-loading">加载中...</div>
              <div v-else>
                <template v-if="qtyPopoverBlocks(row.orderId).length">
                  <div
                    v-for="(block, bIdx) in qtyPopoverBlocks(row.orderId)"
                    :key="`${row.orderId}-bc-${bIdx}`"
                    class="qty-popover-block"
                  >
                    <div class="qty-popover-subtitle">{{ block.colorName }}</div>
                    <table class="qty-popover-table">
                      <thead>
                        <tr>
                          <th class="qty-header">尺码</th>
                          <th
                            v-for="(h, hIdx) in sizeBreakdownCache[row.orderId]?.headers ?? []"
                            :key="`${h}-${hIdx}`"
                            class="qty-header"
                          >
                            {{ h }}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="br in block.rows" :key="br.label">
                          <td class="qty-label">{{ br.label }}</td>
                          <td
                            v-for="(v, vIdx) in br.values"
                            :key="vIdx"
                            class="qty-value"
                          >
                            {{ v != null ? formatDisplayNumber(v) : '-' }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </template>
                <div v-else class="qty-popover-empty">暂无尺码明细</div>
              </div>
            </div>
          </el-popover>
        </template>
      </el-table-column>
      <el-table-column label="裁床数量" width="96" align="right">
        <template #default="{ row }">
          <el-popover
            placement="top-start"
            trigger="hover"
            :width="qtyPopoverWidth(row.orderId)"
            :show-arrow="true"
            @show="emit('show-qty-popover', row)"
          >
            <template #reference>
              <span class="qty-trigger">{{ row.cutTotal != null ? formatDisplayNumber(row.cutTotal) : '-' }}</span>
            </template>
            <div class="qty-popover">
              <div class="qty-popover-title">数量追踪</div>
              <div v-if="sizePopoverLoadingId === row.orderId" class="qty-popover-loading">加载中...</div>
              <div v-else>
                <template v-if="qtyPopoverBlocks(row.orderId).length">
                  <div
                    v-for="(block, bIdx) in qtyPopoverBlocks(row.orderId)"
                    :key="`${row.orderId}-bc-${bIdx}`"
                    class="qty-popover-block"
                  >
                    <div class="qty-popover-subtitle">{{ block.colorName }}</div>
                    <table class="qty-popover-table">
                      <thead>
                        <tr>
                          <th class="qty-header">尺码</th>
                          <th
                            v-for="(h, hIdx) in sizeBreakdownCache[row.orderId]?.headers ?? []"
                            :key="`${h}-${hIdx}`"
                            class="qty-header"
                          >
                            {{ h }}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="br in block.rows" :key="br.label">
                          <td class="qty-label">{{ br.label }}</td>
                          <td
                            v-for="(v, vIdx) in br.values"
                            :key="vIdx"
                            class="qty-value"
                          >
                            {{ v != null ? formatDisplayNumber(v) : '-' }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </template>
                <div v-else class="qty-popover-empty">暂无尺码明细</div>
              </div>
            </div>
          </el-popover>
        </template>
      </el-table-column>
      <el-table-column label="车缝数量" width="96" align="right">
        <template #default="{ row }">
          <el-popover
            placement="top-start"
            trigger="hover"
            :width="qtyPopoverWidth(row.orderId)"
            :show-arrow="true"
            @show="emit('show-qty-popover', row)"
          >
            <template #reference>
              <span class="qty-trigger">{{
                row.sewingQuantity != null ? formatDisplayNumber(row.sewingQuantity) : '-'
              }}</span>
            </template>
            <div class="qty-popover">
              <div class="qty-popover-title">数量追踪</div>
              <div v-if="sizePopoverLoadingId === row.orderId" class="qty-popover-loading">加载中...</div>
              <div v-else>
                <template v-if="qtyPopoverBlocks(row.orderId).length">
                  <div
                    v-for="(block, bIdx) in qtyPopoverBlocks(row.orderId)"
                    :key="`${row.orderId}-bc-${bIdx}`"
                    class="qty-popover-block"
                  >
                    <div class="qty-popover-subtitle">{{ block.colorName }}</div>
                    <table class="qty-popover-table">
                      <thead>
                        <tr>
                          <th class="qty-header">尺码</th>
                          <th
                            v-for="(h, hIdx) in sizeBreakdownCache[row.orderId]?.headers ?? []"
                            :key="`${h}-${hIdx}`"
                            class="qty-header"
                          >
                            {{ h }}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="br in block.rows" :key="br.label">
                          <td class="qty-label">{{ br.label }}</td>
                          <td
                            v-for="(v, vIdx) in br.values"
                            :key="vIdx"
                            class="qty-value"
                          >
                            {{ v != null ? formatDisplayNumber(v) : '-' }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </template>
                <div v-else class="qty-popover-empty">暂无尺码明细</div>
              </div>
            </div>
          </el-popover>
        </template>
      </el-table-column>
      <el-table-column label="概要" width="64" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click.stop="emit('open-brief', row)">查看</el-button>
        </template>
      </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import { ref, type CSSProperties } from 'vue'
import type { SewingListItem } from '@/api/production-sewing'
import type { OrderSizeBreakdownRes } from '@/api/orders'
import { formatDate, formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'

defineProps<{
  list: SewingListItem[]
  loading: boolean
  tableHeight: number | string
  compactRowStyle: CSSProperties
  compactCellStyle: CSSProperties
  compactHeaderCellStyle: CSSProperties
  compactImageSize: number
  compactImageColumnMinWidth: number
  sizeBreakdownCache: Record<number, OrderSizeBreakdownRes>
  sizePopoverLoadingId: number | null
  qtyPopoverBlocks: (orderId: number) => Array<{ colorName: string; rows: Array<{ label: string; values: Array<number | null> }> }>
  qtyPopoverWidth: (orderId: number) => number
}>()

const emit = defineEmits<{
  (e: 'header-dragend', ...args: any[]): void
  (e: 'selection-change', rows: SewingListItem[]): void
  (e: 'show-qty-popover', row: SewingListItem): void
  (e: 'open-brief', row: SewingListItem): void
}>()

const tableRef = ref()

function onHeaderDragEnd(...args: any[]) {
  emit('header-dragend', ...args)
}

function getTableRef() {
  return tableRef.value
}

defineExpose({ getTableRef })
</script>

<style scoped>
.sewing-table {
  flex: 1;
  min-height: 0;
}

.sewing-table :deep(.cell) {
  padding-left: 6px;
  padding-right: 6px;
  line-height: 20px;
}

.qty-trigger {
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.qty-popover {
  font-size: 12px;
}

.qty-popover-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.qty-popover-subtitle {
  font-weight: 600;
  margin-bottom: 6px;
}

.qty-popover-block:not(:first-child) {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--color-border);
}

.qty-popover-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.qty-popover-table .qty-label {
  padding: 2px 4px;
  color: var(--color-text-muted, #909399);
  white-space: nowrap;
  text-align: left;
}

.qty-popover-table .qty-value {
  padding: 2px 4px;
  text-align: center;
  white-space: nowrap;
}

.qty-header {
  padding: 2px 4px;
  font-weight: 500;
  white-space: nowrap;
  text-align: center;
}

.qty-popover-loading,
.qty-popover-empty {
  font-size: 12px;
  color: var(--color-text-muted, #909399);
}
</style>

<template>
  <div class="page-card order-sla-report-page">
    <p class="report-desc">
      {{ '\u7528\u4e8e\u67e5\u770b\u8ba2\u5355\u6574\u4f53\u4ea4\u671f\u4e0e\u8d85\u671f\u60c5\u51b5\uff0c\u652f\u6301\u6309\u4e0b\u5355\u65f6\u95f4\u3001\u5b8c\u6210\u65f6\u95f4\u3001\u5f53\u524d\u72b6\u6001\u7b5b\u9009\uff0c\u5e76\u652f\u6301\u52fe\u9009\u5bfc\u51fa\u3002' }}
    </p>

    <div class="filter-bar">
      <el-date-picker
        v-model="filter.orderDateRange"
        type="daterange"
        range-separator=""
        :start-placeholder="'\u4e0b\u5355\u65f6\u95f4'"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        clearable
        size="default"
        :class="['filter-item filter-range', { 'range-single': !filter.orderDateRange }]"
        :style="getFilterRangeStyle(filter.orderDateRange)"
        @change="onSearch"
      />
      <el-date-picker
        v-model="filter.completedRange"
        type="daterange"
        range-separator=""
        :start-placeholder="'\u5b8c\u6210\u65f6\u95f4'"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        clearable
        size="default"
        :class="['filter-item filter-range', { 'range-single': !filter.completedRange }]"
        :style="getFilterRangeStyle(filter.completedRange)"
        @change="onSearch"
      />
      <el-select
        v-model="filter.statusId"
        :placeholder="'\u72b6\u6001'"
        clearable
        size="default"
        class="filter-item"
        @change="onSearch"
      >
        <el-option v-for="s in statusOptions" :key="s.id" :label="s.label" :value="s.id" />
      </el-select>
      <el-select
        v-model="filter.collaborationTypeId"
        :placeholder="'\u5408\u4f5c\u65b9\u5f0f'"
        clearable
        size="default"
        class="filter-item"
        @change="onSearch"
      >
        <el-option v-for="opt in collaborationOptions" :key="opt.id" :label="opt.value" :value="opt.id" />
      </el-select>
      <el-select
        v-model="filter.orderTypeId"
        :placeholder="'\u8ba2\u5355\u7c7b\u578b'"
        clearable
        size="default"
        class="filter-item"
        @change="onSearch"
      >
        <el-option v-for="opt in orderTypeOptions" :key="opt.id" :label="opt.value" :value="opt.id" />
      </el-select>

      <div class="filter-bar-actions">
        <el-button type="primary" size="default" @click="loadReport">{{ '\u641c\u7d22' }}</el-button>
        <el-button size="default" :disabled="!list.length" @click="onExport(false)">{{ '\u5bfc\u51fa\u5f53\u524d' }}</el-button>
        <el-button size="default" :disabled="!selection.length" @click="onExport(true)">{{ '\u5bfc\u51fa\u9009\u4e2d' }}</el-button>
      </div>
    </div>

    <div v-if="summary" class="summary-bar">
      <span>{{ '\u5171 ' }}<strong>{{ summary.total }}</strong>{{ ' \u6761\u8ba2\u5355' }}</span>
      <span class="summary-overdue">{{ '\u8d85\u671f ' }}<strong>{{ summary.overdue }}</strong>{{ ' \u6761' }}</span>
    </div>

    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      size="small"
      class="report-table"
      :header-cell-style="centerStyle"
      :cell-style="centerStyle"
      table-layout="fixed"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="46" />
      <el-table-column prop="orderNo" :label="'\u8ba2\u5355\u53f7'" width="110" show-overflow-tooltip />
      <el-table-column prop="skuCode" label="sku" width="90" show-overflow-tooltip />
      <el-table-column prop="collaborationTypeLabel" :label="'\u5408\u4f5c\u65b9\u5f0f'" width="90" show-overflow-tooltip />
      <el-table-column prop="orderTypeLabel" :label="'\u8ba2\u5355\u7c7b\u578b'" width="90" show-overflow-tooltip />
      <el-table-column prop="quantity" :label="'\u6570\u91cf'" width="70" show-overflow-tooltip />
      <el-table-column prop="merchandiser" :label="'\u8ddf\u5355\u5458'" width="80" show-overflow-tooltip />
      <el-table-column prop="salesperson" :label="'\u4e1a\u52a1\u5458'" width="80" show-overflow-tooltip />
      <el-table-column prop="customerName" :label="'\u5ba2\u6237'" width="110" show-overflow-tooltip />
      <el-table-column :label="'\u4e0b\u5355\u65f6\u95f4'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.orderDate) }}</template>
      </el-table-column>
      <el-table-column :label="'\u5ba2\u6237\u4ea4\u671f'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.customerDueDate) }}</template>
      </el-table-column>
      <el-table-column :label="'\u5ba1\u5355\u65f6\u95f4'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.reviewAt) }}</template>
      </el-table-column>
      <el-table-column :label="'\u5ba1\u5355\u8017\u65f6\uff08\u5c0f\u65f6\uff09'" width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeNumber(row.reviewDurationHours) }}</template>
      </el-table-column>
      <el-table-column :label="'\u5ba1\u5355\u5224\u5b9a'" width="90" show-overflow-tooltip>
        <template #default="{ row }">{{ row.reviewJudge || '-' }}</template>
      </el-table-column>
      <el-table-column :label="'\u5230\u91c7\u8d2d\u65f6\u95f4'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.purchaseArrivedAt) }}</template>
      </el-table-column>
      <el-table-column :label="'\u91c7\u8d2d\u5b8c\u6210\u65f6\u95f4'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.purchaseCompletedAt) }}</template>
      </el-table-column>
      <el-table-column :label="'\u91c7\u8d2d\u5224\u5b9a'" width="90" show-overflow-tooltip>
        <template #default="{ row }">{{ row.purchaseJudge || '-' }}</template>
      </el-table-column>
      <el-table-column :label="'\u5230\u7eb8\u6837\u65f6\u95f4'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.patternArrivedAt) }}</template>
      </el-table-column>
      <el-table-column :label="'\u7eb8\u6837\u5b8c\u6210\u65f6\u95f4'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.patternCompletedAt) }}</template>
      </el-table-column>
      <el-table-column :label="'\u7eb8\u6837\u5224\u5b9a'" width="90" show-overflow-tooltip>
        <template #default="{ row }">{{ row.patternJudge || '-' }}</template>
      </el-table-column>
      <el-table-column :label="'\u5230\u88c1\u5e8a\u65f6\u95f4'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.cuttingArrivedAt) }}</template>
      </el-table-column>
      <el-table-column :label="'\u88c1\u5e8a\u5b8c\u6210\u65f6\u95f4'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.cuttingCompletedAt) }}</template>
      </el-table-column>
      <el-table-column :label="'\u88c1\u5e8a\u5224\u5b9a'" width="90" show-overflow-tooltip>
        <template #default="{ row }">{{ row.cuttingJudge || '-' }}</template>
      </el-table-column>
      <el-table-column :label="'\u5230\u5de5\u827a\u65f6\u95f4'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.craftArrivedAt) }}</template>
      </el-table-column>
      <el-table-column :label="'\u5de5\u827a\u5b8c\u6210\u65f6\u95f4'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.craftCompletedAt) }}</template>
      </el-table-column>
      <el-table-column :label="'\u5de5\u827a\u5224\u5b9a'" width="90" show-overflow-tooltip>
        <template #default="{ row }">{{ row.craftJudge || '-' }}</template>
      </el-table-column>
      <el-table-column :label="'\u5230\u8f66\u7f1d\u65f6\u95f4'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.sewingArrivedAt) }}</template>
      </el-table-column>
      <el-table-column :label="'\u8f66\u7f1d\u5b8c\u6210\u65f6\u95f4'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.sewingCompletedAt) }}</template>
      </el-table-column>
      <el-table-column :label="'\u8f66\u7f1d\u5224\u5b9a'" width="90" show-overflow-tooltip>
        <template #default="{ row }">{{ row.sewingJudge || '-' }}</template>
      </el-table-column>
      <el-table-column :label="'\u5230\u5c3e\u90e8\u65f6\u95f4'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.finishingArrivedAt) }}</template>
      </el-table-column>
      <el-table-column :label="'\u5c3e\u90e8\u5b8c\u6210\u65f6\u95f4'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.finishingCompletedAt) }}</template>
      </el-table-column>
      <el-table-column :label="'\u5c3e\u90e8\u5224\u5b9a'" width="90" show-overflow-tooltip>
        <template #default="{ row }">{{ row.finishingJudge || '-' }}</template>
      </el-table-column>
      <el-table-column :label="'\u5b8c\u6210\u65f6\u95f4'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.completedAt) }}</template>
      </el-table-column>
      <el-table-column prop="statusLabel" :label="'\u72b6\u6001'" width="80" show-overflow-tooltip />
      <el-table-column :label="'\u8fdb\u5165\u72b6\u6001\u65f6\u95f4'" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ formatMaybeDateTime(row.enteredAt) }}</template>
      </el-table-column>
      <el-table-column prop="durationHours" :label="'\u8017\u65f6\uff08\u5c0f\u65f6\uff09'" width="110" show-overflow-tooltip />
      <el-table-column :label="'\u662f\u5426\u8d85\u671f'" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.isOverdue" type="danger" size="small">{{ '\u8d85\u671f' }}</el-tag>
          <el-tag v-else type="success" size="small">{{ '\u6b63\u5e38' }}</el-tag>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getOrderSlaReport, getOrderStatuses, type OrderSlaReportRow } from '@/api/order-status-config'
import type { OrderStatusItem } from '@/api/order-status-config'
import { getDictItems } from '@/api/dicts'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { formatDateTime } from '@/utils/date-format'

const loading = ref(false)
const list = ref<OrderSlaReportRow[]>([])
const summary = ref<{ total: number; overdue: number } | null>(null)
const statusOptions = ref<OrderStatusItem[]>([])
const collaborationOptions = ref<Array<{ id: number; value: string }>>([])
const orderTypeOptions = ref<Array<{ id: number; value: string }>>([])
const selection = ref<OrderSlaReportRow[]>([])

const filter = ref<{
  statusId?: number
  collaborationTypeId?: number
  orderTypeId?: number
  orderDateRange?: [string, string] | null
  completedRange?: [string, string] | null
}>({})

const DATE_RANGE_WIDTH_EMPTY = '170px'
const DATE_RANGE_WIDTH_FILLED = '220px'

function getFilterRangeStyle(v?: [string, string] | null) {
  const hasValue = !!(v && v.length === 2)
  const width = hasValue ? DATE_RANGE_WIDTH_FILLED : DATE_RANGE_WIDTH_EMPTY
  return { width, flex: `0 0 ${width}` }
}

function centerStyle() {
  return { textAlign: 'center' }
}

function onSelectionChange(rows: OrderSlaReportRow[]) {
  selection.value = rows ?? []
}

function toCsvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  const escaped = s.replace(/"/g, '""')
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped
}

function formatMaybeDateTime(v: string | null | undefined): string {
  return v ? formatDateTime(v) : '-'
}

function formatMaybeNumber(v: number | null | undefined): string {
  if (v == null) return '-'
  return String(v)
}

function buildCsv(rows: OrderSlaReportRow[]): string {
  const headers = ['\u8ba2\u5355\u53f7', 'SKU', '\u5408\u4f5c\u65b9\u5f0f', '\u8ba2\u5355\u7c7b\u578b', '\u6570\u91cf', '\u8ddf\u5355\u5458', '\u4e1a\u52a1\u5458', '\u5ba2\u6237', '\u4e0b\u5355\u65f6\u95f4', '\u5ba2\u6237\u4ea4\u671f', '\u5ba1\u5355\u65f6\u95f4', '\u5ba1\u5355\u8017\u65f6\uff08\u5c0f\u65f6\uff09', '\u5ba1\u5355\u5224\u5b9a', '\u5230\u91c7\u8d2d\u65f6\u95f4', '\u91c7\u8d2d\u5b8c\u6210\u65f6\u95f4', '\u91c7\u8d2d\u5224\u5b9a', '\u5230\u7eb8\u6837\u65f6\u95f4', '\u7eb8\u6837\u5b8c\u6210\u65f6\u95f4', '\u7eb8\u6837\u5224\u5b9a', '\u5230\u88c1\u5e8a\u65f6\u95f4', '\u88c1\u5e8a\u5b8c\u6210\u65f6\u95f4', '\u88c1\u5e8a\u5224\u5b9a', '\u5230\u5de5\u827a\u65f6\u95f4', '\u5de5\u827a\u5b8c\u6210\u65f6\u95f4', '\u5de5\u827a\u5224\u5b9a', '\u5230\u8f66\u7f1d\u65f6\u95f4', '\u8f66\u7f1d\u5b8c\u6210\u65f6\u95f4', '\u8f66\u7f1d\u5224\u5b9a', '\u5230\u5c3e\u90e8\u65f6\u95f4', '\u5c3e\u90e8\u5b8c\u6210\u65f6\u95f4', '\u5c3e\u90e8\u5224\u5b9a', '\u5b8c\u6210\u65f6\u95f4', '\u72b6\u6001', '\u8fdb\u5165\u72b6\u6001\u65f6\u95f4', '\u8017\u65f6\uff08\u5c0f\u65f6\uff09', '\u662f\u5426\u8d85\u671f']
  const lines = [headers.map(toCsvCell).join(',')]
  for (const r of rows) {
    lines.push([
      r.orderNo,
      r.skuCode,
      r.collaborationTypeLabel,
      r.orderTypeLabel,
      r.quantity,
      r.merchandiser,
      r.salesperson,
      r.customerName,
      formatMaybeDateTime(r.orderDate),
      formatMaybeDateTime(r.customerDueDate),
      formatMaybeDateTime(r.reviewAt),
      formatMaybeNumber(r.reviewDurationHours),
      r.reviewJudge || '-',
      formatMaybeDateTime(r.purchaseArrivedAt),
      formatMaybeDateTime(r.purchaseCompletedAt),
      r.purchaseJudge || '-',
      formatMaybeDateTime(r.patternArrivedAt),
      formatMaybeDateTime(r.patternCompletedAt),
      r.patternJudge || '-',
      formatMaybeDateTime(r.cuttingArrivedAt),
      formatMaybeDateTime(r.cuttingCompletedAt),
      r.cuttingJudge || '-',
      formatMaybeDateTime(r.craftArrivedAt),
      formatMaybeDateTime(r.craftCompletedAt),
      r.craftJudge || '-',
      formatMaybeDateTime(r.sewingArrivedAt),
      formatMaybeDateTime(r.sewingCompletedAt),
      r.sewingJudge || '-',
      formatMaybeDateTime(r.finishingArrivedAt),
      formatMaybeDateTime(r.finishingCompletedAt),
      r.finishingJudge || '-',
      formatMaybeDateTime(r.completedAt),
      r.statusLabel,
      formatMaybeDateTime(r.enteredAt),
      r.durationHours,
      r.isOverdue ? '\u8d85\u671f' : '\u6b63\u5e38',
    ].map(toCsvCell).join(','))
  }
  return `\uFEFF${lines.join('\n')}`
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

function onExport(onlySelected: boolean) {
  const rows = onlySelected ? selection.value : list.value
  const suffix = onlySelected ? '\u9009\u4e2d' : '\u5f53\u524d'
  downloadCsv(buildCsv(rows), `\u8ba2\u5355\u65f6\u6548_${suffix}_${new Date().toISOString().slice(0, 10)}.csv`)
}

function onSearch() {
  loadReport()
}

async function loadStatusOptions() {
  try {
    const res = await getOrderStatuses()
    statusOptions.value = res.data ?? []
  } catch {
    statusOptions.value = []
  }
}

async function loadCollaborationOptions() {
  try {
    const res = await getDictItems('collaboration')
    collaborationOptions.value = (res.data ?? []).map((x) => ({ id: x.id, value: x.value }))
  } catch {
    collaborationOptions.value = []
  }
}

async function loadOrderTypeOptions() {
  try {
    const res = await getDictItems('order_types')
    orderTypeOptions.value = (res.data ?? []).map((x) => ({ id: x.id, value: x.value }))
  } catch {
    orderTypeOptions.value = []
  }
}

async function loadReport() {
  loading.value = true
  try {
    const [orderDateFrom, orderDateTo] = filter.value.orderDateRange ?? []
    const [completedFrom, completedTo] = filter.value.completedRange ?? []
    const res = await getOrderSlaReport({
      status_id: filter.value.statusId,
      collaboration_type_id: filter.value.collaborationTypeId,
      order_type_id: filter.value.orderTypeId,
      order_date_from: orderDateFrom,
      order_date_to: orderDateTo,
      completed_from: completedFrom,
      completed_to: completedTo,
    })
    list.value = res.data?.list ?? []
    summary.value = res.data?.summary ?? null
  } catch {
    list.value = []
    summary.value = null
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadStatusOptions()
  await loadCollaborationOptions()
  await loadOrderTypeOptions()
  await loadReport()
})
</script>

<style scoped>
.report-desc {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
  margin: 0 0 var(--el-component-spacing);
}

.order-sla-report-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-sm);
  padding: var(--space-sm);
  margin-bottom: var(--space-md);
  border-radius: var(--radius-lg);
  background-color: var(--color-bg-subtle, #f5f6f8);
}

.filter-item {
  width: 140px;
}

.filter-range {
  width: 170px;
}

.range-single.el-date-editor--daterange :deep(.el-range-separator) {
  display: none;
}

.range-single.el-date-editor--daterange :deep(.el-range-input:last-child) {
  display: none;
}

.range-single.el-date-editor--daterange :deep(.el-range-input:first-child) {
  width: 100%;
}

.range-single.el-date-editor--daterange :deep(.el-range__close-icon) {
  margin-left: 0;
}

.filter-bar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-left: auto;
}

.summary-bar {
  margin-bottom: var(--el-component-spacing);
  font-size: var(--el-font-size-small);
}

.summary-overdue {
  margin-left: 16px;
  color: var(--el-color-danger);
}

.report-table {
  margin-top: 8px;
}
</style>

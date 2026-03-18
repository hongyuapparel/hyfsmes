<template>
  <div class="page-card order-sla-report-page">
    <p class="report-desc">
      按订单状态停留时段统计实际耗时与配置的标准时长，超出标准时长的记为超期，可用于绩效考核。数据自启用「订单时效配置」并产生状态流转后开始积累。
    </p>

    <div class="filter-bar">
      <el-date-picker
        v-model="filter.orderDateRange"
        type="daterange"
        range-separator=""
        start-placeholder="下单时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        clearable
        size="default"
        :class="['filter-item', 'filter-range', { 'range-single': !filter.orderDateRange }]"
        :style="getFilterRangeStyle(filter.orderDateRange ?? null)"
      />
      <el-date-picker
        v-model="filter.completedRange"
        type="daterange"
        range-separator=""
        start-placeholder="完成时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        clearable
        size="default"
        :class="['filter-item', 'filter-range', { 'range-single': !filter.completedRange }]"
        :style="getFilterRangeStyle(filter.completedRange ?? null)"
      />
      <el-select
        v-model="filter.statusId"
        placeholder="状态"
        clearable
        size="default"
        class="filter-item"
      >
        <el-option
          v-for="s in statusOptions"
          :key="s.id"
          :label="s.label"
          :value="s.id"
        />
      </el-select>
      <el-button type="primary" size="default" @click="loadReport">查询</el-button>
      <el-button :disabled="!list.length" size="default" @click="onExport(false)">导出当前</el-button>
      <el-button :disabled="!selection.length" size="default" @click="onExport(true)">导出选中</el-button>
    </div>

    <div v-if="summary" class="summary-bar">
      <span>共 <strong>{{ summary.total }}</strong> 个订单</span>
      <span class="summary-overdue">超期 <strong>{{ summary.overdue }}</strong> 个</span>
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
      @header-dragend="onHeaderDragend"
      @selection-change="onSelectionChange"
      @sort-change="onSortChange"
    >
      <el-table-column type="selection" width="46" />
      <el-table-column prop="orderNo" label="订单号" :width="colWidth('orderNo', 110)" show-overflow-tooltip />
      <el-table-column prop="skuCode" label="sku" :width="colWidth('skuCode', 90)" show-overflow-tooltip />
      <el-table-column prop="collaborationTypeLabel" label="合作方式" :width="colWidth('collaborationTypeLabel', 90)" show-overflow-tooltip />
      <el-table-column prop="orderTypeLabel" label="订单类型" :width="colWidth('orderTypeLabel', 90)" show-overflow-tooltip />
      <el-table-column prop="quantity" label="数量" :width="colWidth('quantity', 70)" show-overflow-tooltip sortable="custom" />
      <el-table-column prop="merchandiser" label="跟单员" :width="colWidth('merchandiser', 80)" show-overflow-tooltip />
      <el-table-column prop="salesperson" label="业务员" :width="colWidth('salesperson', 80)" show-overflow-tooltip />
      <el-table-column prop="customerName" label="客户" :width="colWidth('customerName', 110)" show-overflow-tooltip />
      <el-table-column prop="orderDate" label="下单时间" :width="colWidth('orderDate', 130)" show-overflow-tooltip sortable="custom">
        <template #default="{ row }">
          {{ row.orderDate ? formatDateTime(row.orderDate) : '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="completedAt" label="完成时间" :width="colWidth('completedAt', 130)" show-overflow-tooltip sortable="custom">
        <template #default="{ row }">
          {{ row.completedAt ? formatDateTime(row.completedAt) : '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="statusLabel" label="状态" :width="colWidth('statusLabel', 80)" show-overflow-tooltip />
      <el-table-column prop="enteredAt" label="进入时间" :width="colWidth('enteredAt', 130)" show-overflow-tooltip sortable="custom">
        <template #default="{ row }">
          {{ formatDateTime(row.enteredAt) }}
        </template>
      </el-table-column>
      <el-table-column prop="durationHours" label="停留时长(小时)" :width="colWidth('durationHours', 110)" show-overflow-tooltip sortable="custom">
        <template #default="{ row }">
          {{ row.durationHours }}
        </template>
      </el-table-column>
      <el-table-column prop="limitHours" label="标准时长(小时)" :width="colWidth('limitHours', 110)" show-overflow-tooltip sortable="custom">
        <template #default="{ row }">
          {{ row.limitHours != null ? row.limitHours : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="是否超期" :width="colWidth('isOverdue', 80)">
        <template #default="{ row }">
          <el-tag v-if="row.isOverdue" type="danger" size="small">超期</el-tag>
          <el-tag v-else type="success" size="small">未超期</el-tag>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getOrderSlaReport, getOrderStatuses, type OrderSlaReportRow } from '@/api/order-status-config'
import type { OrderStatusItem } from '@/api/order-status-config'
import { rangeShortcuts } from '@/utils/date-shortcuts'

const loading = ref(false)
const list = ref<OrderSlaReportRow[]>([])
const summary = ref<{ total: number; overdue: number } | null>(null)
const statusOptions = ref<OrderStatusItem[]>([])
const selection = ref<OrderSlaReportRow[]>([])
const currentSort = ref<{ prop: string; order: 'ascending' | 'descending' } | null>(null)

const filter = ref<{
  statusId?: number
  orderDateRange?: [string, string] | null
  completedRange?: [string, string] | null
}>({})

const STORAGE_KEY = 'finance_order_sla_report_table_prefs_v1'
const colWidthMap = ref<Record<string, number>>({})

const DATE_RANGE_WIDTH_EMPTY = 160
const DATE_RANGE_WIDTH_FILLED = 240

function formatDateTime(iso: string) {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }).replace(' ', ' ')
}

function getFilterRangeStyle(v: [string, string] | null) {
  const hasValue = v && v.length === 2
  const width = hasValue ? DATE_RANGE_WIDTH_FILLED : DATE_RANGE_WIDTH_EMPTY
  return { width: `${width}px`, flex: `0 0 ${width}px` }
}

function centerStyle() {
  return { textAlign: 'center' }
}

function colWidth(key: string, fallback: number) {
  return colWidthMap.value[key] ?? fallback
}

function onHeaderDragend(newWidth: number, _oldWidth: number, column: any) {
  const key = String(column?.property || '')
  if (!key) return
  colWidthMap.value = { ...colWidthMap.value, [key]: Math.max(60, Math.round(newWidth)) }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ colWidthMap: colWidthMap.value }))
  } catch {
    // ignore
  }
}

function onSelectionChange(rows: OrderSlaReportRow[]) {
  selection.value = rows ?? []
}

function getSortValue(row: OrderSlaReportRow, prop: string): number | string {
  if (prop === 'orderDate') return row.orderDate ? new Date(row.orderDate).getTime() : 0
  if (prop === 'completedAt') return row.completedAt ? new Date(row.completedAt).getTime() : 0
  if (prop === 'enteredAt') return row.enteredAt ? new Date(row.enteredAt).getTime() : 0
  if (prop === 'quantity') return Number(row.quantity ?? 0)
  if (prop === 'durationHours') return Number(row.durationHours ?? 0)
  if (prop === 'limitHours') return Number(row.limitHours ?? 0)
  return (row as any)?.[prop] ?? ''
}

function applySort() {
  const s = currentSort.value
  if (!s) return
  const dir = s.order === 'ascending' ? 1 : -1
  const prop = s.prop
  list.value = [...list.value].sort((a, b) => {
    const av = getSortValue(a, prop)
    const bv = getSortValue(b, prop)
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv), 'zh-CN') * dir
  })
}

function onSortChange(e: { prop: string; order: 'ascending' | 'descending' | null }) {
  if (!e.order) {
    currentSort.value = null
    return
  }
  currentSort.value = { prop: e.prop, order: e.order }
  applySort()
}

function toCsvCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  const escaped = s.replace(/\"/g, '\"\"')
  return /[\",\n]/.test(escaped) ? `\"${escaped}\"` : escaped
}

function formatOverdue(v: boolean): string {
  return v ? '超期' : '未超期'
}

function buildCsv(rows: OrderSlaReportRow[]): string {
  const headers = [
    '订单号',
    'sku',
    '合作方式',
    '订单类型',
    '数量',
    '跟单员',
    '业务员',
    '客户',
    '下单时间',
    '完成时间',
    '状态',
    '进入时间',
    '停留时长(小时)',
    '标准时长(小时)',
    '是否超期',
  ]
  const lines = [headers.map(toCsvCell).join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.orderNo,
        r.skuCode,
        r.collaborationTypeLabel,
        r.orderTypeLabel,
        r.quantity,
        r.merchandiser,
        r.salesperson,
        r.customerName,
        r.orderDate ? formatDateTime(r.orderDate) : '',
        r.completedAt ? formatDateTime(r.completedAt) : '',
        r.statusLabel,
        r.enteredAt ? formatDateTime(r.enteredAt) : '',
        r.durationHours,
        r.limitHours ?? '',
        formatOverdue(r.isOverdue),
      ].map(toCsvCell).join(','),
    )
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
  const csv = buildCsv(rows)
  const suffix = onlySelected ? '选中' : '当前'
  downloadCsv(csv, `订单时效_${suffix}_${new Date().toISOString().slice(0, 10)}.csv`)
}

async function loadStatusOptions() {
  try {
    const res = await getOrderStatuses()
    statusOptions.value = res.data ?? []
  } catch {
    statusOptions.value = []
  }
}

async function loadReport() {
  loading.value = true
  try {
    const [orderDateFrom, orderDateTo] = filter.value.orderDateRange ?? []
    const [completedFrom, completedTo] = filter.value.completedRange ?? []
    const res = await getOrderSlaReport({
      status_id: filter.value.statusId,
      order_date_from: orderDateFrom,
      order_date_to: orderDateTo,
      completed_from: completedFrom,
      completed_to: completedTo,
    })
    list.value = res.data?.list ?? []
    summary.value = res.data?.summary ?? null
    applySort()
  } catch {
    list.value = []
    summary.value = null
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as { colWidthMap?: Record<string, number> }) : null
    if (parsed?.colWidthMap) colWidthMap.value = parsed.colWidthMap
  } catch {
    colWidthMap.value = {}
  }
  await loadStatusOptions()
  await loadReport()
})
</script>

<style scoped>
.report-desc {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
  margin: 0 0 var(--el-component-spacing);
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--el-component-spacing);
  margin-bottom: var(--el-component-spacing);
}

.filter-item {
  width: 140px;
}

.filter-range {
  width: auto;
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

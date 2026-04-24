import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getOrderSlaReport,
  getOrderProfitReport,
  getOrderStatuses,
  type OrderProfitReportRow,
  type OrderSlaReportRow,
  type OrderStatusItem,
} from '@/api/order-status-config'
import { getDictItems } from '@/api/dicts'
import { formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'

type ReportTab = 'sla' | 'profit'

interface ReportFilter {
  statusId?: number
  collaborationTypeId?: number
  orderTypeId?: number
  orderDateRange?: [string, string] | null
  completedRange?: [string, string] | null
}

const DATE_RANGE_WIDTH_EMPTY = '170px'
const DATE_RANGE_WIDTH_FILLED = '220px'

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

export function useOrderSlaReport() {
  const loading = ref(false)
  const list = ref<OrderSlaReportRow[]>([])
  const summary = ref<{ total: number; overdue: number } | null>(null)
  const profitList = ref<OrderProfitReportRow[]>([])
  const profitSummary = ref<{ total: number } | null>(null)
  const statusOptions = ref<OrderStatusItem[]>([])
  const collaborationOptions = ref<Array<{ id: number; value: string }>>([])
  const orderTypeOptions = ref<Array<{ id: number; value: string }>>([])
  const selection = ref<OrderSlaReportRow[]>([])
  const profitSelection = ref<OrderProfitReportRow[]>([])
  const pagination = ref({ page: 1, pageSize: 20 })
  const route = useRoute()
  const router = useRouter()
  const activeTab = ref<ReportTab>('sla')
  const filter = ref<ReportFilter>({})

  function getFilterRangeStyle(v?: [string, string] | null) {
    const hasValue = !!(v && v.length === 2)
    const width = hasValue ? DATE_RANGE_WIDTH_FILLED : DATE_RANGE_WIDTH_EMPTY
    return { width, flex: `0 0 ${width}` }
  }

  function centerStyle() {
    return { textAlign: 'center' }
  }

  function currentSegmentSlaLabel(row: OrderSlaReportRow): string {
    if (row.limitHours == null) return '未配置时限'
    return row.isOverdue ? '超期' : '未超期'
  }

  function onSelectionChange(rows: OrderSlaReportRow[]) {
    selection.value = rows ?? []
  }

  function onProfitSelectionChange(rows: OrderProfitReportRow[]) {
    profitSelection.value = rows ?? []
  }

  const currentTotal = computed(() =>
    activeTab.value === 'sla' ? (summary.value?.total ?? 0) : (profitSummary.value?.total ?? 0),
  )
  const currentSelectionCount = computed(() =>
    activeTab.value === 'sla' ? selection.value.length : profitSelection.value.length,
  )

  function formatBizNumberForTable(v: unknown): string {
    if (v === null || v === undefined || v === '') return '-'
    return formatDisplayNumber(v)
  }

  function calcFactoryTotalProfit(row: { unitProfit?: number | null; shipmentQty?: number | null }): number {
    const unit = Number(row?.unitProfit ?? 0)
    const qty = Number(row?.shipmentQty ?? 0)
    if (!Number.isFinite(unit) || !Number.isFinite(qty)) return 0
    return Math.round(unit * qty * 100) / 100
  }

  function buildCsv(rows: OrderSlaReportRow[]): string {
    const headers = ['订单号', 'SKU', '合作方式', '订单类型', '数量', '跟单员', '业务员', '客户', '下单时间', '客户交期', '审单时间', '审单耗时（小时）', '审单判定', '到采购时间', '采购完成时间', '采购判定', '到纸样时间', '纸样完成时间', '纸样判定', '到裁床时间', '裁床完成时间', '裁床判定', '到工艺时间', '工艺完成时间', '工艺判定', '到车缝时间', '车缝完成时间', '车缝判定', '到尾部时间', '尾部完成时间', '尾部判定', '完成时间', '状态', '进入状态时间', '耗时（小时）', '时效判定']
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
        currentSegmentSlaLabel(r),
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
    if (activeTab.value === 'profit') {
      const rows = onlySelected ? profitSelection.value : profitList.value
      const suffix = onlySelected ? '选中' : '当前'
      const headers = ['订单号', 'SKU', '合作方式', '订单类型', '出货数量', '跟单', '业务员', '客户', '销售价', '出厂价', '材料成本', '工艺项目', '生产工序', '单件利润', '工厂总利润']
      const lines = [headers.map(toCsvCell).join(',')]
      for (const r of rows) {
        lines.push([
          r.orderNo,
          r.skuCode,
          r.collaborationTypeLabel,
          r.orderTypeLabel,
          r.shipmentQty,
          r.merchandiser,
          r.salesperson,
          r.customerName,
          r.salePrice,
          r.factoryPrice,
          r.materialCost,
          r.processCost,
          r.productionCost,
          r.unitProfit,
          r.factoryTotalProfit,
        ].map(toCsvCell).join(','))
      }
      downloadCsv(`\uFEFF${lines.join('\n')}`, `订单利润_${suffix}_${new Date().toISOString().slice(0, 10)}.csv`)
      return
    }
    const rows = onlySelected ? selection.value : list.value
    const suffix = onlySelected ? '选中' : '当前'
    downloadCsv(buildCsv(rows), `订单时效_${suffix}_${new Date().toISOString().slice(0, 10)}.csv`)
  }

  function onSearch() {
    pagination.value.page = 1
    void loadCurrentTab()
  }

  function parseTab(v: unknown): ReportTab {
    return v === 'profit' ? 'profit' : 'sla'
  }

  async function onTabChange() {
    await router.replace({ query: { ...route.query, tab: activeTab.value } })
    await loadCurrentTab()
  }

  function onPageChange() {
    void loadCurrentTab()
  }

  function onPageSizeChange() {
    pagination.value.page = 1
    void loadCurrentTab()
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
        page: pagination.value.page,
        page_size: pagination.value.pageSize,
      })
      list.value = res.data?.list ?? []
      summary.value = res.data?.summary ?? null
      selection.value = []
    } catch {
      list.value = []
      summary.value = null
    } finally {
      loading.value = false
    }
  }

  async function loadProfitReport() {
    loading.value = true
    try {
      const [orderDateFrom, orderDateTo] = filter.value.orderDateRange ?? []
      const [completedFrom, completedTo] = filter.value.completedRange ?? []
      const res = await getOrderProfitReport({
        status_id: filter.value.statusId,
        collaboration_type_id: filter.value.collaborationTypeId,
        order_type_id: filter.value.orderTypeId,
        order_date_from: orderDateFrom,
        order_date_to: orderDateTo,
        completed_from: completedFrom,
        completed_to: completedTo,
        page: pagination.value.page,
        page_size: pagination.value.pageSize,
      })
      profitList.value = res.data?.list ?? []
      profitSummary.value = res.data?.summary ?? null
      profitSelection.value = []
    } catch {
      profitList.value = []
      profitSummary.value = null
    } finally {
      loading.value = false
    }
  }

  async function loadCurrentTab() {
    if (activeTab.value === 'profit') {
      await loadProfitReport()
      return
    }
    await loadReport()
  }

  onMounted(async () => {
    activeTab.value = parseTab(route.query.tab)
    await loadStatusOptions()
    await loadCollaborationOptions()
    await loadOrderTypeOptions()
    await loadCurrentTab()
  })

  watch(
    () => route.query.tab,
    (v) => {
      const next = parseTab(v)
      if (next !== activeTab.value) activeTab.value = next
    },
  )

  return {
    loading,
    list,
    summary,
    profitList,
    profitSummary,
    statusOptions,
    collaborationOptions,
    orderTypeOptions,
    pagination,
    activeTab,
    filter,
    currentTotal,
    currentSelectionCount,
    getFilterRangeStyle,
    centerStyle,
    currentSegmentSlaLabel,
    onSelectionChange,
    onProfitSelectionChange,
    formatMaybeDateTime,
    formatBizNumberForTable,
    calcFactoryTotalProfit,
    onExport,
    onSearch,
    onTabChange,
    onPageChange,
    onPageSizeChange,
  }
}

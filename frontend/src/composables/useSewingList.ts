import { ref, reactive, computed, onBeforeUnmount, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getSewingItems,
  exportSewingItems,
  type SewingListItem,
  type SewingListQuery,
} from '@/api/production-sewing'
import { getOrderSizeBreakdown, type OrderSizeBreakdownRes } from '@/api/orders'
import {
  normalizeSizeBreakdown,
  orderSizePopoverBlocks as qtyPopoverBlocksFromData,
  orderSizePopoverWidth as qtyPopoverWidthFromData,
} from '@/utils/order-size-popover-breakdown'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import { normalizeTextFilter } from '@/composables/useFilterBarHelpers'

export const SEWING_TABS = [
  { label: '全部', value: 'all' },
  { label: '等待车缝', value: 'pending' },
  { label: '车缝完成', value: 'completed' },
] as const

type SewingTabConfig = (typeof SEWING_TABS)[number]

export function useSewingList() {
  const filter = reactive({ orderNo: '', skuCode: '' })
  const orderNoLabelVisible = ref(false)
  const skuCodeLabelVisible = ref(false)

  const currentTab = ref<string>('all')
  const tabCounts = ref<Record<string, number>>({})
  const tabTotal = ref(0)
  const list = ref<SewingListItem[]>([])
  const loading = ref(false)
  const exporting = ref(false)
  const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
  const selectedRows = ref<SewingListItem[]>([])
  const hasSelection = computed(() => selectedRows.value.length > 0)
  const canAssignSelection = computed(() =>
    selectedRows.value.length > 0 && selectedRows.value.some((r) => r.sewingStatus !== 'completed'),
  )
  const canAssignCompletedSelection = computed(() =>
    selectedRows.value.length > 0 && selectedRows.value.some((r) => r.sewingStatus === 'completed'),
  )
  const canRegisterSelection = computed(() =>
    selectedRows.value.length > 0 && selectedRows.value.some((r) => r.sewingStatus !== 'completed'),
  )

  const tableShellRef = ref<HTMLElement | null>(null)
  const { tableHeight } = useFlexShellTableHeight(tableShellRef)
  const {
    compactHeaderCellStyle,
    compactCellStyle,
    compactRowStyle,
    compactImageSize,
    compactImageColumnMinWidth,
  } = useCompactTableStyle()
  const { onHeaderDragEnd, restoreColumnWidths } = useTableColumnWidthPersist('production-sewing-main')
  const sewingTableRef = ref<{ getTableRef: () => any } | null>(null)

  const sizeBreakdownCache = ref<Record<number, OrderSizeBreakdownRes>>({})
  const sizePopoverLoadingId = ref<number | null>(null)

  let searchTimer: ReturnType<typeof setTimeout> | null = null

  function clearSearchTimer() {
    if (!searchTimer) return
    clearTimeout(searchTimer)
    searchTimer = null
  }

  function qtyPopoverBlocks(orderId: number) {
    return qtyPopoverBlocksFromData(sizeBreakdownCache.value[orderId])
  }

  function qtyPopoverWidth(orderId: number) {
    return qtyPopoverWidthFromData(sizeBreakdownCache.value[orderId])
  }

  function getTabLabel(tab: SewingTabConfig): string {
    const counts = tabCounts.value
    const count = tab.value === 'all' ? tabTotal.value : counts[tab.value] ?? 0
    return `${tab.label}(${count})`
  }

  function buildQuery(): SewingListQuery {
    return {
      tab: currentTab.value,
      orderNo: normalizeTextFilter(filter.orderNo),
      skuCode: normalizeTextFilter(filter.skuCode),
      page: pagination.page,
      pageSize: pagination.pageSize,
    }
  }

  async function loadTabCounts() {
    const base = buildQuery()
    base.page = 1
    base.pageSize = 1
    const counts: Record<string, number> = {}
    await Promise.all(
      SEWING_TABS.map(async (tab) => {
        try {
          const res = await getSewingItems({ ...base, tab: tab.value })
          counts[tab.value] = res.data?.total ?? 0
        } catch {
          counts[tab.value] = 0
        }
      }),
    )
    tabCounts.value = counts
    tabTotal.value = counts.all ?? 0
  }

  async function load() {
    loading.value = true
    try {
      const res = await getSewingItems(buildQuery())
      const data = res.data
      if (data) {
        list.value = data.list ?? []
        pagination.total = data.total ?? 0
        restoreColumnWidths(sewingTableRef.value?.getTableRef?.())
      }
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      loading.value = false
    }
  }

  async function refreshAfterMutation() {
    await load()
    void loadTabCounts()
  }

  async function onExport() {
    const query = buildQuery()
    const { page, pageSize, ...rest } = query
    exporting.value = true
    try {
      const res = await exportSewingItems(rest)
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `车缝管理_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '导出失败'))
    } finally {
      exporting.value = false
    }
  }

  async function onShowQtyPopover(row: SewingListItem) {
    const id = row.orderId
    if (sizeBreakdownCache.value[id] || sizePopoverLoadingId.value === id) return
    sizePopoverLoadingId.value = id
    try {
      const res = await getOrderSizeBreakdown(id)
      sizeBreakdownCache.value[id] = normalizeSizeBreakdown(res.data ?? { headers: [], rows: [] })
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '尺码明细加载失败'))
    } finally {
      if (sizePopoverLoadingId.value === id) sizePopoverLoadingId.value = null
    }
  }

  function onSearch(byUser = false) {
    if (byUser) {
      if (filter.orderNo && String(filter.orderNo).trim()) orderNoLabelVisible.value = true
      if (filter.skuCode && String(filter.skuCode).trim()) skuCodeLabelVisible.value = true
    }
    pagination.page = 1
    void load()
    void loadTabCounts()
  }

  function debouncedSearch() {
    clearSearchTimer()
    searchTimer = setTimeout(() => {
      searchTimer = null
      onSearch(false)
    }, 400)
  }

  function onReset() {
    orderNoLabelVisible.value = false
    skuCodeLabelVisible.value = false
    filter.orderNo = ''
    filter.skuCode = ''
    currentTab.value = 'all'
    pagination.page = 1
    selectedRows.value = []
    void load()
    void loadTabCounts()
  }

  function onTabChange() {
    pagination.page = 1
    selectedRows.value = []
    void load()
    void loadTabCounts()
  }

  function onPageSizeChange() {
    pagination.page = 1
    void load()
  }

  function onSelectionChange(rows: SewingListItem[]) {
    selectedRows.value = rows
  }

  onBeforeUnmount(() => {
    clearSearchTimer()
  })

  return {
    SEWING_TABS,
    filter,
    orderNoLabelVisible,
    skuCodeLabelVisible,
    currentTab,
    list,
    loading,
    exporting,
    pagination,
    selectedRows,
    hasSelection,
    canAssignSelection,
    canAssignCompletedSelection,
    canRegisterSelection,
    tableShellRef,
    tableHeight,
    compactHeaderCellStyle,
    compactCellStyle,
    compactRowStyle,
    compactImageSize,
    compactImageColumnMinWidth,
    sewingTableRef: sewingTableRef as Ref<{ getTableRef: () => any } | null>,
    sizeBreakdownCache,
    sizePopoverLoadingId,
    onHeaderDragEnd,
    qtyPopoverBlocks,
    qtyPopoverWidth,
    getTabLabel,
    load,
    loadTabCounts,
    refreshAfterMutation,
    onExport,
    onShowQtyPopover,
    onSearch,
    debouncedSearch,
    onReset,
    onTabChange,
    onPageSizeChange,
    onSelectionChange,
  }
}

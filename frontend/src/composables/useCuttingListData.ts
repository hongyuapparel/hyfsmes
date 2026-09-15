import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { exportCuttingItems, getCuttingItems, type CuttingListItem, type CuttingListQuery } from '@/api/production-cutting'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { normalizeTextFilter } from '@/composables/useFilterBarHelpers'
import { useTableSort } from '@/composables/useTableSort'

interface UseCuttingListDataParams {
  clearSelection?: () => void
}

export function useCuttingListData(params: UseCuttingListDataParams) {
  const { clearSelection } = params

  const filter = reactive({ orderNo: '', skuCode: '' })
  const completedRange = ref<[string, string] | null>(null)
  const orderNoLabelVisible = ref(false)
  const skuCodeLabelVisible = ref(false)

  const currentTab = ref<string>('all')
  const tabCounts = ref<Record<string, number>>({})
  const tabTotal = ref<number | null>(null)
  const list = ref<CuttingListItem[]>([])
  const loading = ref(false)
  const exporting = ref(false)
  const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
  const totalQuantity = ref(0)

  let searchTimer: ReturnType<typeof setTimeout> | null = null

  const { sortField, sortOrder, onSortChange, sortParams } = useTableSort(() => {
    pagination.page = 1
    void load()
  })

  function buildQuery(): CuttingListQuery {
    const q: CuttingListQuery = {
      tab: currentTab.value,
      orderNo: normalizeTextFilter(filter.orderNo),
      skuCode: normalizeTextFilter(filter.skuCode),
      page: pagination.page,
      pageSize: pagination.pageSize,
      ...sortParams(),
    }
    if (completedRange.value && completedRange.value.length === 2) {
      q.completedStart = completedRange.value[0]
      q.completedEnd = completedRange.value[1]
    }
    return q
  }

  let listRequestId = 0

  async function load() {
    const requestId = ++listRequestId
    loading.value = true
    try {
      const res = await getCuttingItems(buildQuery())
      if (requestId !== listRequestId) return
      const data = res.data
      if (data) {
        tabCounts.value = data.tabCounts ?? {}
        tabTotal.value = data.tabCounts?.all ?? null
        list.value = data.list ?? []
        pagination.total = data.total ?? 0
        totalQuantity.value = Number(data.totalQuantity ?? 0) || 0
      }
    } catch (e: unknown) {
      if (requestId === listRequestId && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      if (requestId === listRequestId) loading.value = false
    }
  }

  async function onExport() {
    const query = buildQuery()
    const { page, pageSize, ...rest } = query
    void page
    void pageSize
    exporting.value = true
    try {
      const res = await exportCuttingItems(rest)
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `裁床管理_${new Date().toISOString().slice(0, 10)}.csv`
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

  function onSearch(byUser = false) {
    if (byUser) {
      if (filter.orderNo && String(filter.orderNo).trim()) orderNoLabelVisible.value = true
      if (filter.skuCode && String(filter.skuCode).trim()) skuCodeLabelVisible.value = true
    }
    pagination.page = 1
    void load()
  }

  function debouncedSearch() {
    if (searchTimer) clearTimeout(searchTimer)
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
    completedRange.value = null
    currentTab.value = 'all'
    pagination.page = 1
    clearSelection?.()
    void load()
  }

  function onTabChange() {
    pagination.page = 1
    clearSelection?.()
    void load()
  }

  function onPageSizeChange() {
    pagination.page = 1
    void load()
  }

  return {
    filter,
    completedRange,
    orderNoLabelVisible,
    skuCodeLabelVisible,
    currentTab,
    tabCounts,
    tabTotal,
    list,
    loading,
    exporting,
    pagination,
    totalQuantity,
    load,
    onExport,
    onSearch,
    debouncedSearch,
    onReset,
    onTabChange,
    onPageSizeChange,
    sortField,
    sortOrder,
    onSortChange,
  }
}

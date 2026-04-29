import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { exportCuttingItems, getCuttingItems, type CuttingListItem, type CuttingListQuery } from '@/api/production-cutting'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { normalizeTextFilter } from '@/composables/useFilterBarHelpers'

interface CuttingTabLike {
  value: string
}

interface UseCuttingListDataParams {
  tabs: readonly CuttingTabLike[]
  clearSelection?: () => void
}

export function useCuttingListData(params: UseCuttingListDataParams) {
  const { tabs, clearSelection } = params

  const filter = reactive({ orderNo: '', skuCode: '' })
  const completedRange = ref<[string, string] | null>(null)
  const orderNoLabelVisible = ref(false)
  const skuCodeLabelVisible = ref(false)

  const currentTab = ref<string>('all')
  const tabCounts = ref<Record<string, number>>({})
  const tabTotal = ref(0)
  const list = ref<CuttingListItem[]>([])
  const loading = ref(false)
  const exporting = ref(false)
  const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

  let searchTimer: ReturnType<typeof setTimeout> | null = null

  function buildQuery(): CuttingListQuery {
    const q: CuttingListQuery = {
      tab: currentTab.value,
      orderNo: normalizeTextFilter(filter.orderNo),
      skuCode: normalizeTextFilter(filter.skuCode),
      page: pagination.page,
      pageSize: pagination.pageSize,
    }
    if (completedRange.value && completedRange.value.length === 2) {
      q.completedStart = completedRange.value[0]
      q.completedEnd = completedRange.value[1]
    }
    return q
  }

  async function loadTabCounts() {
    const base = buildQuery()
    base.page = 1
    base.pageSize = 1
    const counts: Record<string, number> = {}
    for (const tab of tabs) {
      try {
        const res = await getCuttingItems({ ...base, tab: tab.value })
        const data = res.data
        counts[tab.value] = data?.total ?? 0
      } catch {
        counts[tab.value] = 0
      }
    }
    tabCounts.value = counts
    tabTotal.value = counts.all ?? 0
  }

  async function load() {
    loading.value = true
    try {
      const res = await getCuttingItems(buildQuery())
      const data = res.data
      if (data) {
        list.value = data.list ?? []
        pagination.total = data.total ?? 0
      }
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      loading.value = false
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
    void loadTabCounts()
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
    void loadTabCounts()
  }

  function onTabChange() {
    pagination.page = 1
    clearSelection?.()
    void load()
    void loadTabCounts()
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
    load,
    loadTabCounts,
    onExport,
    onSearch,
    debouncedSearch,
    onReset,
    onTabChange,
    onPageSizeChange,
  }
}

import { reactive, ref } from 'vue'

type FinishedStockFilter = {
  orderNo: string
  skuCode: string
  customerName: string
  inventoryTypeId: number | null
}

type FinishedStockPagination = {
  page: number
  pageSize: number
  total: number
}

type LoadHandler = () => void | Promise<void>

export function useFinishedViewStockFilter(load: LoadHandler, clearSelection: () => void) {
  const currentTab = ref<string>('stored')
  const filter = reactive<FinishedStockFilter>({
    orderNo: '',
    skuCode: '',
    customerName: '',
    inventoryTypeId: null,
  })
  const orderNoLabelVisible = ref(false)
  const skuCodeLabelVisible = ref(false)
  const inboundDateRange = ref<[string, string] | null>(null)
  const pagination = reactive<FinishedStockPagination>({ page: 1, pageSize: 20, total: 0 })

  function onSearch(byUser = false) {
    if (byUser) {
      if (filter.orderNo && String(filter.orderNo).trim()) orderNoLabelVisible.value = true
      if (filter.skuCode && String(filter.skuCode).trim()) skuCodeLabelVisible.value = true
    }
    pagination.page = 1
    void load()
  }

  let searchTimer: ReturnType<typeof setTimeout> | null = null
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
    filter.customerName = ''
    filter.inventoryTypeId = null
    inboundDateRange.value = null
    currentTab.value = 'stored'
    pagination.page = 1
    clearSelection()
    void load()
  }

  function onPageSizeChange(pageSize: number) {
    pagination.pageSize = pageSize
    pagination.page = 1
    void load()
  }

  function onCurrentPageChange(page: number) {
    pagination.page = page
    void load()
  }

  return {
    currentTab,
    filter,
    orderNoLabelVisible,
    skuCodeLabelVisible,
    inboundDateRange,
    pagination,
    onSearch,
    debouncedSearch,
    onReset,
    onPageSizeChange,
    onCurrentPageChange,
  }
}

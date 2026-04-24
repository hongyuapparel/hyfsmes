import { watch, type Ref, type WatchStopHandle } from 'vue'

interface OrderListFilterStateLike {
  orderNo: string
  skuCode: string
  customer: string
  orderTypeId: number | null
  processItem: string
  salesperson: string
  merchandiser: string
  factory: string
}

interface OrdersListFilterState {
  filter: OrderListFilterStateLike
  orderDateRange: [string, string] | null
  completedRange: [string, string] | null
  currentStatus: string
  page: number
  pageSize: number
  orderNoLabelVisible: boolean
  skuCodeLabelVisible: boolean
}

interface UseOrderListFilterStateParams {
  storageKey: string
  filter: OrderListFilterStateLike
  orderDateRange: Ref<[string, string] | null>
  completedRange: Ref<[string, string] | null>
  currentStatus: Ref<string>
  pagination: { page: number; pageSize: number }
  orderNoLabelVisible: Ref<boolean>
  skuCodeLabelVisible: Ref<boolean>
}

export function useOrderListFilterState(params: UseOrderListFilterStateParams) {
  const {
    storageKey,
    filter,
    orderDateRange,
    completedRange,
    currentStatus,
    pagination,
    orderNoLabelVisible,
    skuCodeLabelVisible,
  } = params

  function buildFilterStateSnapshot(): OrdersListFilterState {
    return {
      filter: {
        orderNo: filter.orderNo,
        skuCode: filter.skuCode,
        customer: filter.customer,
        orderTypeId: filter.orderTypeId,
        processItem: filter.processItem,
        salesperson: filter.salesperson,
        merchandiser: filter.merchandiser,
        factory: filter.factory,
      },
      orderDateRange: orderDateRange.value ? [...orderDateRange.value] as [string, string] : null,
      completedRange: completedRange.value ? [...completedRange.value] as [string, string] : null,
      currentStatus: currentStatus.value,
      page: pagination.page,
      pageSize: pagination.pageSize,
      orderNoLabelVisible: orderNoLabelVisible.value,
      skuCodeLabelVisible: skuCodeLabelVisible.value,
    }
  }

  function persistFilterState() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(buildFilterStateSnapshot()))
    } catch {
      // 浏览器存储不可用时保持静默，不影响列表功能
    }
  }

  function restoreFilterState() {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<OrdersListFilterState>
      const f: Partial<OrdersListFilterState['filter']> = parsed.filter ?? {}
      filter.orderNo = typeof f.orderNo === 'string' ? f.orderNo : ''
      filter.skuCode = typeof f.skuCode === 'string' ? f.skuCode : ''
      filter.customer = typeof f.customer === 'string' ? f.customer : ''
      filter.orderTypeId = typeof f.orderTypeId === 'number' ? f.orderTypeId : null
      filter.processItem = typeof f.processItem === 'string' ? f.processItem : ''
      filter.salesperson = typeof f.salesperson === 'string' ? f.salesperson : ''
      filter.merchandiser = typeof f.merchandiser === 'string' ? f.merchandiser : ''
      filter.factory = typeof f.factory === 'string' ? f.factory : ''
      orderDateRange.value = Array.isArray(parsed.orderDateRange) && parsed.orderDateRange.length === 2
        ? [parsed.orderDateRange[0], parsed.orderDateRange[1]]
        : null
      completedRange.value = Array.isArray(parsed.completedRange) && parsed.completedRange.length === 2
        ? [parsed.completedRange[0], parsed.completedRange[1]]
        : null
      currentStatus.value = typeof parsed.currentStatus === 'string' && parsed.currentStatus ? parsed.currentStatus : 'all'
      pagination.page = typeof parsed.page === 'number' && parsed.page > 0 ? parsed.page : 1
      pagination.pageSize = typeof parsed.pageSize === 'number' && parsed.pageSize > 0 ? parsed.pageSize : 20
      orderNoLabelVisible.value = Boolean(parsed.orderNoLabelVisible)
      skuCodeLabelVisible.value = Boolean(parsed.skuCodeLabelVisible)
    } catch {
      // 旧格式或损坏数据直接忽略，按默认筛选进入
    }
  }

  function applyQueryFromRoute(routeQuery: Record<string, unknown>) {
    const merchandiser = routeQuery.merchandiser
    const status = routeQuery.status
    const completedStart = routeQuery.completedStart
    const completedEnd = routeQuery.completedEnd

    if (typeof merchandiser === 'string' && merchandiser !== '') {
      filter.merchandiser = merchandiser
    }
    if (typeof status === 'string' && status !== '' && status !== 'all') {
      currentStatus.value = status
    }
    if (typeof completedStart === 'string' && typeof completedEnd === 'string') {
      completedRange.value = [completedStart, completedEnd]
    }
  }

  function startPersistWatch(): WatchStopHandle {
    return watch(
      [
        () => filter.orderNo,
        () => filter.skuCode,
        () => filter.customer,
        () => filter.orderTypeId,
        () => filter.processItem,
        () => filter.salesperson,
        () => filter.merchandiser,
        () => filter.factory,
        () => orderDateRange.value,
        () => completedRange.value,
        () => currentStatus.value,
        () => pagination.page,
        () => pagination.pageSize,
        () => orderNoLabelVisible.value,
        () => skuCodeLabelVisible.value,
      ],
      () => {
        persistFilterState()
      },
      { deep: true },
    )
  }

  return {
    persistFilterState,
    restoreFilterState,
    applyQueryFromRoute,
    startPersistWatch,
  }
}

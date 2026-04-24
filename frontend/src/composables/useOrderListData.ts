import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getOrders, type OrderListItem, type OrderListQuery } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const filter = reactive({
  orderNo: '',
  skuCode: '',
  customer: '',
  orderTypeId: null as number | null,
  processItem: '',
  salesperson: '',
  merchandiser: '',
  factory: '',
})

const list = ref<OrderListItem[]>([])
const loading = ref(false)
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
})

const currentStatus = ref<'all' | string>('all')
const orderDateRange = ref<[string, string] | null>(null)
const completedRange = ref<[string, string] | null>(null)
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)

let listReqId = 0
let listAbortController: AbortController | null = null

function buildQuery(): OrderListQuery {
  const q: OrderListQuery = {
    orderNo: filter.orderNo || undefined,
    skuCode: filter.skuCode || undefined,
    customer: filter.customer || undefined,
    orderTypeId: filter.orderTypeId ?? undefined,
    processItem: filter.processItem || undefined,
    salesperson: filter.salesperson || undefined,
    merchandiser: filter.merchandiser || undefined,
    factory: filter.factory || undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  }
  if (currentStatus.value !== 'all') q.status = currentStatus.value
  if (orderDateRange.value && orderDateRange.value.length === 2) {
    q.orderDateStart = orderDateRange.value[0]
    q.orderDateEnd = orderDateRange.value[1]
  }
  if (completedRange.value && completedRange.value.length === 2) {
    q.completedStart = completedRange.value[0]
    q.completedEnd = completedRange.value[1]
  }
  return q
}

async function loadList(totalQuantity?: { value: number }) {
  listAbortController?.abort()
  const controller = new AbortController()
  listAbortController = controller
  const currentReqId = ++listReqId
  loading.value = true
  try {
    const listRes = await getOrders(buildQuery(), { signal: controller.signal })
    const data = listRes.data
    if (data && currentReqId === listReqId) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      if (totalQuantity) totalQuantity.value = Number(data.totalQuantity ?? 0) || 0
    }
  } catch (e: unknown) {
    if ((e as any)?.code === 'ERR_CANCELED' || (e as any)?.name === 'CanceledError') return
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    if (currentReqId === listReqId) loading.value = false
  }
}

function onSearch(totalQuantity?: { value: number }, byUser = false) {
  if (byUser) {
    if (filter.orderNo && String(filter.orderNo).trim()) orderNoLabelVisible.value = true
    if (filter.skuCode && String(filter.skuCode).trim()) skuCodeLabelVisible.value = true
  }
  pagination.page = 1
  void loadList(totalQuantity)
}

function onReset(totalQuantity?: { value: number }) {
  orderNoLabelVisible.value = false
  skuCodeLabelVisible.value = false
  filter.orderNo = ''
  filter.skuCode = ''
  filter.customer = ''
  filter.orderTypeId = null
  filter.processItem = ''
  filter.salesperson = ''
  filter.merchandiser = ''
  filter.factory = ''
  orderDateRange.value = null
  completedRange.value = null
  currentStatus.value = 'all'
  pagination.page = 1
  void loadList(totalQuantity)
}

function onPageChange(page: number, totalQuantity?: { value: number }) {
  pagination.page = page
  void loadList(totalQuantity)
}

function onPageSizeChange(pageSize: number, totalQuantity?: { value: number }) {
  pagination.pageSize = pageSize
  pagination.page = 1
  void loadList(totalQuantity)
}

function abortListRequest() {
  listAbortController?.abort()
  loading.value = false
}

watch(
  () => filter.orderNo,
  (v) => {
    if (!v || !String(v).trim()) orderNoLabelVisible.value = false
  },
)

watch(
  () => filter.skuCode,
  (v) => {
    if (!v || !String(v).trim()) skuCodeLabelVisible.value = false
  },
)

export function useOrderListData() {
  return {
    filter,
    list,
    loading,
    pagination,
    currentStatus,
    orderDateRange,
    completedRange,
    orderNoLabelVisible,
    skuCodeLabelVisible,
    loadList,
    onSearch,
    onReset,
    onPageChange,
    onPageSizeChange,
    abortListRequest,
  }
}
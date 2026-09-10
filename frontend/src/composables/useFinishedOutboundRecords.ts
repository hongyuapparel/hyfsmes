import { ref, reactive, onScopeDispose } from 'vue'
import { ElMessage } from 'element-plus'
import { getFinishedOutboundRecords, type FinishedOutboundRecord } from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'

export function useFinishedOutboundRecords() {
  const outboundFilter = reactive<{
    orderNo: string
    skuCode: string
    customerName: string
    dateRange: [string, string] | []
  }>({ orderNo: '', skuCode: '', customerName: '', dateRange: [] })
  const outboundList = ref<FinishedOutboundRecord[]>([])
  const outboundLoading2 = ref(false)
  const outboundPagination = reactive({ page: 1, pageSize: 20, total: 0 })
  const finishedOutboundTableRef = ref()
  const { restoreColumnWidths: restoreFinishedOutboundColumnWidths } =
    useTableColumnWidthPersist('inventory-finished-outbounds')

  let requestVersion = 0
  onScopeDispose(() => { requestVersion++ })
  async function loadOutbounds() {
    const version = ++requestVersion
    outboundLoading2.value = true
    try {
      const [startDate, endDate] =
        Array.isArray(outboundFilter.dateRange) && outboundFilter.dateRange.length === 2
          ? outboundFilter.dateRange
          : ['', '']
      const res = await getFinishedOutboundRecords({
        orderNo: outboundFilter.orderNo || undefined,
        skuCode: outboundFilter.skuCode || undefined,
        customerName: outboundFilter.customerName || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: outboundPagination.page,
        pageSize: outboundPagination.pageSize,
      })
      const data = res.data
      if (version !== requestVersion) return
      outboundList.value = data?.list ?? []
      outboundPagination.total = data?.total ?? 0
      restoreFinishedOutboundColumnWidths(finishedOutboundTableRef.value)
    } catch (e: unknown) {
      if (version === requestVersion && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      if (version === requestVersion) outboundLoading2.value = false
    }
  }

  function onOutboundSearch(_byUser = false) {
    outboundPagination.page = 1
    loadOutbounds()
  }

  function onOutboundReset() {
    outboundFilter.orderNo = ''
    outboundFilter.skuCode = ''
    outboundFilter.customerName = ''
    outboundFilter.dateRange = []
    outboundPagination.page = 1
    loadOutbounds()
  }

  function onOutboundPageSizeChange() {
    outboundPagination.page = 1
    loadOutbounds()
  }

  return {
    outboundFilter,
    outboundList,
    outboundLoading2,
    outboundPagination,
    finishedOutboundTableRef,
    loadOutbounds,
    onOutboundSearch,
    onOutboundReset,
    onOutboundPageSizeChange,
  }
}

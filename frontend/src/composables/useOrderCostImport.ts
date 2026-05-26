import { onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getOrderCost, getOrders, type OrderListItem } from '@/api/orders'
import { getOrderStatuses } from '@/api/order-status-config'
import { getProcessQuoteTemplates, getProcessQuoteTemplateItems } from '@/api/process-quote-templates'
import {
  DEFAULT_PRODUCTION_PROCESS_QTY,
  mapImportedProductionRows,
  normalizeProductionCostMultiplier,
  type ProductionRow,
} from '@/utils/order-cost'
import { getOrderStatusTagType, type OrderStatusTagType } from '@/utils/order-status-display'

interface ImportOrderDialogState {
  visible: boolean
  keyword: string
  loading: boolean
  applying: boolean
  results: OrderListItem[]
  selectedId: number | null
}

const IMPORT_ORDER_SEARCH_PAGE_SIZE = 20
const IMPORT_ORDER_SEARCH_DEBOUNCE_MS = 350

export function useOrderCostImport(
  productionRows: { value: ProductionRow[] },
  selectedProductionRows: { value: ProductionRow[] },
  productionCostMultiplier: { value: number },
) {
  const importTemplateDialog = ref<{ visible: boolean; templateId: number | null }>({ visible: false, templateId: null })
  const importTemplateOptions = ref<Array<{ id: number; name: string }>>([])
  const importOrderDialog = ref<ImportOrderDialogState>({
    visible: false,
    keyword: '',
    loading: false,
    applying: false,
    results: [],
    selectedId: null,
  })
  const importOrderStatusLabelMap = ref<Record<string, string>>({})

  let importOrderSearchTimer: ReturnType<typeof setTimeout> | null = null
  let importOrderSearchSeq = 0

  function clearImportOrderSearchTimer() {
    if (!importOrderSearchTimer) return
    clearTimeout(importOrderSearchTimer)
    importOrderSearchTimer = null
  }

  function resetImportOrderSearchResults() {
    importOrderDialog.value.results = []
    importOrderDialog.value.selectedId = null
  }

  watch(
    () => [importOrderDialog.value.visible, importOrderDialog.value.keyword] as const,
    ([visible, keyword]) => {
      clearImportOrderSearchTimer()
      if (!visible) return
      if (!keyword.trim()) {
        importOrderSearchSeq += 1
        importOrderDialog.value.loading = false
        resetImportOrderSearchResults()
        return
      }
      importOrderSearchTimer = setTimeout(() => {
        importOrderSearchTimer = null
        void searchImportOrders({ showNotice: false })
      }, IMPORT_ORDER_SEARCH_DEBOUNCE_MS)
    },
  )

  onBeforeUnmount(() => {
    clearImportOrderSearchTimer()
  })

  async function loadImportOrderStatusLabels() {
    if (Object.keys(importOrderStatusLabelMap.value).length) return
    try {
      const res = await getOrderStatuses()
      importOrderStatusLabelMap.value = Object.fromEntries((res.data ?? []).map((item) => [item.code, item.label]))
    } catch {
      importOrderStatusLabelMap.value = {}
    }
  }

  function getImportOrderStatusLabel(status: string): string {
    const value = String(status ?? '')
    return importOrderStatusLabelMap.value[value] || value || '-'
  }

  function getImportOrderStatusTagType(status: string): OrderStatusTagType {
    return getOrderStatusTagType(status)
  }

  function openImportOrderDialog() {
    clearImportOrderSearchTimer()
    importOrderDialog.value = {
      visible: true,
      keyword: '',
      loading: false,
      applying: false,
      results: [],
      selectedId: null,
    }
    void loadImportOrderStatusLabels()
  }

  function closeImportOrderDialog() {
    clearImportOrderSearchTimer()
    importOrderSearchSeq += 1
    importOrderDialog.value = {
      visible: false,
      keyword: '',
      loading: false,
      applying: false,
      results: [],
      selectedId: null,
    }
  }

  function mergeImportOrderResults(...lists: OrderListItem[][]): OrderListItem[] {
    const map = new Map<number, OrderListItem>()
    lists.flat().forEach((item) => {
      if (item?.id != null && !map.has(item.id)) map.set(item.id, item)
    })
    return Array.from(map.values())
  }

  async function searchImportOrders(options?: { showNotice?: boolean }) {
    clearImportOrderSearchTimer()
    const showNotice = options?.showNotice !== false
    const keyword = importOrderDialog.value.keyword.trim()
    const searchSeq = ++importOrderSearchSeq
    if (!keyword) {
      resetImportOrderSearchResults()
      if (showNotice) ElMessage.warning('请输入订单号或 SKU')
      return
    }
    importOrderDialog.value.loading = true
    try {
      const [byOrderNo, bySkuCode] = await Promise.all([
        getOrders({ orderNo: keyword, page: 1, pageSize: IMPORT_ORDER_SEARCH_PAGE_SIZE }),
        getOrders({ skuCode: keyword, page: 1, pageSize: IMPORT_ORDER_SEARCH_PAGE_SIZE }),
      ])
      if (searchSeq !== importOrderSearchSeq || keyword !== importOrderDialog.value.keyword.trim()) return
      const results = mergeImportOrderResults(byOrderNo.data?.list ?? [], bySkuCode.data?.list ?? [])
      importOrderDialog.value.results = results
      importOrderDialog.value.selectedId = null
      if (!results.length && showNotice) ElMessage.warning('未找到匹配订单')
    } catch (e: unknown) {
      if (searchSeq === importOrderSearchSeq && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '搜索订单失败'))
    } finally {
      if (searchSeq === importOrderSearchSeq) importOrderDialog.value.loading = false
    }
  }

  async function applyImportOrder(): Promise<boolean> {
    const sourceOrderId = importOrderDialog.value.selectedId
    if (!sourceOrderId) return false
    importOrderDialog.value.applying = true
    try {
      const res = await getOrderCost(sourceOrderId)
      const snapshot = (res.data?.snapshot ?? {}) as Record<string, unknown>
      const rows = mapImportedProductionRows(snapshot.productionRows)
      if (!rows.length) {
        ElMessage.warning('该订单暂无可导入的生产工序成本')
        return false
      }
      try {
        await ElMessageBox.confirm(
          '确定用来源订单的生产工序成本覆盖当前生产工序表吗？导入后不会自动保存。',
          '导入订单工序成本',
          { type: 'warning', confirmButtonText: '覆盖导入', cancelButtonText: '取消' },
        )
      } catch {
        return false
      }
      productionRows.value = rows
      selectedProductionRows.value = []
      productionCostMultiplier.value = normalizeProductionCostMultiplier(snapshot.productionCostMultiplier)
      importOrderDialog.value.visible = false
      ElMessage.success(`已导入 ${rows.length} 条生产工序成本`)
      return true
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '导入订单生产工序成本失败'))
      return false
    } finally {
      importOrderDialog.value.applying = false
    }
  }

  async function loadImportTemplateOptions() {
    try {
      const res = await getProcessQuoteTemplates()
      importTemplateOptions.value = (res.data ?? []).map((item) => ({ id: item.id, name: item.name }))
    } catch {
      importTemplateOptions.value = []
    }
  }

  async function openImportTemplateDialog() {
    importTemplateDialog.value = { visible: true, templateId: null }
    await loadImportTemplateOptions()
  }

  async function applyImportTemplate() {
    const templateId = importTemplateDialog.value.templateId
    if (templateId == null) return
    try {
      const res = await getProcessQuoteTemplateItems(templateId)
      const rows: ProductionRow[] = (res.data ?? []).map((item) => ({
        processId: item.processId,
        department: item.department ?? '',
        jobType: item.jobType ?? '',
        processName: item.processName ?? '',
        remark: '',
        unitPrice: Number(item.unitPrice) || 0,
        quantity: DEFAULT_PRODUCTION_PROCESS_QTY,
      }))
      productionRows.value.push(...rows)
      importTemplateDialog.value.visible = false
      ElMessage.success(`已导入 ${rows.length} 条工序，可按款式微调`)
    } catch (e: unknown) {
      ElMessage.error((e as { message?: string })?.message ?? '导入失败')
    }
  }

  return {
    importTemplateDialog,
    importTemplateOptions,
    importOrderDialog,
    openImportOrderDialog,
    closeImportOrderDialog,
    searchImportOrders,
    applyImportOrder,
    loadImportTemplateOptions,
    openImportTemplateDialog,
    applyImportTemplate,
    getImportOrderStatusLabel,
    getImportOrderStatusTagType,
  }
}

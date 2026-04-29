import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request, { getErrorMessage, isErrorHandled } from '@/api/request'
import { getDictItems } from '@/api/dicts'
import { getOrderCost, getOrderDetail, getOrders, type OrderDetail, type OrderListItem } from '@/api/orders'
import { getOrderStatuses } from '@/api/order-status-config'
import { getProductionProcesses, type ProductionProcessItem } from '@/api/production-processes'
import { getSupplierBusinessScopeTreeOptions, type SupplierBusinessScopeTreeNode } from '@/api/suppliers'
import { getProcessQuoteTemplates, getProcessQuoteTemplateItems } from '@/api/process-quote-templates'
import {
  DEFAULT_PROCESS_ITEM_QTY,
  DEFAULT_PRODUCTION_PROCESS_QTY,
  DEFAULT_PRODUCTION_MULTIPLIER,
  DEFAULT_PROFIT_MARGIN,
  ensureBaseCostRows,
  formatProductionProcessSelectLabel,
  getJobTypeLabel,
  normalizeProductionCostMultiplier,
  normalizeProfitMargin,
  type MaterialRow,
  type ProcessItemRow,
  type ProductionRow,
} from '@/utils/order-cost'
import { getOrderStatusTagType, type OrderStatusTagType } from '@/utils/order-status-display'
import { useOrderCostCalculations } from './useOrderCostCalculations'

interface ProcessOptionNode {
  label: string
  value: string
  children?: ProcessOptionNode[]
}

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

export function useOrderCostData(orderId: number) {
  const order = ref<OrderDetail | null>(null)
  const materialRows = ref<MaterialRow[]>([])
  const processItemRows = ref<ProcessItemRow[]>([])
  const productionRows = ref<ProductionRow[]>([])
  const productionProcesses = ref<ProductionProcessItem[]>([])
  const materialTypeOptions = ref<Array<{ id: number; label: string }>>([])
  const supplierOptions = ref<Array<{ id: number; name: string }>>([])
  const supplierLoading = ref(false)
  const processOptions = ref<ProcessOptionNode[]>([])
  const hasPreloadedSuppliers = ref(false)
  const hasLoadedProcessOptions = ref(false)
  const productionPickerVisible = ref(false)
  const selectedProductionRows = ref<ProductionRow[]>([])
  const productionCostMultiplier = ref(DEFAULT_PRODUCTION_MULTIPLIER)
  const profitMargin = ref(DEFAULT_PROFIT_MARGIN)
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
  const quoteConfirmedAt = ref('')
  const quoteConfirmedBy = ref('')
  const quoteNeedsReconfirm = ref(false)
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

  const productionAddedIdsSignature = computed(() => {
    const ids = productionRows.value.map((row) => Number(row.processId)).filter((id) => Number.isInteger(id) && id > 0)
    return [...new Set(ids)].sort((a, b) => a - b).join(',')
  })
  const departmentOptions = computed(() => {
    const values = productionProcesses.value.map((item) => item.department).filter((item): item is string => !!item)
    return Array.from(new Set(values))
  })

  const calculations = useOrderCostCalculations({
    materialRows,
    processItemRows,
    productionRows,
    materialTypeOptions,
    productionCostMultiplier,
    profitMargin,
  })

  async function loadMaterialTypes() {
    try {
      const res = await getDictItems('material_types')
      materialTypeOptions.value = (res.data ?? []).map((item: any) => ({ id: item.id, label: item.value }))
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('物料类型加载失败', getErrorMessage(e))
    }
  }

  function syncMaterialTypeIdsFromLabel() {
    if (!materialTypeOptions.value.length || !materialRows.value.length) return
    const map = new Map<string, number>()
    materialTypeOptions.value.forEach((item) => item.label && map.set(String(item.label), item.id))
    materialRows.value.forEach((row) => {
      if ((row.materialTypeId == null || Number.isNaN(row.materialTypeId as any)) && row.materialType) {
        const id = map.get(String(row.materialType))
        if (id) row.materialTypeId = id
      }
    })
  }

  async function searchSuppliers(keyword: string) {
    supplierLoading.value = true
    try {
      const res = await request.get('/suppliers', {
        params: { keyword: keyword || undefined, pageSize: 20 },
        skipGlobalErrorHandler: true,
      })
      supplierOptions.value = (res.data as { list?: { id: number; name: string }[] }).list ?? []
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('供应商下拉加载失败', getErrorMessage(e))
    } finally {
      supplierLoading.value = false
    }
  }

  function onSupplierSelectVisibleChange(visible: boolean) {
    if (!visible || hasPreloadedSuppliers.value) return
    hasPreloadedSuppliers.value = true
    void searchSuppliers('')
  }

  async function loadProcessOptions() {
    if (hasLoadedProcessOptions.value) return
    try {
      const res = await getSupplierBusinessScopeTreeOptions('工艺供应商')
      const toTree = (nodes: SupplierBusinessScopeTreeNode[], parentPath = ''): ProcessOptionNode[] =>
        nodes.map((item) => {
          const path = parentPath ? `${parentPath} / ${item.value}` : item.value
          return { label: item.value, value: path, children: item.children?.length ? toTree(item.children, path) : undefined }
        })
      processOptions.value = toTree(res.data ?? [])
      hasLoadedProcessOptions.value = true
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('工艺项目选项加载失败', getErrorMessage(e))
    }
  }

  function onProcessOptionsVisibleChange(visible: boolean) {
    if (!visible) return
    void loadProcessOptions()
  }

  function addMaterialRow() { materialRows.value.push({ unitPrice: 0, includeInCost: true } as MaterialRow) }
  function removeMaterialRow(row: MaterialRow) { materialRows.value = materialRows.value.filter((item) => item !== row) }
  function addProcessItemRow() { processItemRows.value.push({ unitPrice: 0, quantity: DEFAULT_PROCESS_ITEM_QTY } as ProcessItemRow) }
  function removeProcessItemRow(index: number) { processItemRows.value.splice(index, 1) }

  function syncFromOrder(detail: OrderDetail) {
    materialRows.value = (detail.materials ?? []).map((item: any) => ({ ...item, unitPrice: 0, includeInCost: true })) as MaterialRow[]
    processItemRows.value = (detail.processItems ?? []).map((item) => ({ ...item, unitPrice: 0, quantity: DEFAULT_PROCESS_ITEM_QTY })) as ProcessItemRow[]
    const base = ensureBaseCostRows(materialRows.value, processItemRows.value)
    materialRows.value = base.materialRows
    processItemRows.value = base.processItemRows
  }

  async function loadOrder() {
    if (!orderId) return
    try {
      const res = await getOrderDetail(orderId)
      order.value = res.data
      if (order.value) syncFromOrder(order.value)
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载订单失败'))
    }
  }

  async function loadCostSnapshot() {
    if (!orderId) return
    try {
      const res = await getOrderCost(orderId)
      const s = (res.data?.snapshot ?? {}) as any
      if (Array.isArray(s.materialRows) && s.materialRows.length) {
        materialRows.value = s.materialRows.map((item: MaterialRow) => ({ ...item, includeInCost: item.includeInCost !== false }))
      }
      if (Array.isArray(s.processItemRows) && s.processItemRows.length) processItemRows.value = s.processItemRows
      if (Array.isArray(s.productionRows) && s.productionRows.length) {
        productionRows.value = s.productionRows.map((item: ProductionRow) => {
          const n = Number(item.quantity)
          return { ...item, quantity: Number.isFinite(n) && n >= 0 ? n : DEFAULT_PRODUCTION_PROCESS_QTY }
        })
      }
      if (s.productionCostMultiplier !== undefined) productionCostMultiplier.value = normalizeProductionCostMultiplier(s.productionCostMultiplier)
      if (s.profitMargin !== undefined) profitMargin.value = normalizeProfitMargin(s.profitMargin)
      quoteConfirmedAt.value = typeof s.quoteConfirmedAt === 'string' ? s.quoteConfirmedAt : ''
      quoteConfirmedBy.value = typeof s.quoteConfirmedBy === 'string' ? s.quoteConfirmedBy : ''
      quoteNeedsReconfirm.value = Boolean(s.quoteNeedsReconfirm)
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载成本快照失败'))
    }
  }

  async function loadProcesses() {
    try {
      const res = await getProductionProcesses()
      productionProcesses.value = res.data ?? []
      if (!productionRows.value.length) {
        const first = productionProcesses.value[0]
        productionRows.value = [{ processId: first?.id ?? null, department: first?.department ?? '', jobType: first?.jobType ?? '', processName: first?.name ?? '', remark: '', unitPrice: first ? Number(first.unitPrice) || 0 : 0, quantity: DEFAULT_PRODUCTION_PROCESS_QTY }]
      }
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载生产工序失败'))
    }
  }

  function syncProductionIdsFromName() {
    if (!productionProcesses.value.length || !productionRows.value.length) return
    const map = new Map<string, ProductionProcessItem>()
    productionProcesses.value.forEach((item) => item.name && map.set(item.name, item))
    productionRows.value.forEach((row) => {
      if ((row.processId == null || Number.isNaN(row.processId as any)) && row.processName) {
        const found = map.get(row.processName)
        if (!found) return
        row.processId = found.id
        row.department = found.department || row.department
        row.jobType = found.jobType || row.jobType
        row.unitPrice = Number(found.unitPrice) || row.unitPrice
      }
    })
  }

  function getJobTypeOptions(row: ProductionRow): string[] {
    const dept = (row.department ?? '').trim()
    const values = productionProcesses.value.filter((item) => !dept || (item.department ?? '').trim() === dept).map((item) => item.jobType).filter((item): item is string => !!item)
    return Array.from(new Set(values))
  }

  function getProductionProcessSelectOptions(row: ProductionRow): Array<{ value: number; label: string }> {
    const dept = (row.department ?? '').trim()
    const job = (row.jobType ?? '').trim()
    return productionProcesses.value
      .filter((item) => (!dept || (item.department ?? '').trim() === dept) && (!job || (item.jobType ?? '').trim() === job))
      .map((item) => ({ value: item.id, label: formatProductionProcessSelectLabel(item.name ?? '') }))
  }

  async function openProductionPickerDialog() {
    await loadProcesses()
    productionPickerVisible.value = true
  }

  function onProductionPickerAppend(items: ProductionProcessItem[]) {
    const existing = new Set(productionRows.value.map((row) => Number(row.processId)).filter((id) => Number.isInteger(id) && id > 0))
    const appended = items.map((item) => ({ processId: item.id, department: item.department ?? '', jobType: item.jobType ?? '', processName: item.name ?? '', remark: '', unitPrice: Number(item.unitPrice) || 0, quantity: DEFAULT_PRODUCTION_PROCESS_QTY })).filter((row) => !existing.has(Number(row.processId)))
    if (!appended.length) return
    productionRows.value = [...productionRows.value, ...appended]
  }

  function removeProductionRow(row: ProductionRow) {
    productionRows.value = productionRows.value.filter((item) => item !== row)
    selectedProductionRows.value = selectedProductionRows.value.filter((item) => item !== row)
  }
  function onProductionSelectionChange(rows: ProductionRow[]) { selectedProductionRows.value = rows }
  async function batchRemoveProductionRows() {
    if (!selectedProductionRows.value.length) return
    try {
      await ElMessageBox.confirm(`确认删除已选 ${selectedProductionRows.value.length} 条工序吗？`, '批量删除', { type: 'warning' })
    } catch { return }
    const selected = new Set(selectedProductionRows.value)
    productionRows.value = productionRows.value.filter((item) => !selected.has(item))
    selectedProductionRows.value = []
    ElMessage.success('已批量删除工序')
  }

  function onProductionProcessChange(row: ProductionRow) {
    if (!row.processId) return
    const found = productionProcesses.value.find((item) => item.id === row.processId)
    if (!found) return
    row.department = found.department || row.department
    row.jobType = found.jobType || row.jobType
    row.unitPrice = Number(found.unitPrice) || 0
    row.processName = found.name
  }
  function onProductionDepartmentChange(row: ProductionRow) {
    const jobs = getJobTypeOptions(row)
    if (row.jobType && !jobs.includes(row.jobType)) {
      row.jobType = ''
      row.processId = null
      row.processName = ''
      row.unitPrice = 0
      return
    }
    if (!getProductionProcessSelectOptions(row).some((item) => item.value === row.processId)) {
      row.processId = null
      row.processName = ''
      row.unitPrice = 0
    }
  }
  function onProductionJobTypeChange(row: ProductionRow) {
    if (!getProductionProcessSelectOptions(row).some((item) => item.value === row.processId)) {
      row.processId = null
      row.processName = ''
      row.unitPrice = 0
    }
  }

  function normalizeImportedProductionRow(item: Partial<ProductionRow>): ProductionRow {
    const processId = Number(item.processId)
    const unitPrice = Number(item.unitPrice)
    const quantity = Number(item.quantity)
    return {
      processId: Number.isInteger(processId) && processId > 0 ? processId : null,
      department: String(item.department ?? ''),
      jobType: String(item.jobType ?? ''),
      processName: String(item.processName ?? ''),
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : DEFAULT_PRODUCTION_PROCESS_QTY,
      remark: String(item.remark ?? ''),
    }
  }

  function mapImportedProductionRows(value: unknown): ProductionRow[] {
    if (!Array.isArray(value)) return []
    return value
      .map((item) => normalizeImportedProductionRow((item ?? {}) as Partial<ProductionRow>))
      .filter((row) => {
        return Boolean(
          row.processId ||
          row.department?.trim() ||
          row.jobType?.trim() ||
          row.processName?.trim() ||
          row.remark?.trim() ||
          Number(row.unitPrice) > 0,
        )
      })
  }

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
      const rows: ProductionRow[] = (res.data ?? []).map((item) => ({ processId: item.processId, department: item.department ?? '', jobType: item.jobType ?? '', processName: item.processName ?? '', remark: '', unitPrice: Number(item.unitPrice) || 0, quantity: DEFAULT_PRODUCTION_PROCESS_QTY }))
      productionRows.value.push(...rows)
      importTemplateDialog.value.visible = false
      ElMessage.success(`已导入 ${rows.length} 条工序，可按款式微调`)
    } catch (e: unknown) {
      ElMessage.error((e as { message?: string })?.message ?? '导入失败')
    }
  }

  return {
    order,
    materialRows,
    processItemRows,
    productionRows,
    productionProcesses,
    materialTypeOptions,
    supplierOptions,
    supplierLoading,
    processOptions,
    productionPickerVisible,
    selectedProductionRows,
    productionCostMultiplier,
    profitMargin,
    importTemplateDialog,
    importTemplateOptions,
    importOrderDialog,
    quoteConfirmedAt,
    quoteConfirmedBy,
    quoteNeedsReconfirm,
    productionAddedIdsSignature,
    departmentOptions,
    getJobTypeLabel,
    ...calculations,
    loadOrder,
    loadCostSnapshot,
    loadProcesses,
    loadMaterialTypes,
    syncMaterialTypeIdsFromLabel,
    syncProductionIdsFromName,
    searchSuppliers,
    onSupplierSelectVisibleChange,
    onProcessOptionsVisibleChange,
    addMaterialRow,
    removeMaterialRow,
    addProcessItemRow,
    removeProcessItemRow,
    getJobTypeOptions,
    getProductionProcessSelectOptions,
    openProductionPickerDialog,
    onProductionPickerAppend,
    removeProductionRow,
    onProductionSelectionChange,
    batchRemoveProductionRows,
    onProductionProcessChange,
    onProductionDepartmentChange,
    onProductionJobTypeChange,
    openImportTemplateDialog,
    applyImportTemplate,
    loadImportTemplateOptions,
    openImportOrderDialog,
    closeImportOrderDialog,
    searchImportOrders,
    applyImportOrder,
    getImportOrderStatusLabel,
    getImportOrderStatusTagType,
  }
}

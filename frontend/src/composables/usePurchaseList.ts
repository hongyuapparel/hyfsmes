import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { exportPurchaseItems, getPurchaseItems, type PurchaseItemRow, type PurchaseListQuery } from '@/api/production-purchase'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getDictTree } from '@/api/dicts'
import type { SystemOptionTreeNode } from '@/api/system-options'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { ACTIVE_FILTER_COLOR, normalizeTextFilter } from '@/composables/useFilterBarHelpers'
import type { ProductionOrderBriefModel } from '@/components/production/ProductionOrderBriefPanel.vue'

export const PURCHASE_TABS = [
  { label: '全部', value: 'all' },
  { label: '等待采购', value: 'pending' },
  { label: '待领料', value: 'picking' },
  { label: '采购完成', value: 'completed' },
] as const

type PurchaseTabConfig = (typeof PURCHASE_TABS)[number]

const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR as string }

function toOrderTypeTreeSelect(
  nodes: SystemOptionTreeNode[],
): { label: string; value: number; children?: unknown[]; disabled?: boolean }[] {
  return nodes.map((n) => {
    const children = n.children?.length ? toOrderTypeTreeSelect(n.children) : []
    const hasChildren = children.length > 0
    return {
      label: n.value,
      value: n.id,
      children: hasChildren ? children : undefined,
      disabled: hasChildren,
    }
  })
}

export function usePurchaseList() {
  const orderTypeTree = ref<SystemOptionTreeNode[]>([])
  const orderTypeTreeSelectData = computed(() => toOrderTypeTreeSelect(orderTypeTree.value))

  function findOrderTypeLabelById(id: number | null | undefined): string {
    if (!id) return ''
    const stack: SystemOptionTreeNode[] = [...orderTypeTree.value]
    while (stack.length) {
      const node = stack.pop()!
      if (node.id === id) return node.value
      if (node.children?.length) stack.push(...node.children)
    }
    return ''
  }

  function getFilterSelectAutoWidthStyle(v: unknown) {
    if (!v) return undefined
    const text = String(v)
    const estimated = text.length * FILTER_CHAR_PX + 60
    const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
    return { ...activeSelectStyle, width: `${width}px`, flex: `0 0 ${width}px` }
  }

  const filter = reactive({
    orderNo: '',
    skuCode: '',
    supplier: '',
    orderTypeId: null as number | null,
  })
  const orderDateRange = ref<[string, string] | null>(null)
  const completedRange = ref<[string, string] | null>(null)
  const orderNoLabelVisible = ref(false)
  const skuCodeLabelVisible = ref(false)
  const currentTab = ref<string>('all')
  const materialProgressColumnLabel = computed(() =>
    currentTab.value === 'picking' ? '领料状态' : '采购状态',
  )
  const tabCounts = ref<Record<string, number>>({})
  const tabTotal = ref(0)
  const list = ref<PurchaseItemRow[]>([])
  const loading = ref(false)
  const exporting = ref(false)
  const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
  const selectedRows = ref<PurchaseItemRow[]>([])
  const hasSelection = computed(() => selectedRows.value.length > 0)
  const purchaseTableHostRef = ref<{ purchaseTableRef?: unknown } | null>(null)
  const { onHeaderDragEnd, restoreColumnWidths } = useTableColumnWidthPersist('production-purchase-main')

  function getTabLabel(tab: PurchaseTabConfig): string {
    const counts = tabCounts.value
    const count = tab.value === 'all' ? tabTotal.value : counts[tab.value] ?? 0
    return `${tab.label}(${count})`
  }

  function buildQuery(): PurchaseListQuery {
    const q: PurchaseListQuery = {
      tab: currentTab.value,
      orderNo: normalizeTextFilter(filter.orderNo),
      skuCode: normalizeTextFilter(filter.skuCode),
      supplier: normalizeTextFilter(filter.supplier),
      orderTypeId: filter.orderTypeId ?? undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    }
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

  async function loadTabCounts() {
    const base = buildQuery()
    base.page = 1
    base.pageSize = 1
    const counts: Record<string, number> = {}
    await Promise.all(
      PURCHASE_TABS.map(async (tab) => {
        try {
          const res = await getPurchaseItems({ ...base, tab: tab.value })
          const data = res.data
          counts[tab.value] = data?.total ?? 0
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
      const res = await getPurchaseItems(buildQuery())
      const data = res.data
      if (data) {
        list.value = data.list ?? []
        pagination.total = data.total ?? 0
        restoreColumnWidths((purchaseTableHostRef.value as any)?.purchaseTableRef)
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
      const res = await exportPurchaseItems(rest)
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `采购管理_${new Date().toISOString().slice(0, 10)}.csv`
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
    filter.supplier = ''
    filter.orderTypeId = null
    orderDateRange.value = null
    completedRange.value = null
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

  function onSelectionChange(rows: PurchaseItemRow[]) {
    selectedRows.value = rows
  }

  async function loadOptions() {
    try {
      const res = await getDictTree('order_types')
      orderTypeTree.value = Array.isArray(res.data) ? res.data : []
    } catch {
      orderTypeTree.value = []
    }
  }

  function orderTypeDisplay(row: PurchaseItemRow): string {
    if (typeof row.orderTypeId === 'number') {
      const label = findOrderTypeLabelById(row.orderTypeId)
      if (label && label.trim()) return label.trim()
    }
    return ''
  }

  const purchaseBriefDrawer = reactive<{ visible: boolean; row: PurchaseItemRow | null }>({
    visible: false,
    row: null,
  })

  function openPurchaseBriefDrawer(row: PurchaseItemRow) {
    purchaseBriefDrawer.row = row
    purchaseBriefDrawer.visible = true
  }

  function purchaseBriefFromRow(row: PurchaseItemRow): ProductionOrderBriefModel {
    return {
      orderNo: row.orderNo,
      skuCode: row.skuCode,
      imageUrl: row.imageUrl,
      customerName: row.customerName,
      merchandiser: row.merchandiser,
      customerDueDate: row.customerDueDate,
      orderQuantity: row.orderQuantity,
      orderDate: row.orderDate,
      orderTypeLabel: orderTypeDisplay(row),
    }
  }

  function displayMaterialType(row: PurchaseItemRow): string {
    return (row.materialType ?? '').trim() || '-'
  }

  return {
    filter,
    orderDateRange,
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
    selectedRows,
    hasSelection,
    orderTypeTreeSelectData,
    materialProgressColumnLabel,
    purchaseTableHostRef,
    purchaseBriefDrawer,
    getTabLabel,
    getFilterSelectAutoWidthStyle,
    findOrderTypeLabelById,
    load,
    loadTabCounts,
    onExport,
    onSearch,
    debouncedSearch,
    onReset,
    onTabChange,
    onPageSizeChange,
    onSelectionChange,
    onHeaderDragEnd,
    loadOptions,
    orderTypeDisplay,
    openPurchaseBriefDrawer,
    purchaseBriefFromRow,
    displayMaterialType,
  }
}

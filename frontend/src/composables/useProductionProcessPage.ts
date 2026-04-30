import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getCraftItems, completeCraft, exportCraftItems, type CraftListItem, type CraftListQuery } from '@/api/production-craft'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getDictTree, getDictItems } from '@/api/dicts'
import type { SystemOptionTreeNode } from '@/api/system-options'
import { normalizeTextFilter } from '@/composables/useFilterBarHelpers'
import type { ProductionOrderBriefModel } from '@/components/production/ProductionOrderBriefPanel.vue'

const CRAFT_TABS = [
  { label: '全部', value: 'all' },
  { label: '等待送出', value: 'pending' },
  { label: '工艺完成', value: 'completed' },
] as const

type CraftTabConfig = (typeof CRAFT_TABS)[number]

interface DictItem {
  id: number
  value: string
}

function toOrderTypeTreeSelect(
  nodes: SystemOptionTreeNode[],
): { label: string; value: number; children?: unknown[]; disabled?: boolean }[] {
  return nodes.map((n) => {
    const children = n.children?.length ? toOrderTypeTreeSelect(n.children) : []
    const hasChildren = children.length > 0
    return { label: n.value, value: n.id, children: hasChildren ? children : undefined, disabled: hasChildren }
  })
}

export function useProductionProcessPage() {
  const orderTypeTree = ref<SystemOptionTreeNode[]>([])
  const collaborationOptions = ref<{ id: number; label: string }[]>([])
  const orderTypeTreeSelectData = computed(() => toOrderTypeTreeSelect(orderTypeTree.value))

  function findOrderTypeLabelById(id: number | null | undefined): string {
    if (!id) return ''
    const stack: SystemOptionTreeNode[] = [...orderTypeTree.value]
    while (stack.length) {
      const node = stack.pop()
      if (!node) continue
      if (node.id === id) return node.value
      if (node.children?.length) stack.push(...node.children)
    }
    return ''
  }

  function findCollaborationLabelById(id: number | null | undefined): string {
    if (!id) return ''
    const found = collaborationOptions.value.find((opt) => opt.id === id)
    return found?.label ?? ''
  }

  const filter = reactive({
    supplier: '',
    processItem: '',
    orderTypeId: null as number | null,
    collaborationTypeId: null as number | null,
  })
  const orderDateRange = ref<[string, string] | null>(null)
  const completedRange = ref<[string, string] | null>(null)

  const currentTab = ref<string>('all')
  const tabCounts = ref<Record<string, number>>({})
  const tabTotal = ref(0)
  const list = ref<CraftListItem[]>([])
  const loading = ref(false)
  const exporting = ref(false)
  const completing = ref(false)
  const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
  const totalQuantity = ref(0)
  const selectedRows = ref<CraftListItem[]>([])
  const hasSelection = computed(() => selectedRows.value.length > 0)
  const canCompleteSelection = computed(() =>
    selectedRows.value.length > 0 && selectedRows.value.some((r) => r.craftStatus !== 'completed'),
  )

  function getTabLabel(tab: CraftTabConfig): string {
    const counts = tabCounts.value
    const count = tab.value === 'all' ? tabTotal.value : counts[tab.value] ?? 0
    return `${tab.label}(${count})`
  }

  function buildQuery(): CraftListQuery {
    const q: CraftListQuery = {
      tab: currentTab.value,
      supplier: normalizeTextFilter(filter.supplier),
      processItem: normalizeTextFilter(filter.processItem),
      orderTypeId: filter.orderTypeId ?? undefined,
      collaborationTypeId: filter.collaborationTypeId ?? undefined,
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
    for (const tab of CRAFT_TABS) {
      try {
        const res = await getCraftItems({ ...base, tab: tab.value })
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
      const res = await getCraftItems(buildQuery())
      const data = res.data
      if (data) {
        list.value = data.list ?? []
        pagination.total = data.total ?? 0
        totalQuantity.value = Number(data.totalQuantity ?? 0) || 0
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
      const res = await exportCraftItems(rest)
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `工艺管理_${new Date().toISOString().slice(0, 10)}.csv`
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

  function onSearch() {
    pagination.page = 1
    void load()
    void loadTabCounts()
  }

  let searchTimer: ReturnType<typeof setTimeout> | null = null
  function debouncedSearch() {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      searchTimer = null
      onSearch()
    }, 400)
  }

  function onReset() {
    filter.supplier = ''
    filter.processItem = ''
    filter.orderTypeId = null
    filter.collaborationTypeId = null
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

  function onSelectionChange(rows: CraftListItem[]) {
    selectedRows.value = rows
  }

  async function onConfirmComplete() {
    const toComplete = selectedRows.value.filter((r) => r.craftStatus !== 'completed')
    if (toComplete.length === 0) return
    completing.value = true
    try {
      for (const row of toComplete) {
        await completeCraft(row.orderId)
      }
      ElMessage.success(`已确认完成 ${toComplete.length} 条`)
      await load()
      void loadTabCounts()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '操作失败'))
    } finally {
      completing.value = false
    }
  }

  async function loadOptions() {
    try {
      const [orderTypeRes, collabRes] = await Promise.all([
        getDictTree('order_types'),
        getDictItems('collaboration'),
      ])
      orderTypeTree.value = Array.isArray(orderTypeRes.data) ? orderTypeRes.data : []
      const items = collabRes.data ?? []
      collaborationOptions.value = (Array.isArray(items) ? items : []).map((item) => {
        const typedItem = item as DictItem
        return {
          id: typedItem.id,
          label: typedItem.value,
        }
      })
    } catch {
      orderTypeTree.value = []
      collaborationOptions.value = []
    }
  }

  function orderTypeDisplay(row: CraftListItem): string {
    if (typeof row.orderTypeId === 'number') {
      const label = findOrderTypeLabelById(row.orderTypeId)
      if (label && label.trim()) return label.trim()
    }
    return ''
  }

  function collaborationDisplay(row: CraftListItem): string {
    if (typeof row.collaborationTypeId === 'number') {
      const label = findCollaborationLabelById(row.collaborationTypeId)
      if (label && label.trim()) return label.trim()
    }
    return ''
  }

  const craftDetailDrawer = reactive<{ visible: boolean; row: CraftListItem | null }>({
    visible: false,
    row: null,
  })

  function openCraftDetailDrawer(row: CraftListItem) {
    craftDetailDrawer.row = row
    craftDetailDrawer.visible = true
  }

  function craftBriefFromRow(row: CraftListItem | null): ProductionOrderBriefModel | null {
    if (!row) return null
    return {
      orderNo: row.orderNo,
      skuCode: row.skuCode,
      imageUrl: row.imageUrl,
      customerName: row.customerName,
      merchandiser: row.merchandiser,
      customerDueDate: row.customerDueDate,
      orderQuantity: row.quantity,
      orderDate: row.orderDate,
      orderTypeLabel: orderTypeDisplay(row),
      collaborationLabel: collaborationDisplay(row),
    }
  }

  onMounted(() => {
    void loadOptions()
    void (async () => {
      await load()
      await loadTabCounts()
    })()
  })

  return {
    CRAFT_TABS,
    orderTypeTreeSelectData,
    collaborationOptions,
    filter,
    orderDateRange,
    completedRange,
    currentTab,
    list,
    loading,
    exporting,
    completing,
    pagination,
    totalQuantity,
    selectedRows,
    hasSelection,
    canCompleteSelection,
    getTabLabel,
    findOrderTypeLabelById,
    findCollaborationLabelById,
    debouncedSearch,
    onExport,
    onSearch,
    onReset,
    onTabChange,
    onPageSizeChange,
    onSelectionChange,
    onConfirmComplete,
    orderTypeDisplay,
    collaborationDisplay,
    craftDetailDrawer,
    openCraftDetailDrawer,
    craftBriefFromRow,
    load,
  }
}

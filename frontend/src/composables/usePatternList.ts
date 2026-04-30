import { computed, reactive, ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getPatternItems, exportPatternItems, type PatternListItem, type PatternListQuery } from '@/api/production-pattern'
import { getDictTree, getDictItems } from '@/api/dicts'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import type { SystemOptionTreeNode } from '@/api/system-options'
import { ACTIVE_FILTER_COLOR, normalizeTextFilter } from '@/composables/useFilterBarHelpers'

export const PATTERN_TABS = [
  { label: '全部', value: 'all' },
  { label: '待分单', value: 'pending_assign' },
  { label: '打样中', value: 'in_progress' },
  { label: '样品完成', value: 'completed' },
] as const

export type PatternTabConfig = (typeof PATTERN_TABS)[number]

export function usePatternList() {
  const orderTypeTree = ref<SystemOptionTreeNode[]>([])
  const collaborationOptions = ref<{ id: number; label: string }[]>([])

  const filter = reactive({
    orderNo: '',
    skuCode: '',
    patternMaster: '',
    sampleMaker: '',
    orderTypeId: null as number | null,
    collaborationTypeId: null as number | null,
  })
  const orderDateRange = ref<[string, string] | null>(null)
  const completedRange = ref<[string, string] | null>(null)
  const orderNoLabelVisible = ref(false)
  const skuCodeLabelVisible = ref(false)
  const currentTab = ref<string>('all')
  const tabCounts = ref<Record<string, number>>({})
  const tabTotal = ref(0)
  const list = ref<PatternListItem[]>([])
  const loading = ref(false)
  const exporting = ref(false)
  const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
  const totalQuantity = ref(0)
  const selectedRows = ref<PatternListItem[]>([])
  const hasSelection = computed(() => selectedRows.value.length > 0)
  const canCompleteSelection = computed(() =>
    selectedRows.value.length > 0 && selectedRows.value.every((r) => r.patternStatus !== 'completed'),
  )

  const FILTER_AUTO_MIN_WIDTH = 140
  const FILTER_AUTO_MAX_WIDTH = 320
  const FILTER_CHAR_PX = 14
  const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR as string }

  const orderTypeTreeSelectData = computed(() => toOrderTypeTreeSelect(orderTypeTree.value))

  let tabCountsReqId = 0
  let listAbortController: AbortController | null = null
  let patternListReqId = 0
  let searchTimer: ReturnType<typeof setTimeout> | null = null

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

  function findCollaborationLabelById(id: number | null | undefined): string {
    if (!id) return ''
    const found = collaborationOptions.value.find((opt) => opt.id === id)
    return found?.label ?? ''
  }

  function getFilterSelectAutoWidthStyle(value: unknown) {
    if (!value) return undefined
    const text = String(value)
    const estimated = text.length * FILTER_CHAR_PX + 60
    const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
    return { ...activeSelectStyle, width: `${width}px`, flex: `0 0 ${width}px` }
  }

  function getTabLabel(tab: PatternTabConfig): string {
    const counts = tabCounts.value
    const count = tab.value === 'all' ? tabTotal.value : counts[tab.value] ?? 0
    return `${tab.label}(${count})`
  }

  function buildQuery(): PatternListQuery {
    const q: PatternListQuery = {
      tab: currentTab.value,
      orderNo: normalizeTextFilter(filter.orderNo),
      skuCode: normalizeTextFilter(filter.skuCode),
      patternMaster: normalizeTextFilter(filter.patternMaster),
      sampleMaker: normalizeTextFilter(filter.sampleMaker),
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

  function isRequestCanceled(err: unknown): boolean {
    const e = err as { code?: string; name?: string }
    return e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError'
  }

  async function loadTabCounts() {
    tabCountsReqId++
    const reqId = tabCountsReqId
    const base = buildQuery()
    base.page = 1
    base.pageSize = 1
    const counts: Record<string, number> = {}
    for (const tab of PATTERN_TABS) {
      try {
        const res = await getPatternItems({ ...base, tab: tab.value })
        const data = res.data
        counts[tab.value] = data?.total ?? 0
      } catch {
        counts[tab.value] = 0
      }
    }
    if (reqId !== tabCountsReqId) return
    tabCounts.value = counts
    tabTotal.value = counts.all ?? 0
  }

  async function load(getTableRef?: () => unknown) {
    patternListReqId++
    const reqId = patternListReqId
    listAbortController?.abort()
    listAbortController = new AbortController()
    const signal = listAbortController.signal
    loading.value = true
    try {
      const res = await getPatternItems(buildQuery(), { signal })
      if (reqId !== patternListReqId) return
      const data = res.data
      if (data) {
        list.value = data.list ?? []
        pagination.total = data.total ?? 0
        totalQuantity.value = Number(data.totalQuantity ?? 0) || 0
        getTableRef?.()
      }
    } catch (e: unknown) {
      if (isRequestCanceled(e)) return
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      if (reqId === patternListReqId) loading.value = false
    }
  }

  async function onExport() {
    const query = buildQuery()
    const { page, pageSize, ...rest } = query
    exporting.value = true
    try {
      const res = await exportPatternItems(rest)
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `纸样管理_${new Date().toISOString().slice(0, 10)}.csv`
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

  function onSelectionChange(rows: PatternListItem[]) {
    selectedRows.value = rows
  }

  function onSearch(loadFn: () => void, byUser = false) {
    if (byUser) {
      if (filter.orderNo && String(filter.orderNo).trim()) orderNoLabelVisible.value = true
      if (filter.skuCode && String(filter.skuCode).trim()) skuCodeLabelVisible.value = true
    }
    pagination.page = 1
    loadFn()
    void loadTabCounts()
  }

  function debouncedSearch(loadFn: () => void) {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      searchTimer = null
      onSearch(loadFn, false)
    }, 400)
  }

  function onReset(loadFn: () => void) {
    orderNoLabelVisible.value = false
    skuCodeLabelVisible.value = false
    filter.orderNo = ''
    filter.skuCode = ''
    filter.patternMaster = ''
    filter.sampleMaker = ''
    filter.orderTypeId = null
    filter.collaborationTypeId = null
    orderDateRange.value = null
    completedRange.value = null
    currentTab.value = 'all'
    pagination.page = 1
    selectedRows.value = []
    loadFn()
    void loadTabCounts()
  }

  function onTabChange(loadFn: () => void) {
    pagination.page = 1
    selectedRows.value = []
    loadFn()
    void loadTabCounts()
  }

  function onPageSizeChange(loadFn: () => void) {
    pagination.page = 1
    loadFn()
  }

  async function loadOptions() {
    try {
      const [orderTypeRes, collabRes] = await Promise.all([
        getDictTree('order_types'),
        getDictItems('collaboration'),
      ])
      orderTypeTree.value = Array.isArray(orderTypeRes.data) ? orderTypeRes.data : []
      const items = collabRes.data ?? []
      collaborationOptions.value = (Array.isArray(items) ? items : []).map((item: any) => ({
        id: item.id,
        label: item.value,
      }))
    } catch {
      orderTypeTree.value = []
      collaborationOptions.value = []
    }
  }

  return {
    PATTERN_TABS,
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
    totalQuantity,
    selectedRows,
    hasSelection,
    canCompleteSelection,
    orderTypeTreeSelectData,
    collaborationOptions,
    findOrderTypeLabelById,
    findCollaborationLabelById,
    getFilterSelectAutoWidthStyle,
    getTabLabel,
    load,
    loadTabCounts,
    loadOptions,
    onExport,
    onSearch,
    debouncedSearch,
    onReset,
    onTabChange,
    onPageSizeChange,
    onSelectionChange,
  }
}

import { ref, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getProductionProcessesPage,
  createProductionProcess,
  updateProductionProcess,
  deleteProductionProcess,
  type ProductionProcessItem,
} from '@/api/production-processes'
import {
  getSystemOptionsList,
  getSystemOptionsRoots,
  getSystemOptionsChildren,
  createSystemOption,
  updateSystemOption,
  deleteSystemOption,
  batchUpdateSystemOptionOrder,
  type SystemOptionItem,
} from '@/api/system-options'
import {
  ProcessTreeRow,
  getChildrenFromLocalCache,
  mapJobTypeRowsFromChildren,
  buildProcessRowsWithLoadMore,
  buildJobTypePathsFromList,
} from './orderSettingsProcessTreeHelpers'

const processDepartments = ['裁床', '车缝', '尾部'] as const
const MAX_PROCESS_REFRESH_SIZE = 2000

interface ProcessPosition {
  department: string
  jobTypePath: string
}

export function useOrderSettingsProductionProcesses() {
  const processTreeTableRef = ref<InstanceType<typeof import('element-plus')['ElTable']>>()
  const processTreeData = ref<ProcessTreeRow[]>([])
  const processJobTypeListRef = ref<SystemOptionItem[]>([])
  const processJobTypeChildrenMapRef = ref<Map<number, SystemOptionItem[]>>(new Map())
  // keyed by nodeId; stores accumulated items across all loaded pages
  const processRowsCacheRef = ref<Map<number, ProductionProcessItem[]>>(new Map())
  const processPageMapRef = ref<Map<number, number>>(new Map())
  const processTotalMapRef = ref<Map<number, number>>(new Map())
  const processJobMetaByNodeIdRef = ref<Map<number, { department: string; jobTypePath: string }>>(new Map())
  const expandedKeys = ref<Array<string | number>>([])
  const scrollTop = ref(0)

  const processDialog = ref<{ visible: boolean; id?: number }>({ visible: false })
  const processForm = ref({ department: '', jobType: '', name: '', unitPrice: 0, sortOrder: 0 })
  const editingProcessPosition = ref<ProcessPosition | null>(null)
  const processJobTypeOptions = ref<string[]>([])
  const jobTypeDialog = ref<{ visible: boolean; mode: 'edit' | 'add'; nodeId?: number; parentId?: number | null; isTopLevel?: boolean }>({ visible: false, mode: 'add' })
  const jobTypeForm = ref<{ value: string; parentId: number | null }>({ value: '', parentId: null })
  const jobTypeSubmitLoading = ref(false)

  const PAGE_SIZE = 50

  const captureScrollTop = () => (scrollTop.value = window.scrollY || document.documentElement.scrollTop || 0)
  const restoreScrollTop = () => window.scrollTo({ top: scrollTop.value })
  const saveExpandedRowKey = (row: ProcessTreeRow) => {
    if ((row.rowType === 'department' || row.rowType === 'job_type') && !expandedKeys.value.includes(row.id)) {
      expandedKeys.value = [...expandedKeys.value, row.id]
    }
  }

  async function refreshProcessJobTypeList() {
    try {
      const res = await getSystemOptionsList('process_job_types')
      const list = (res.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      processJobTypeListRef.value = list
      const childrenMap = new Map<number, SystemOptionItem[]>()
      for (const item of list) {
        if (item.parentId == null) continue
        const bucket = childrenMap.get(item.parentId) ?? []
        bucket.push(item)
        childrenMap.set(item.parentId, bucket)
      }
      processJobTypeChildrenMapRef.value = childrenMap
    } catch {
      processJobTypeListRef.value = []
      processJobTypeChildrenMapRef.value = new Map()
    }
  }

  async function ensureProcessJobTypeRoots() {
    try {
      const res = await getSystemOptionsRoots('process_job_types')
      const roots = res.data ?? []
      const values = new Set(roots.map((item) => item.value))
      const toAdd = processDepartments.filter((item) => !values.has(item))
      for (let i = 0; i < toAdd.length; i++) {
        await createSystemOption({ type: 'process_job_types', value: toAdd[i], sort_order: roots.length + i, parent_id: null })
      }
      await refreshProcessJobTypeList()
    } catch {
      // ignore
    }
  }

  async function loadProcessTreeRoots() {
    try {
      const res = await getSystemOptionsRoots('process_job_types')
      processTreeData.value = (res.data ?? []).map((node) => ({
        id: `dept-${node.id}`,
        rowType: 'department',
        displayName: node.value,
        department: node.value,
        jobType: '',
        processName: '',
        price: '',
        hasChildren: true,
        nodeId: node.id,
        parentId: null,
      }))
    } catch {
      processTreeData.value = []
    }
  }

  async function loadProcessTreeNode(row: ProcessTreeRow, _: { level: number; expanded: boolean }, resolve: (rows: ProcessTreeRow[]) => void) {
    if (row.rowType === 'department' && row.nodeId != null) {
      saveExpandedRowKey(row)
      const localChildren = getChildrenFromLocalCache(processJobTypeChildrenMapRef, row.nodeId)
      if (localChildren) return resolve(mapJobTypeRowsFromChildren(localChildren, row, processJobMetaByNodeIdRef))
      try {
        const res = await getSystemOptionsChildren('process_job_types', row.nodeId)
        resolve(mapJobTypeRowsFromChildren(res.data ?? [], row, processJobMetaByNodeIdRef))
      } catch {
        resolve([])
      }
      return
    }
    if (row.rowType !== 'job_type' || row.nodeId == null || row.jobTypePath == null) return
    saveExpandedRowKey(row)
    const localChildren = getChildrenFromLocalCache(processJobTypeChildrenMapRef, row.nodeId)
    if (localChildren?.length) return resolve(mapJobTypeRowsFromChildren(localChildren, row, processJobMetaByNodeIdRef))
    try {
      const childrenRes = await getSystemOptionsChildren('process_job_types', row.nodeId)
      const children = childrenRes.data ?? []
      if (children.length > 0) return resolve(mapJobTypeRowsFromChildren(children, row, processJobMetaByNodeIdRef))
      const rows = await fetchProcessRowsByMeta(row.nodeId, row.department, row.jobTypePath)
      resolve(rows)
    } catch {
      resolve([])
    }
  }

  const getTreeTable = () => processTreeTableRef.value as unknown as { updateKeyChildren?: (key: string | number, rows: ProcessTreeRow[]) => void } | undefined
  const getLoadedPageCount = (nodeId: number) => Math.max(1, Math.ceil((processRowsCacheRef.value.get(nodeId)?.length ?? PAGE_SIZE) / PAGE_SIZE))
  const getPreservedPageSize = (nodeId: number) => Math.min(MAX_PROCESS_REFRESH_SIZE, getLoadedPageCount(nodeId) * PAGE_SIZE)
  const isProcessNodeVisible = (nodeId: number) => processRowsCacheRef.value.has(nodeId) || expandedKeys.value.includes(`job-${nodeId}`)

  function getProcessPosition(item: { department?: string; jobType?: string }): ProcessPosition {
    return { department: item.department ?? '', jobTypePath: item.jobType ?? '' }
  }

  function isSameProcessPosition(left: ProcessPosition | null, right: ProcessPosition | null) {
    return !!left && !!right && left.department === right.department && left.jobTypePath === right.jobTypePath
  }

  function findJobTypeNodeIdByPosition(position: ProcessPosition | null): number | null {
    if (!position?.department || !position.jobTypePath) return null
    for (const [nodeId, meta] of processJobMetaByNodeIdRef.value.entries()) {
      if (meta.department === position.department && meta.jobTypePath === position.jobTypePath) return nodeId
    }

    const root = processJobTypeListRef.value.find((item) => item.parentId == null && item.value === position.department)
    if (!root) return null
    const parts = position.jobTypePath.split('>').map((part) => part.trim()).filter(Boolean)
    const pathParts = parts[0] === position.department ? parts.slice(1) : parts
    let parentId = root.id
    let nodeId: number | null = null
    for (const part of pathParts) {
      const current = processJobTypeListRef.value.find((item) => item.parentId === parentId && item.value === part)
      if (!current) return null
      nodeId = current.id
      parentId = current.id
    }
    if (nodeId != null) processJobMetaByNodeIdRef.value.set(nodeId, position)
    return nodeId
  }

  function syncCachedProcessRowsToTable(nodeId: number) {
    const meta = processJobMetaByNodeIdRef.value.get(nodeId)
    if (!meta) return
    const list = processRowsCacheRef.value.get(nodeId) ?? []
    const total = processTotalMapRef.value.get(nodeId) ?? list.length
    const rows = buildProcessRowsWithLoadMore(nodeId, meta.department, meta.jobTypePath, list, total, list.length)
    getTreeTable()?.updateKeyChildren?.(`job-${nodeId}`, rows)
  }

  async function fetchProcessRowsByMeta(nodeId: number, department: string, jobTypePath: string, page = 1, pageSize = PAGE_SIZE) {
    const pageRes = (await getProductionProcessesPage({ department, jobType: jobTypePath, page, pageSize })).data
    const newItems = pageRes?.items ?? []
    const total = pageRes?.total ?? 0
    const existing = page === 1 ? [] : (processRowsCacheRef.value.get(nodeId) ?? [])
    const accumulated = [...existing, ...newItems]
    processRowsCacheRef.value.set(nodeId, accumulated)
    processTotalMapRef.value.set(nodeId, total)
    processPageMapRef.value.set(nodeId, page === 1 ? Math.max(1, Math.ceil(accumulated.length / PAGE_SIZE)) : page)
    return buildProcessRowsWithLoadMore(nodeId, department, jobTypePath, accumulated, total, accumulated.length)
  }

  async function refreshJobTypeChildrenByMeta(nodeId: number, department: string, jobTypePath: string, page = 1, pageSize = PAGE_SIZE) {
    const rows = await fetchProcessRowsByMeta(nodeId, department, jobTypePath, page, pageSize)
    getTreeTable()?.updateKeyChildren?.(`job-${nodeId}`, rows)
  }

  async function refreshProcessNodePreservingLoadedCount(nodeId: number) {
    const meta = processJobMetaByNodeIdRef.value.get(nodeId)
    if (!meta || !isProcessNodeVisible(nodeId)) return
    await refreshJobTypeChildrenByMeta(nodeId, meta.department, meta.jobTypePath, 1, getPreservedPageSize(nodeId))
  }

  async function loadMoreProcesses(row: ProcessTreeRow) {
    if (row.rowType !== 'load_more' || !row.jobTypePath || row.parentId == null) return
    captureScrollTop()
    const nextPage = (processPageMapRef.value.get(row.parentId) ?? 1) + 1
    await refreshJobTypeChildrenByMeta(row.parentId, row.department, row.jobTypePath, nextPage)
    await nextTick()
    restoreScrollTop()
  }

  async function loadProcessJobTypeOptions(department: string) {
    if (!department) return (processJobTypeOptions.value = [])
    if (!processJobTypeListRef.value.length) await refreshProcessJobTypeList()
    const root = processJobTypeListRef.value.find((node) => node.parentId == null && node.value === department)
    processJobTypeOptions.value = root ? buildJobTypePathsFromList(processJobTypeListRef.value, root.id, department) : []
  }

  async function openProcessDialog(row?: ProductionProcessItem, treeRow?: ProcessTreeRow) {
    if (row) {
      editingProcessPosition.value = getProcessPosition(row)
      processDialog.value = { visible: true, id: row.id }
      processForm.value = { department: row.department ?? '', jobType: row.jobType ?? '', name: row.name ?? '', unitPrice: Number(row.unitPrice) || 0, sortOrder: row.sortOrder ?? 0 }
      await loadProcessJobTypeOptions(processForm.value.department)
      return
    }
    const dept = treeRow?.department ?? ''
    const job = treeRow?.jobTypePath ?? treeRow?.jobType ?? ''
    editingProcessPosition.value = null
    processDialog.value = { visible: true }
    processForm.value = { department: dept, jobType: job, name: '', unitPrice: 0, sortOrder: 0 }
    if (dept) await loadProcessJobTypeOptions(dept)
    else processJobTypeOptions.value = []
  }

  function onProcessDepartmentChange() {
    processForm.value.jobType = ''
    void loadProcessJobTypeOptions(processForm.value.department)
  }

  function patchProcessRowLocal(item: ProductionProcessItem) {
    const patchedNodeIds: number[] = []
    for (const [nodeId, list] of processRowsCacheRef.value.entries()) {
      const idx = list.findIndex((x) => x.id === item.id)
      if (idx < 0) continue
      const next = [...list]
      next.splice(idx, 1, { ...next[idx], ...item })
      processRowsCacheRef.value.set(nodeId, next)
      patchedNodeIds.push(nodeId)
    }
    return patchedNodeIds
  }

  function findCachedNodeIdsByProcessId(processId: number) {
    const nodeIds: number[] = []
    for (const [nodeId, list] of processRowsCacheRef.value.entries()) {
      if (list.some((item) => item.id === processId)) nodeIds.push(nodeId)
    }
    return nodeIds
  }

  async function syncSavedProcessRow(savedItem: ProductionProcessItem, originalPosition: ProcessPosition | null) {
    const nextPosition = getProcessPosition(savedItem)
    const sourceNodeId = findJobTypeNodeIdByPosition(originalPosition)
    const targetNodeId = findJobTypeNodeIdByPosition(nextPosition)
    const moved = originalPosition != null && !isSameProcessPosition(originalPosition, nextPosition)

    if (!moved) {
      const patchedNodeIds = patchProcessRowLocal(savedItem)
      if (patchedNodeIds.length) {
        patchedNodeIds.forEach(syncCachedProcessRowsToTable)
        return
      }
    }

    const nodeIdsToRefresh = new Set<number>()
    if (sourceNodeId != null) nodeIdsToRefresh.add(sourceNodeId)
    else findCachedNodeIdsByProcessId(savedItem.id).forEach((nodeId) => nodeIdsToRefresh.add(nodeId))
    if (targetNodeId != null) nodeIdsToRefresh.add(targetNodeId)
    await Promise.all([...nodeIdsToRefresh].map((nodeId) => refreshProcessNodePreservingLoadedCount(nodeId)))
  }

  async function submitProcess() {
    const name = processForm.value.name?.trim()
    if (!name) return ElMessage.warning('请填写工序名称')
    try {
      captureScrollTop()
      let savedItem: ProductionProcessItem | null = null
      if (processDialog.value.id) {
        const res = await updateProductionProcess(processDialog.value.id, { department: processForm.value.department, jobType: processForm.value.jobType, name: processForm.value.name, unitPrice: String(processForm.value.unitPrice) })
        savedItem = res.data ?? null
      } else {
        const res = await createProductionProcess({ department: processForm.value.department, jobType: processForm.value.jobType, name: processForm.value.name, unitPrice: String(processForm.value.unitPrice) })
        savedItem = res.data ?? null
      }
      processDialog.value.visible = false
      if (savedItem) await syncSavedProcessRow(savedItem, editingProcessPosition.value)
      await nextTick()
      restoreScrollTop()
      editingProcessPosition.value = null
    } catch (e: unknown) {
      ElMessage.error((e as { message?: string })?.message ?? '操作失败')
    }
  }

  async function removeProcess(row: ProductionProcessItem) {
    try {
      await ElMessageBox.confirm(`确定删除工序「${row.name}」？`, '删除确认', { type: 'warning' })
      await deleteProductionProcess(row.id)
      captureScrollTop()
      const nodeId = findJobTypeNodeIdByPosition(getProcessPosition(row))
      const nodeIdsToRefresh = nodeId != null ? [nodeId] : findCachedNodeIdsByProcessId(row.id)
      await Promise.all(nodeIdsToRefresh.map((item) => refreshProcessNodePreservingLoadedCount(item)))
      await nextTick()
      restoreScrollTop()
      ElMessage.success('已删除')
    } catch (e) {
      if ((e as string) !== 'cancel') ElMessage.error('删除失败')
    }
  }

  function onProcessTreeExpandChange(row: ProcessTreeRow, expanded: boolean | ProcessTreeRow[]) {
    if (row.rowType !== 'department' && row.rowType !== 'job_type') return
    const isExpanded = Array.isArray(expanded) ? expanded.some((item) => item.id === row.id) : !!expanded
    if (isExpanded) saveExpandedRowKey(row)
    else expandedKeys.value = expandedKeys.value.filter((key) => key !== row.id)
  }

  const jobTypeDialogTitle = () => (jobTypeDialog.value.mode === 'edit' ? '编辑工种' : jobTypeDialog.value.isTopLevel ? '新增部门' : '新建工种')
  const jobTypeEditDepartmentOptions = () => processJobTypeListRef.value.filter((item) => item.parentId == null).map((item) => ({ value: item.id, label: item.value })).sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
  const getJobTypeRootDepartmentId = (nodeId: number) => {
    let current = processJobTypeListRef.value.find((item) => item.id === nodeId) ?? null
    while (current && current.parentId != null) current = processJobTypeListRef.value.find((item) => item.id === current?.parentId) ?? null
    return current?.id ?? null
  }

  function onJobTypeDialogClose() {
    jobTypeDialog.value.nodeId = undefined
    jobTypeDialog.value.parentId = undefined
    jobTypeForm.value = { value: '', parentId: null }
  }

  const openAddDepartment = () => { jobTypeDialog.value = { visible: true, mode: 'add', parentId: null, isTopLevel: true }; jobTypeForm.value = { value: '', parentId: null } }
  const openAddChildJobType = (row: ProcessTreeRow) => {
    const parentId = row.rowType === 'department' ? row.nodeId ?? null : row.rowType === 'job_type' ? row.nodeId ?? null : null
    if (parentId == null) return
    jobTypeDialog.value = { visible: true, mode: 'add', parentId, isTopLevel: false }
    jobTypeForm.value = { value: '', parentId: null }
  }
  const openEditJobType = (row: ProcessTreeRow) => {
    if (row.rowType !== 'job_type' || row.nodeId == null) return
    jobTypeDialog.value = { visible: true, mode: 'edit', nodeId: row.nodeId }
    jobTypeForm.value = { value: row.displayName, parentId: getJobTypeRootDepartmentId(row.nodeId) }
  }

  async function submitJobType() {
    const value = jobTypeForm.value.value?.trim()
    if (!value) return ElMessage.warning('请输入名称')
    jobTypeSubmitLoading.value = true
    try {
      if (jobTypeDialog.value.mode === 'edit' && jobTypeDialog.value.nodeId != null) {
        const nodeId = jobTypeDialog.value.nodeId
        const currentItem = processJobTypeListRef.value.find((item) => item.id === nodeId)
        const payload: { value: string; parent_id?: number | null; sort_order?: number } = { value }
        if (currentItem && currentItem.parentId !== jobTypeForm.value.parentId) payload.parent_id = jobTypeForm.value.parentId
        await updateSystemOption(nodeId, payload)
      } else if (jobTypeDialog.value.mode === 'add') {
        const pid = jobTypeDialog.value.parentId ?? null
        const siblings = pid == null ? (await getSystemOptionsRoots('process_job_types')).data ?? [] : (await getSystemOptionsChildren('process_job_types', pid)).data ?? []
        await createSystemOption({ type: 'process_job_types', value, sort_order: siblings.length, parent_id: pid })
      }
      jobTypeDialog.value.visible = false
      await refreshProcessJobTypeList()
      await loadProcessTreeRoots()
      await nextTick()
      restoreScrollTop()
    } catch (e: unknown) {
      ElMessage.error((e as { message?: string })?.message ?? '操作失败')
    } finally {
      jobTypeSubmitLoading.value = false
    }
  }

  async function removeJobType(row: ProcessTreeRow) {
    if (row.rowType !== 'job_type' || row.nodeId == null) return
    try {
      await ElMessageBox.confirm(`确定删除「${row.displayName}」？`, '提示', { type: 'warning' })
      await deleteSystemOption(row.nodeId)
      await refreshProcessJobTypeList()
      await loadProcessTreeRoots()
      ElMessage.success('已删除')
    } catch (e: unknown) {
      if ((e as string) !== 'cancel') ElMessage.error((e as { message?: string })?.message ?? '删除失败')
    }
  }

  async function moveJobTypeRow(row: ProcessTreeRow, delta: number) {
    if (row.rowType !== 'job_type' || row.nodeId == null) return
    const parentId = row.parentId ?? null
    const siblings = processJobTypeListRef.value.filter((item) => (item.parentId ?? null) === parentId).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    const idx = siblings.findIndex((item) => item.id === row.nodeId)
    const newIdx = idx + delta
    if (idx < 0 || newIdx < 0 || newIdx >= siblings.length) return
    const arr = [...siblings]
    ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
    await batchUpdateSystemOptionOrder('process_job_types', parentId, arr.map((item, index) => ({ id: item.id, sort_order: index })))
    await refreshProcessJobTypeList()
    await loadProcessTreeRoots()
  }

  const canMoveUpJobType = (row: ProcessTreeRow) => !!(row.rowType === 'job_type' && row.nodeId != null && processJobTypeListRef.value.filter((item) => (item.parentId ?? null) === (row.parentId ?? null)).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id).findIndex((item) => item.id === row.nodeId) > 0)
  const canMoveDownJobType = (row: ProcessTreeRow) => {
    if (row.rowType !== 'job_type' || row.nodeId == null) return false
    const siblings = processJobTypeListRef.value.filter((item) => (item.parentId ?? null) === (row.parentId ?? null)).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    const index = siblings.findIndex((item) => item.id === row.nodeId)
    return index >= 0 && index < siblings.length - 1
  }

  return {
    processTreeTableRef, processTreeData, expandedKeys, processDialog, processForm, processJobTypeOptions,
    jobTypeDialog, jobTypeForm, jobTypeSubmitLoading, loadProcessTreeRoots, loadProcessTreeNode, loadMoreProcesses,
    openProcessDialog, onProcessDepartmentChange, submitProcess, removeProcess, onProcessTreeExpandChange,
    ensureProcessJobTypeRoots, refreshProcessJobTypeList, openAddDepartment, openAddChildJobType,
    openEditJobType, submitJobType, removeJobType, moveJobTypeRow, canMoveUpJobType, canMoveDownJobType,
    jobTypeDialogTitle, jobTypeEditDepartmentOptions, onJobTypeDialogClose,
  }
}

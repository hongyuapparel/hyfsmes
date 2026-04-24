import { nextTick, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox, type TableInstance } from 'element-plus'
import {
  getSystemOptionsRoots,
  getSystemOptionsChildren,
  getSystemOptionsTree,
  createSystemOption,
  updateSystemOption,
  deleteSystemOption,
  batchUpdateSystemOptionOrder,
  type SystemOptionLazyNode,
  type SystemOptionTreeNode,
} from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const OPTION_TYPE = 'supplier_types'

export interface SupplierSettingsTreeRow extends SystemOptionLazyNode {
  level: number
  parentId?: number
  children?: SupplierSettingsTreeRow[]
}

export function useSupplierSettings() {
  const treeData = ref<SupplierSettingsTreeRow[]>([])
  const tableRef = ref<TableInstance | null>(null)
  const expandedIds = ref<Set<number>>(new Set())
  const dialogVisible = ref(false)
  const isEdit = ref(false)
  const editId = ref(0)
  const parentId = ref<number | null>(null)
  const addLevel = ref<0 | 1 | 2>(0)
  const form = ref({ value: '' })
  const submitLoading = ref(false)
  const editTree = ref<SystemOptionTreeNode[]>([])
  const editSupplierTypeId = ref<number | null>(null)
  const editParentGroupId = ref<number | null>(null)
  const editSupplierTypeOptions = ref<{ id: number; label: string }[]>([])
  const editParentGroupOptions = ref<{ id: number; label: string }[]>([])

  async function loadRoots() {
    try {
      const res = await getSystemOptionsRoots(OPTION_TYPE)
      const list = res.data ?? []
      treeData.value = list.map((o) => ({
        ...o,
        level: 0 as const,
        hasChildren: o.hasChildren,
      }))
    } catch {
      treeData.value = []
    }
  }

  function mapChildren(
    list: SystemOptionLazyNode[],
    parent: SupplierSettingsTreeRow,
  ): SupplierSettingsTreeRow[] {
    return list.map((o) => ({
      ...o,
      level: parent.level + 1,
      parentId: parent.id,
      hasChildren: o.hasChildren,
    }))
  }

  function getRowClassName({ row }: { row: SupplierSettingsTreeRow }) {
    return `row-level-${row.level}`
  }

  function isExpanded(id: number): boolean {
    return expandedIds.value.has(id)
  }

  function toggleScopeExpand(row: SupplierSettingsTreeRow) {
    const id = Number(row.id)
    const willExpand = !expandedIds.value.has(id)
    tableRef.value?.toggleRowExpansion(row, willExpand)
    if (willExpand) expandedIds.value.add(id)
    else expandedIds.value.delete(id)
  }

  function syncParentChildren(parent: SupplierSettingsTreeRow, list: SystemOptionLazyNode[]) {
    const rows = mapChildren(list, parent)
    parent.children = rows
    parent.hasChildren = rows.length > 0
    ;(
      tableRef.value as TableInstance & {
        updateKeyChildren?: (key: number, rows: SupplierSettingsTreeRow[]) => void
      }
    )?.updateKeyChildren?.(parent.id, rows)
    treeData.value = [...treeData.value]
  }

  async function loadChildren(
    row: SupplierSettingsTreeRow,
    _treeNode: { level: number; expanded: boolean },
    resolve: (rows: SupplierSettingsTreeRow[]) => void,
  ) {
    if (row.level >= 2) {
      resolve([])
      return
    }
    try {
      const res = await getSystemOptionsChildren(OPTION_TYPE, row.id)
      const list = res.data ?? []
      const rows = mapChildren(list, row)
      row.children = rows
      row.hasChildren = rows.length > 0
      resolve(rows)
    } catch {
      resolve([])
    }
  }

  function findNodeById(
    id: number,
    nodes: SupplierSettingsTreeRow[] = treeData.value,
  ): SupplierSettingsTreeRow | undefined {
    for (const node of nodes) {
      if (node.id === id) return node
      if (node.children?.length) {
        const found = findNodeById(id, node.children)
        if (found) return found
      }
    }
    return undefined
  }

  function getSiblings(row: SupplierSettingsTreeRow): SupplierSettingsTreeRow[] {
    if (row.level === 0) {
      return [...treeData.value].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    }
    const parent = row.parentId != null ? findNodeById(row.parentId) : undefined
    const list = parent?.children ?? []
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  }

  function canMoveUp(row: SupplierSettingsTreeRow): boolean {
    const siblings = getSiblings(row)
    const idx = siblings.findIndex((s) => Number(s.id) === Number(row.id))
    return idx > 0
  }

  function canMoveDown(row: SupplierSettingsTreeRow): boolean {
    const siblings = getSiblings(row)
    const idx = siblings.findIndex((s) => Number(s.id) === Number(row.id))
    return idx >= 0 && idx < siblings.length - 1
  }

  function getAddLabel() {
    if (addLevel.value === 0) return '供应商类型'
    if (addLevel.value === 1) return '父分组'
    return '子分组'
  }

  function getAddTitle() {
    if (addLevel.value === 0) return '添加供应商类型'
    if (addLevel.value === 1) return '添加父分组'
    return '添加子分组'
  }

  function normalizeValue(v: string): string {
    return v.trim()
  }

  function findRootIdByTargetId(nodes: SystemOptionTreeNode[], targetId: number): number | null {
    for (const root of nodes) {
      if (root.id === targetId) return root.id
      const stack = [...(root.children ?? [])]
      while (stack.length) {
        const cur = stack.shift()
        if (!cur) continue
        if (cur.id === targetId) return root.id
        if (cur.children?.length) stack.unshift(...cur.children)
      }
    }
    return null
  }

  function findNodeByIdInTree(
    nodes: SystemOptionTreeNode[],
    targetId: number,
  ): SystemOptionTreeNode | null {
    const stack = [...nodes]
    while (stack.length) {
      const cur = stack.shift()
      if (!cur) continue
      if (cur.id === targetId) return cur
      if (cur.children?.length) stack.unshift(...cur.children)
    }
    return null
  }

  function collectNodeAndDescendantIds(node: SystemOptionTreeNode): Set<number> {
    const set = new Set<number>()
    const stack = [node]
    while (stack.length) {
      const cur = stack.shift()
      if (!cur) continue
      set.add(cur.id)
      if (cur.children?.length) stack.unshift(...cur.children)
    }
    return set
  }

  function buildEditParentGroupOptions() {
    const rootId = editSupplierTypeId.value
    if (rootId == null) {
      editParentGroupOptions.value = []
      editParentGroupId.value = null
      return
    }
    const root = editTree.value.find((n) => n.id === rootId)
    const level1 = root?.children ?? []
    const editingNode = findNodeByIdInTree(editTree.value, editId.value)
    const blockedIds = editingNode ? collectNodeAndDescendantIds(editingNode) : new Set<number>()
    const options = level1
      .filter((n) => !blockedIds.has(n.id))
      .map((n) => ({ id: n.id, label: n.value }))
    editParentGroupOptions.value = options
    if (
      editParentGroupId.value != null &&
      !options.some((o) => o.id === editParentGroupId.value)
    ) {
      editParentGroupId.value = null
    }
  }

  function onEditSupplierTypeChange() {
    editParentGroupId.value = null
    buildEditParentGroupOptions()
  }

  function onDialogClose() {
    form.value = { value: '' }
    editSupplierTypeId.value = null
    editParentGroupId.value = null
    editSupplierTypeOptions.value = []
    editParentGroupOptions.value = []
    editTree.value = []
  }

  async function reloadSupplierTree(options?: { anchorIds?: number[] }) {
    const anchorIds = options?.anchorIds ?? []
    const keepExpanded = new Set<number>([
      ...expandedIds.value,
      ...anchorIds.filter((n) => !Number.isNaN(n)),
    ])
    const tableWrap = tableRef.value?.$el?.querySelector?.(
      '.el-scrollbar__wrap',
    ) as HTMLElement | undefined
    const prevScrollTop = tableWrap?.scrollTop ?? 0

    await loadRoots()
    await nextTick()

    const nextExpanded = new Set<number>()

    for (const id of keepExpanded) {
      const rootRow = findNodeById(id)
      if (!rootRow || rootRow.level !== 0) continue
      tableRef.value?.toggleRowExpansion(rootRow, true)
      nextExpanded.add(Number(rootRow.id))
      const res = await getSystemOptionsChildren(OPTION_TYPE, rootRow.id)
      syncParentChildren(rootRow, res.data ?? [])
    }

    for (const id of keepExpanded) {
      const row = findNodeById(id)
      if (!row || row.level !== 1 || !row.hasChildren) continue
      const parent = row.parentId != null ? findNodeById(row.parentId) : null
      if (parent) {
        tableRef.value?.toggleRowExpansion(parent, true)
        nextExpanded.add(Number(parent.id))
        if (!parent.children?.length) {
          const parentRes = await getSystemOptionsChildren(OPTION_TYPE, parent.id)
          syncParentChildren(parent, parentRes.data ?? [])
        }
      }
      tableRef.value?.toggleRowExpansion(row, true)
      nextExpanded.add(Number(row.id))
      const childRes = await getSystemOptionsChildren(OPTION_TYPE, row.id)
      syncParentChildren(row, childRes.data ?? [])
    }

    expandedIds.value = nextExpanded
    await nextTick()
    if (tableWrap) tableWrap.scrollTop = prevScrollTop
  }

  function collectDescendants(nodes: SystemOptionTreeNode[]): SystemOptionTreeNode[] {
    const out: SystemOptionTreeNode[] = []
    const stack = [...nodes]
    while (stack.length) {
      const cur = stack.shift()
      if (!cur) continue
      out.push(cur)
      if (cur.children?.length) stack.unshift(...cur.children)
    }
    return out
  }

  async function validateNoDuplicate(val: string, targetRootId?: number): Promise<boolean> {
    const value = normalizeValue(val)
    const res = await getSystemOptionsTree(OPTION_TYPE)
    const tree = res.data ?? []
    const editingId = isEdit.value ? editId.value : null

    if ((parentId.value == null && !isEdit.value) || (isEdit.value && addLevel.value === 0)) {
      const existed = tree.some((root) => root.value.trim() === value && root.id !== editingId)
      if (existed) {
        ElMessage.warning('供应商类型名称不能重复')
        return false
      }
      return true
    }

    let rootId: number | null = null
    if (targetRootId != null) {
      rootId = targetRootId
    } else if (isEdit.value && editingId != null) {
      rootId = findRootIdByTargetId(tree, editingId)
    } else if (parentId.value != null) {
      rootId = findRootIdByTargetId(tree, parentId.value)
    }
    if (rootId == null) return true

    const root = tree.find((r) => r.id === rootId)
    if (!root) return true
    const descendants = collectDescendants(root.children ?? [])
    const existed = descendants.some((n) => n.value.trim() === value && n.id !== editingId)
    if (existed) {
      ElMessage.warning('同一供应商类型下业务范围名称不能重复')
      return false
    }
    return true
  }

  function openAdd(pid: number | null, parentLevel?: number) {
    isEdit.value = false
    editId.value = 0
    parentId.value = pid
    addLevel.value = pid == null ? 0 : ((parentLevel ?? 0) + 1 as 1 | 2)
    form.value = { value: '' }
    editSupplierTypeId.value = null
    editParentGroupId.value = null
    editSupplierTypeOptions.value = []
    editParentGroupOptions.value = []
    dialogVisible.value = true
  }

  async function openEdit(row: SupplierSettingsTreeRow) {
    isEdit.value = true
    editId.value = row.id
    addLevel.value = row.level as 0 | 1 | 2
    parentId.value = null
    form.value = { value: row.value }
    if (row.level > 0) {
      try {
        const res = await getSystemOptionsTree(OPTION_TYPE)
        editTree.value = res.data ?? []
        editSupplierTypeOptions.value = editTree.value.map((r) => ({ id: r.id, label: r.value }))
        const rootId = findRootIdByTargetId(editTree.value, row.id)
        editSupplierTypeId.value = rootId
        const currentNode = findNodeByIdInTree(editTree.value, row.id)
        if (rootId != null && currentNode?.parentId != null && currentNode.parentId !== rootId) {
          editParentGroupId.value = currentNode.parentId
        } else {
          editParentGroupId.value = null
        }
        buildEditParentGroupOptions()
      } catch {
        editTree.value = []
        editSupplierTypeOptions.value = []
        editParentGroupOptions.value = []
        editSupplierTypeId.value = null
        editParentGroupId.value = null
      }
    }
    dialogVisible.value = true
  }

  async function submit() {
    const val = form.value.value?.trim()
    const label = getAddLabel()
    if (!val) {
      ElMessage.warning(`请输入${label}`)
      return
    }
    if (isEdit.value && addLevel.value > 0 && editSupplierTypeId.value == null) {
      ElMessage.warning('请选择供应商类型')
      return
    }
    if (isEdit.value && addLevel.value === 1 && editParentGroupId.value != null) {
      const target = findNodeById(editId.value)
      if (target?.children?.length) {
        ElMessage.warning('该父分组下已有子分组，暂不支持直接挂到其他父分组下')
        return
      }
    }
    const ok = await validateNoDuplicate(
      val,
      isEdit.value && addLevel.value > 0 ? (editSupplierTypeId.value ?? undefined) : undefined,
    )
    if (!ok) return
    submitLoading.value = true
    try {
      let editedNextParentId: number | null | undefined
      let successText = ''
      if (isEdit.value) {
        const nextParentId =
          addLevel.value > 0 ? (editParentGroupId.value ?? editSupplierTypeId.value ?? null) : undefined
        editedNextParentId = nextParentId
        await updateSystemOption(editId.value, {
          value: val,
          parent_id: nextParentId,
        })
        successText = '保存成功'
      } else {
        let sortOrder: number
        if (parentId.value != null) {
          const res = await getSystemOptionsChildren(OPTION_TYPE, parentId.value)
          sortOrder = (res.data ?? []).length
        } else {
          sortOrder = treeData.value.length
        }
        await createSystemOption({
          type: OPTION_TYPE,
          value: val,
          sort_order: sortOrder,
          parent_id: parentId.value ?? undefined,
        })
        successText = '添加成功'
      }

      const anchors: number[] = []
      if (isEdit.value) {
        if (editSupplierTypeId.value != null) anchors.push(editSupplierTypeId.value)
        if (editedNextParentId != null) anchors.push(editedNextParentId)
      } else if (parentId.value != null) {
        anchors.push(parentId.value)
      }
      await reloadSupplierTree({ anchorIds: anchors })
      await nextTick()
      dialogVisible.value = false
      ElMessage.success(successText)
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      submitLoading.value = false
    }
  }

  async function remove(row: SupplierSettingsTreeRow) {
    try {
      await ElMessageBox.confirm(`确定删除「${row.value}」？`, '提示', { type: 'warning' })
    } catch {
      return
    }
    try {
      await deleteSystemOption(row.id)
      const anchors: number[] = []
      if (row.parentId != null) anchors.push(row.parentId)
      await reloadSupplierTree({ anchorIds: anchors })
      await nextTick()
      ElMessage.success('已删除')
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    }
  }

  async function moveRow(row: SupplierSettingsTreeRow, delta: number) {
    const siblings = getSiblings(row)
    const idx = siblings.findIndex((s) => Number(s.id) === Number(row.id))
    if (idx < 0) return
    const newIdx = idx + delta
    if (newIdx < 0 || newIdx >= siblings.length) return
    const arr = [...siblings]
    ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
    const items = arr.map((n, i) => ({ id: n.id, sort_order: i }))
    const pid = row.level === 0 ? null : row.parentId ?? null
    try {
      await batchUpdateSystemOptionOrder(OPTION_TYPE, pid, items)
      const anchors: number[] = []
      if (row.level === 0) anchors.push(row.id)
      if (row.parentId != null) anchors.push(row.parentId)
      await reloadSupplierTree({ anchorIds: anchors })
      await nextTick()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    }
  }

  onMounted(() => {
    void loadRoots()
  })

  return {
    treeData,
    tableRef,
    dialogVisible,
    isEdit,
    addLevel,
    form,
    submitLoading,
    editSupplierTypeId,
    editParentGroupId,
    editSupplierTypeOptions,
    editParentGroupOptions,
    loadChildren,
    getRowClassName,
    isExpanded,
    toggleScopeExpand,
    canMoveUp,
    canMoveDown,
    getAddLabel,
    getAddTitle,
    onEditSupplierTypeChange,
    onDialogClose,
    openAdd,
    openEdit,
    submit,
    remove,
    moveRow,
  }
}

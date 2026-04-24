import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getSystemOptionsTree,
  getSystemOptionsList,
  createSystemOption,
  updateSystemOption,
  deleteSystemOption,
  batchUpdateSystemOptionOrder,
  type SystemOptionTreeNode,
  type SystemOptionItem,
} from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const ORG_DEPT_TYPE = 'org_departments'
const ORG_JOB_TYPE = 'org_jobs'

export interface HrDeptTreeNode {
  id: number
  label: string
  sortOrder: number
  parentId: number | null
  children?: HrDeptTreeNode[]
}

export interface HrJobItem {
  id: number
  label: string
  sortOrder: number
  parentId: number
  description?: string
}

export function useHrSettings() {
  const deptLoading = ref(false)
  const jobLoading = ref(false)
  const deptTree = ref<HrDeptTreeNode[]>([])
  const currentDept = ref<HrDeptTreeNode | null>(null)
  const jobList = ref<HrJobItem[]>([])

  const deptDialog = reactive({
    visible: false,
    submitting: false,
    editingId: 0,
    parentId: null as number | null,
  })
  const deptForm = reactive({ label: '' })
  const deptDialogTitle = computed(() =>
    deptDialog.editingId ? '编辑部门' : deptDialog.parentId ? '新增子部门' : '新增顶级部门',
  )
  const dragEnabledDeptId = ref<number | null>(null)
  const deptCount = computed(() => {
    function count(nodes: HrDeptTreeNode[]): number {
      return nodes.reduce((sum, n) => sum + 1 + count(n.children ?? []), 0)
    }
    return count(deptTree.value)
  })

  const jobDialog = reactive({ visible: false, submitting: false, editingId: 0 })
  const jobForm = reactive({ label: '', description: '' })
  const jobDialogTitle = computed(() => (jobDialog.editingId ? '编辑岗位' : '新增岗位'))

  function findDeptById(id: number, tree: HrDeptTreeNode[]): HrDeptTreeNode | null {
    for (const n of tree) {
      if (n.id === id) return n
      if (n.children?.length) {
        const found = findDeptById(id, n.children)
        if (found) return found
      }
    }
    return null
  }

  async function loadDepartments() {
    deptLoading.value = true
    try {
      const res = await getSystemOptionsTree(ORG_DEPT_TYPE)
      const data = (res.data ?? []) as SystemOptionTreeNode[]
      const convert = (nodes: SystemOptionTreeNode[]): HrDeptTreeNode[] =>
        nodes.map((n) => ({
          id: n.id,
          label: n.value,
          sortOrder: n.sortOrder,
          parentId: n.parentId ?? null,
          children: n.children ? convert(n.children) : [],
        }))
      deptTree.value = convert(data)
      if (currentDept.value) {
        const found = findDeptById(currentDept.value.id, deptTree.value)
        currentDept.value = found ?? null
      }
    } catch (e: unknown) {
      deptTree.value = []
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      deptLoading.value = false
    }
  }

  function isDescendantOf(node: HrDeptTreeNode, maybeAncestorId: number): boolean {
    if (node.id === maybeAncestorId) return true
    if (!node.children?.length) return false
    return node.children.some((c) => isDescendantOf(c, maybeAncestorId))
  }

  function allowDeptDrop(
    draggingNode: { data: HrDeptTreeNode },
    dropNode: { data: HrDeptTreeNode },
    type: 'prev' | 'next' | 'inner',
  ) {
    if (type !== 'inner') return true
    return !isDescendantOf(draggingNode.data, dropNode.data.id)
  }

  function allowDeptDrag(node: { data?: HrDeptTreeNode }) {
    return dragEnabledDeptId.value != null && dragEnabledDeptId.value === (node.data?.id ?? null)
  }

  function enableDeptDrag(id: number) {
    dragEnabledDeptId.value = id
  }

  function onDeptDragEnd() {
    dragEnabledDeptId.value = null
  }

  function getSiblingNodes(parentId: number | null): HrDeptTreeNode[] {
    if (parentId == null) return deptTree.value
    const parent = findDeptById(parentId, deptTree.value)
    return parent?.children ?? []
  }

  async function syncSiblingOrder(parentId: number | null) {
    const siblings = getSiblingNodes(parentId)
    const items = siblings.map((n, idx) => ({ id: n.id, sort_order: idx }))
    await batchUpdateSystemOptionOrder(ORG_DEPT_TYPE, parentId, items)
  }

  async function onDeptDrop(
    draggingNode: { data: HrDeptTreeNode },
    dropNode: { data: HrDeptTreeNode; parent?: { data?: HrDeptTreeNode } },
    dropType: 'before' | 'after' | 'inner',
  ) {
    const dragged = draggingNode.data
    const oldParentId = dragged.parentId ?? null
    const newParentId = dropType === 'inner' ? dropNode.data.id : (dropNode.parent?.data?.id ?? null)

    try {
      if (oldParentId !== newParentId) {
        await updateSystemOption(dragged.id, { parent_id: newParentId })
        dragged.parentId = newParentId
      }
      await syncSiblingOrder(newParentId)
      if (oldParentId !== newParentId) await syncSiblingOrder(oldParentId)
      ElMessage.success('部门顺序已更新')
      await loadDepartments()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
      await loadDepartments()
    }
  }

  function onDeptChange(node: HrDeptTreeNode | null) {
    currentDept.value = node
    if (node) {
      void loadJobs(node.id)
    } else {
      jobList.value = []
    }
  }

  async function loadJobs(deptId: number) {
    jobLoading.value = true
    try {
      const res = await getSystemOptionsList(ORG_JOB_TYPE)
      const all = (res.data ?? []) as SystemOptionItem[]
      jobList.value = all
        .filter((j) => j.parentId === deptId)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
        .map((j) => ({
          id: j.id,
          label: j.value,
          sortOrder: j.sortOrder,
          parentId: j.parentId as number,
          description: j.remark,
        }))
    } catch (e: unknown) {
      jobList.value = []
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      jobLoading.value = false
    }
  }

  function openDeptDialog(node: HrDeptTreeNode | null) {
    if (node) {
      deptDialog.editingId = node.id
      deptDialog.parentId = null
      deptForm.label = node.label
    } else {
      deptDialog.editingId = 0
      deptDialog.parentId = currentDept.value ? currentDept.value.id : null
      deptForm.label = ''
    }
    deptDialog.visible = true
  }

  function openAddChildDept() {
    if (!currentDept.value) return
    deptDialog.editingId = 0
    deptDialog.parentId = currentDept.value.id
    deptForm.label = ''
    deptDialog.visible = true
  }

  function resetDeptDialog() {
    deptDialog.editingId = 0
    deptDialog.parentId = null
    deptForm.label = ''
  }

  async function submitDept() {
    const label = deptForm.label?.trim()
    if (!label) {
      ElMessage.warning('请输入部门名称')
      return
    }
    deptDialog.submitting = true
    try {
      if (deptDialog.editingId) {
        await updateSystemOption(deptDialog.editingId, { value: label })
        ElMessage.success('保存成功')
      } else {
        await createSystemOption({
          type: ORG_DEPT_TYPE,
          value: label,
          parent_id: deptDialog.parentId ?? undefined,
        })
        ElMessage.success('新增成功')
      }
      deptDialog.visible = false
      await loadDepartments()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      deptDialog.submitting = false
    }
  }

  async function removeDept(node: HrDeptTreeNode) {
    try {
      await ElMessageBox.confirm(
        node.children?.length
          ? `确定删除部门「${node.label}」及其所有子部门？`
          : `确定删除部门「${node.label}」？`,
        '提示',
        { type: 'warning' },
      )
    } catch {
      return
    }
    try {
      await deleteSystemOption(node.id)
      if (currentDept.value?.id === node.id) {
        currentDept.value = null
        jobList.value = []
      }
      await loadDepartments()
      ElMessage.success('已删除')
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    }
  }

  function openJobDialog(row: HrJobItem | null) {
    if (!currentDept.value) {
      ElMessage.warning('请先选择部门')
      return
    }
    if (row) {
      jobDialog.editingId = row.id
      jobForm.label = row.label
      jobForm.description = row.description ?? ''
    } else {
      jobDialog.editingId = 0
      jobForm.label = ''
      jobForm.description = ''
    }
    jobDialog.visible = true
  }

  function resetJobDialog() {
    jobDialog.editingId = 0
    jobForm.label = ''
    jobForm.description = ''
  }

  async function submitJob() {
    if (!currentDept.value) {
      ElMessage.warning('请先选择部门')
      return
    }
    const label = jobForm.label?.trim()
    if (!label) {
      ElMessage.warning('请输入岗位名称')
      return
    }
    jobDialog.submitting = true
    try {
      if (jobDialog.editingId) {
        await updateSystemOption(jobDialog.editingId, {
          value: label,
          remark: jobForm.description || undefined,
        })
        ElMessage.success('保存成功')
      } else {
        const sortOrder = jobList.value.length
        await createSystemOption({
          type: ORG_JOB_TYPE,
          value: label,
          parent_id: currentDept.value.id,
          sort_order: sortOrder,
          remark: jobForm.description || undefined,
        })
        ElMessage.success('新增成功')
      }
      jobDialog.visible = false
      await loadJobs(currentDept.value.id)
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      jobDialog.submitting = false
    }
  }

  async function removeJob(row: HrJobItem) {
    try {
      await ElMessageBox.confirm(`确定删除岗位「${row.label}」？`, '提示', { type: 'warning' })
    } catch {
      return
    }
    try {
      await deleteSystemOption(row.id)
      if (currentDept.value) await loadJobs(currentDept.value.id)
      ElMessage.success('已删除')
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    }
  }

  onMounted(() => {
    void loadDepartments()
  })

  return {
    deptLoading,
    jobLoading,
    deptTree,
    currentDept,
    jobList,
    deptDialog,
    deptForm,
    deptDialogTitle,
    deptCount,
    jobDialog,
    jobForm,
    jobDialogTitle,
    allowDeptDrop,
    allowDeptDrag,
    enableDeptDrag,
    onDeptDragEnd,
    onDeptDrop,
    onDeptChange,
    openDeptDialog,
    openAddChildDept,
    resetDeptDialog,
    submitDept,
    removeDept,
    openJobDialog,
    resetJobDialog,
    submitJob,
    removeJob,
  }
}

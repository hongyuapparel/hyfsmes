import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import { getEmployeeList, deleteEmployee, getHrUserOptions, type EmployeeItem, type HrUserOption } from '@/api/hr'
import { getDictItems, getDictTree } from '@/api/dicts'
import type { SystemOptionTreeNode, SystemOptionItem } from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { ACTIVE_FILTER_COLOR } from '@/composables/useFilterBarHelpers'
import { formatDate } from '@/utils/date-format'
import { rangeShortcuts } from '@/utils/date-shortcuts'

const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14

export function getFilterSelectAutoWidthStyle(labelText: string) {
  if (!labelText) return undefined
  const estimated = labelText.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px`, color: ACTIVE_FILTER_COLOR }
}

export function statusLabel(s: string) {
  return s === 'left' ? '离职' : '在职'
}

export function genderLabel(g: string) {
  if (g === 'male') return '男'
  if (g === 'female') return '女'
  return '-'
}

export interface DeptOption { id: number; label: string }
export interface DeptTreeOption extends DeptOption { children?: DeptTreeOption[] }
export interface JobOption { id: number; label: string; parentId: number | null }

export function useHrEmployeeList() {
  const filter = reactive({
    name: '',
    departmentId: null as number | null,
    status: '',
    entryDateRange: [] as string[],
    leaveDateRange: [] as string[],
  })
  const nameLabelVisible = ref(false)
  const hrDateRangeShortcuts = [
    ...rangeShortcuts.filter((x) => ['本月', '本季度', '本年度'].includes(x.text)),
    {
      text: '上年度',
      value: () => {
        const now = new Date()
        const y = now.getFullYear() - 1
        return [new Date(y, 0, 1), new Date(y, 11, 31, 23, 59, 59, 999)] as [Date, Date]
      },
    },
  ]

  const list = ref<EmployeeItem[]>([])
  const selectedIds = ref<number[]>([])
  const loading = ref(false)
  const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
  const sortState = reactive<{
    sortBy: '' | 'sortOrder' | 'name' | 'entryDate' | 'status'
    sortOrder: '' | 'asc' | 'desc'
  }>({ sortBy: '', sortOrder: '' })

  const flatDepartments = ref<DeptOption[]>([])
  const departmentTreeOptions = ref<DeptTreeOption[]>([])
  const allJobs = ref<JobOption[]>([])
  const userOptions = ref<HrUserOption[]>([])

  async function loadDepartments() {
    try {
      const tree = ((await getDictTree('org_departments')).data ?? []) as SystemOptionTreeNode[]
      const toTree = (nodes: SystemOptionTreeNode[]): DeptTreeOption[] =>
        nodes.map((n) => ({ id: n.id, label: n.value, children: n.children?.length ? toTree(n.children) : undefined }))
      departmentTreeOptions.value = toTree(tree)
      const out: DeptOption[] = []
      const visit = (nodes: SystemOptionTreeNode[]) => {
        for (const n of nodes) { out.push({ id: n.id, label: n.value }); if (n.children?.length) visit(n.children) }
      }
      visit(tree)
      flatDepartments.value = out
    } catch { departmentTreeOptions.value = []; flatDepartments.value = [] }
  }

  async function loadJobs() {
    try {
      allJobs.value = (((await getDictItems('org_jobs')).data ?? []) as SystemOptionItem[])
        .map((j) => ({ id: j.id, label: j.value, parentId: j.parentId ?? null }))
    } catch { allJobs.value = [] }
  }

  async function loadUsers() {
    try {
      const res = await getHrUserOptions()
      userOptions.value = (res.data ?? []) as HrUserOption[]
    } catch {
      userOptions.value = []
    }
  }

  function getDepartmentLabel(id: number | null): string {
    if (id == null) return ''
    return flatDepartments.value.find((d) => d.id === id)?.label ?? ''
  }

  function getRowIndex(id: number): number {
    const idx = list.value.findIndex((x) => x.id === id)
    return idx >= 0 ? (pagination.page - 1) * pagination.pageSize + idx + 1 : 1
  }

  async function load() {
    loading.value = true
    try {
      const res = await getEmployeeList({
        name: filter.name || undefined,
        departmentId: filter.departmentId || undefined,
        status: filter.status || undefined,
        entryDateStart: filter.entryDateRange?.[0] || undefined,
        entryDateEnd: filter.entryDateRange?.[1] || undefined,
        leaveDateStart: filter.leaveDateRange?.[0] || undefined,
        leaveDateEnd: filter.leaveDateRange?.[1] || undefined,
        sortBy: sortState.sortBy || undefined,
        sortOrder: sortState.sortOrder || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
      })
      if (res.data) {
        list.value = res.data.list ?? []
        pagination.total = res.data.total ?? 0
        selectedIds.value = []
      }
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      loading.value = false
    }
  }

  function onSearch(byUser = false) {
    if (byUser && String(filter.name || '').trim()) nameLabelVisible.value = true
    pagination.page = 1
    load()
  }

  let searchTimer: ReturnType<typeof setTimeout> | null = null
  function debouncedSearch() {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => { searchTimer = null; onSearch(false) }, 400)
  }

  function onReset() {
    nameLabelVisible.value = false
    Object.assign(filter, { name: '', departmentId: null, status: '', entryDateRange: [], leaveDateRange: [] })
    sortState.sortBy = ''
    sortState.sortOrder = ''
    pagination.page = 1
    load()
  }

  function onSortChange(payload: { prop: string; order: 'ascending' | 'descending' | null }) {
    const map: Record<string, 'sortOrder' | 'name' | 'entryDate' | 'status'> = {
      sortOrder: 'sortOrder', name: 'name', entryDate: 'entryDate', status: 'status',
    }
    const nextSortBy = map[payload.prop] ?? ''
    if (!nextSortBy || !payload.order) {
      sortState.sortBy = ''; sortState.sortOrder = ''
    } else {
      sortState.sortBy = nextSortBy
      sortState.sortOrder = payload.order === 'descending' ? 'desc' : 'asc'
    }
    pagination.page = 1
    load()
  }

  function onPageSizeChange() { pagination.page = 1; load() }
  function onSelectionChange(rows: EmployeeItem[]) { selectedIds.value = rows.map((r) => r.id) }

  async function onBatchDelete() {
    if (!selectedIds.value.length) return
    try {
      await ElMessageBox.confirm(
        `确定删除已选 ${selectedIds.value.length} 条人员档案？`,
        '提示',
        { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
      )
      for (const id of selectedIds.value) await deleteEmployee(id)
      ElMessage.success('批量删除成功')
      load()
    } catch (e: unknown) {
      if (e !== 'cancel' && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    }
  }

  async function onExport() {
    try {
      const res = await getEmployeeList({
        name: filter.name || undefined,
        departmentId: filter.departmentId || undefined,
        status: filter.status || undefined,
        entryDateStart: filter.entryDateRange?.[0] || undefined,
        entryDateEnd: filter.entryDateRange?.[1] || undefined,
        leaveDateStart: filter.leaveDateRange?.[0] || undefined,
        leaveDateEnd: filter.leaveDateRange?.[1] || undefined,
        page: 1,
        pageSize: 5000,
      })
      const rows = res.data?.list ?? []
      const lines = rows.map((r, idx) => ({
        序号: idx + 1, 姓名: r.name || '', 性别: genderLabel(r.gender), 部门: r.departmentName || '',
        岗位: r.jobTitleName || '', 入职日期: formatDate(r.entryDate), 学历: r.education || '',
        宿舍: r.dormitory || '', 联系电话: r.contactPhone || '', 身份证号码: r.idCardNo || '',
        籍贯: r.nativePlace || '', 家庭地址: r.homeAddress || '', 紧急联系人: r.emergencyContact || '',
        紧急联系电话: r.emergencyPhone || '', 离职日期: formatDate(r.leaveDate),
        离职原因: r.leaveReason || '', 备注: r.remark || '',
      }))
      const ws = XLSX.utils.json_to_sheet(lines)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '人事管理')
      XLSX.writeFile(wb, `人事管理导出_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    }
  }

  return {
    filter, nameLabelVisible, hrDateRangeShortcuts, list, selectedIds, loading,
    pagination, sortState, departmentTreeOptions, flatDepartments, allJobs, userOptions,
    load, loadDepartments, loadJobs, loadUsers, getDepartmentLabel, getRowIndex,
    onSearch, debouncedSearch, onReset, onSortChange, onPageSizeChange,
    onSelectionChange, onBatchDelete, onExport,
  }
}

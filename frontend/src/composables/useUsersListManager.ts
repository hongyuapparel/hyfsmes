import { ref, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { searchUsers, updateUser, type UserItem } from '@/api/users'
import { getRoles, type RoleItem } from '@/api/roles'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'

/** 与 useTableColumnWidthPersist 内部 TableLike 兼容的公开类型 */
export type TableRef = {
  columns?: { property?: string; columnKey?: string; label?: string; width?: number | string; realWidth?: number }[]
  doLayout?: () => void
  $el?: HTMLElement
} | null | undefined

const USER_ROW_ORDER_STORAGE_KEY = 'settings-users-row-order-v1'

function persistRowOrder(rows: UserItem[]): void {
  const ids = rows.map((x) => Number(x.id)).filter((id) => Number.isInteger(id) && id > 0)
  try {
    localStorage.setItem(USER_ROW_ORDER_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // 忽略本地存储异常
  }
}

function readStoredRowOrder(): number[] {
  try {
    const raw = localStorage.getItem(USER_ROW_ORDER_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return (parsed as unknown[]).map((x) => Number(x)).filter((id) => Number.isInteger(id) && id > 0)
  } catch {
    return []
  }
}

function applyStoredRowOrder(rows: UserItem[]): UserItem[] {
  if (!rows.length) return rows
  const stored = readStoredRowOrder()
  if (!stored.length) return rows
  const byId = new Map(rows.map((x) => [x.id, x]))
  const ordered: UserItem[] = []
  for (const id of stored) {
    const row = byId.get(id)
    if (row) ordered.push(row)
  }
  for (const row of rows) {
    if (!stored.includes(row.id)) ordered.push(row)
  }
  return ordered
}

export function useUsersListManager() {
  const list = ref<UserItem[]>([])
  const roles = ref<RoleItem[]>([])
  const filter = ref<{ keyword: string; role: string }>({ keyword: '', role: '' })
  const keywordLabelVisible = ref(false)

  const { onHeaderDragEnd, restoreColumnWidths } = useTableColumnWidthPersist('settings-users-main')

  function getRowIndex(id: number): number {
    const idx = list.value.findIndex((x) => x.id === id)
    return idx >= 0 ? idx + 1 : 1
  }

  function applySortIndex(id: number, value: number | string | undefined): void {
    const to = Number(value)
    if (!Number.isFinite(to)) return
    const fromIdx = list.value.findIndex((x) => x.id === id)
    if (fromIdx < 0) return
    const targetIdx = Math.max(0, Math.min(list.value.length - 1, Math.floor(to) - 1))
    if (fromIdx === targetIdx) return
    const rows = list.value.slice()
    const [moved] = rows.splice(fromIdx, 1)
    if (!moved) return
    rows.splice(targetIdx, 0, moved)
    list.value = rows
    persistRowOrder(rows)
  }

  function getRoleNames(row: UserItem): string {
    if (row.roleNames?.length) return row.roleNames.join('、')
    if (row.roles?.length) return row.roles.map((x) => x.name).join('、')
    return row.role?.name ?? '-'
  }

  async function onSearch(): Promise<void> {
    try {
      if (filter.value.keyword && String(filter.value.keyword).trim()) {
        keywordLabelVisible.value = true
      }
      const kw = filter.value.keyword?.trim()
      const role = filter.value.role?.trim()
      const res = await searchUsers({ keyword: kw || undefined, role: role || undefined })
      list.value = applyStoredRowOrder(res.data ?? [])
    } catch (e: unknown) {
      list.value = []
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    }
  }

  async function onReset(): Promise<void> {
    filter.value = { keyword: '', role: '' }
    keywordLabelVisible.value = false
    await onSearch()
  }

  async function loadRoles(): Promise<void> {
    const res = await getRoles()
    roles.value = res.data ?? []
  }

  async function load(tableRef: TableRef): Promise<void> {
    await loadRoles()
    await onSearch()
    await nextTick()
    restoreColumnWidths(tableRef)
  }

  async function toggleStatus(row: UserItem, tableRef: TableRef): Promise<void> {
    const newStatus = row.status === 'active' ? 'disabled' : 'active'
    try {
      await updateUser(row.id, { status: newStatus })
      ElMessage.success('已更新')
      await load(tableRef)
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    }
  }

  return {
    list,
    roles,
    filter,
    keywordLabelVisible,
    onHeaderDragEnd,
    getRowIndex,
    applySortIndex,
    getRoleNames,
    load,
    onSearch,
    onReset,
    toggleStatus,
  }
}

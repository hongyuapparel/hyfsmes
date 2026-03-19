import { nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

type ColumnLike = {
  property?: string
  columnKey?: string
  label?: string
  width?: number | string
  realWidth?: number
}

function toNumberWidth(v: unknown): number | null {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n < 40) return null
  return Math.round(n)
}

function buildColumnKey(col: ColumnLike | null | undefined): string {
  if (!col) return ''
  const prop = String(col.property ?? '').trim()
  if (prop) return `prop:${prop}`
  const colKey = String(col.columnKey ?? '').trim()
  if (colKey) return `key:${colKey}`
  const label = String(col.label ?? '').trim()
  if (label) return `label:${label}`
  return ''
}

export function useTableColumnWidthPersist(tableId: string) {
  const route = useRoute()
  const authStore = useAuthStore()

  const getStorageKey = () => {
    const user = authStore.user as any
    const userPart = String(user?.id ?? user?.username ?? 'anonymous').trim() || 'anonymous'
    const routePart = String(route.path ?? '').trim() || 'unknown-route'
    const tablePart = String(tableId ?? '').trim() || 'unknown-table'
    return `hyf:table-width:v1:${userPart}:${routePart}:${tablePart}`
  }

  const readMap = (): Record<string, number> => {
    try {
      const raw = localStorage.getItem(getStorageKey())
      if (!raw) return {}
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const map: Record<string, number> = {}
      Object.keys(parsed || {}).forEach((k) => {
        const w = toNumberWidth(parsed[k])
        if (w != null) map[k] = w
      })
      return map
    } catch {
      return {}
    }
  }

  const writeMap = (map: Record<string, number>) => {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(map))
    } catch {
      // ignore storage errors
    }
  }

  const onHeaderDragEnd = (newWidth: number, _oldWidth: number, column: ColumnLike) => {
    const key = buildColumnKey(column)
    const width = toNumberWidth(newWidth)
    if (!key || width == null) return
    const map = readMap()
    map[key] = width
    writeMap(map)
  }

  const applyToTable = (tableRef: any) => {
    if (!tableRef || !Array.isArray(tableRef.columns)) return
    const map = readMap()
    if (!Object.keys(map).length) return
    tableRef.columns.forEach((col: ColumnLike) => {
      const key = buildColumnKey(col)
      if (!key) return
      const width = map[key]
      if (!width) return
      col.width = width
      col.realWidth = width
    })
    tableRef.doLayout?.()
  }

  const restoreColumnWidths = (tableRef: any) => {
    nextTick(() => {
      applyToTable(tableRef)
    })
  }

  return {
    onHeaderDragEnd,
    restoreColumnWidths,
  }
}


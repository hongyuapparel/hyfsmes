import { nextTick, ref, type Ref } from 'vue'
import Sortable from 'sortablejs'

export type TableComponentInstance = HTMLElement | { $el?: HTMLElement } | null

let rowKeySeed = 0

export function nextRowKey(prefix: string) {
  rowKeySeed += 1
  return `${prefix}-${Date.now()}-${rowKeySeed}`
}

export interface UseTableRowDragSortOptions {
  beforeCreate?: () => void
}

export function useTableRowDragSort<T extends { __rowKey?: string }>(
  rows: Ref<T[]>,
  handleSelector: string,
  options: UseTableRowDragSortOptions = {},
) {
  const tableRef = ref<TableComponentInstance>(null)
  let sortable: Sortable | null = null

  function setTableRef(el: unknown) {
    if (el instanceof HTMLElement || el === null) {
      tableRef.value = el
      return
    }
    if (el && typeof el === 'object' && '$el' in el) {
      const maybeTable = el as { $el?: HTMLElement }
      tableRef.value = maybeTable.$el ? maybeTable : null
      return
    }
    tableRef.value = null
  }

  function initSortable() {
    nextTick(() => {
      const target = tableRef.value
      const root = target instanceof HTMLElement ? target : target?.$el
      const tbody = root?.querySelector('.el-table__body-wrapper tbody') as HTMLElement | null
      if (!tbody) return

      destroySortable()
      options.beforeCreate?.()

      sortable = Sortable.create(tbody, {
        animation: 120,
        handle: handleSelector,
        draggable: '> tr',
        onEnd: (evt) => {
          const orderedKeys = Array.from(tbody.querySelectorAll('tr.el-table__row'))
            .map((tr) => tr.getAttribute('data-row-key'))
            .filter((k): k is string => !!k)
          if (orderedKeys.length === rows.value.length) {
            const rowMap = new Map(rows.value.map((r) => [r.__rowKey, r]))
            const nextRows = orderedKeys.map((k) => rowMap.get(k)).filter((r): r is T => !!r)
            if (nextRows.length === rows.value.length) {
              rows.value = nextRows
              return
            }
          }
          const anyEvt = evt as unknown as {
            oldIndex?: number
            newIndex?: number
            oldDraggableIndex?: number
            newDraggableIndex?: number
          }
          const oldIndex = anyEvt.oldDraggableIndex ?? anyEvt.oldIndex
          const newIndex = anyEvt.newDraggableIndex ?? anyEvt.newIndex
          if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
          if (
            oldIndex < 0 ||
            newIndex < 0 ||
            oldIndex >= rows.value.length ||
            newIndex >= rows.value.length
          ) {
            return
          }
          const moved = rows.value.splice(oldIndex, 1)[0]
          if (!moved) return
          rows.value.splice(newIndex, 0, moved)
        },
      })
    })
  }

  function destroySortable() {
    if (sortable) {
      sortable.destroy()
      sortable = null
    }
  }

  return {
    tableRef,
    setTableRef,
    initSortable,
    destroySortable,
  }
}

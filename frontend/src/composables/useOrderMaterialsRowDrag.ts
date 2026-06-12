import { nextTick, ref, type Ref } from 'vue'
import Sortable from 'sortablejs'
import type { MaterialRow } from '@/composables/useOrderMaterials'

let materialRowKeySeed = 0

export function nextMaterialRowKey() {
  materialRowKeySeed += 1
  return `material-row-${Date.now()}-${materialRowKeySeed}`
}

export function useOrderMaterialsRowDrag(materials: Ref<MaterialRow[]>) {
  const materialsTableRef = ref<HTMLElement | { $el?: HTMLElement } | null>(null)
  let materialsSortable: Sortable | null = null

  function setMaterialsTableRef(el: unknown) {
    if (el instanceof HTMLElement || el === null) {
      materialsTableRef.value = el
      return
    }
    if (el && typeof el === 'object' && '$el' in el) {
      const maybeTable = el as { $el?: HTMLElement }
      materialsTableRef.value = maybeTable.$el ? maybeTable : null
      return
    }
    materialsTableRef.value = null
  }

  function ensureMaterialRowKeys() {
    materials.value.forEach((row) => {
      if (!row.__rowKey) row.__rowKey = nextMaterialRowKey()
    })
  }

  function initMaterialsSortable() {
    nextTick(() => {
      const tableRef = materialsTableRef.value
      const root = tableRef instanceof HTMLElement ? tableRef : tableRef?.$el
      const tbody = root?.querySelector('.el-table__body-wrapper tbody') as HTMLElement | null
      if (!tbody) return

      destroyMaterialsSortable()
      ensureMaterialRowKeys()

      materialsSortable = Sortable.create(tbody, {
        animation: 120,
        handle: '.material-row-drag-handle',
        draggable: '> tr',
        onEnd: (evt) => {
          const orderedKeys = Array.from(tbody.querySelectorAll('tr.el-table__row'))
            .map((tr) => tr.getAttribute('data-row-key'))
            .filter((k): k is string => !!k)
          if (orderedKeys.length === materials.value.length) {
            const rowMap = new Map(materials.value.map((r) => [r.__rowKey, r]))
            const nextRows = orderedKeys.map((k) => rowMap.get(k)).filter((r): r is MaterialRow => !!r)
            if (nextRows.length === materials.value.length) {
              materials.value = nextRows
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
            oldIndex >= materials.value.length ||
            newIndex >= materials.value.length
          ) {
            return
          }
          const moved = materials.value.splice(oldIndex, 1)[0]
          if (!moved) return
          materials.value.splice(newIndex, 0, moved)
        },
      })
    })
  }

  function destroyMaterialsSortable() {
    if (materialsSortable) {
      materialsSortable.destroy()
      materialsSortable = null
    }
  }

  return {
    nextMaterialRowKey,
    setMaterialsTableRef,
    ensureMaterialRowKeys,
    initMaterialsSortable,
    destroyMaterialsSortable,
  }
}

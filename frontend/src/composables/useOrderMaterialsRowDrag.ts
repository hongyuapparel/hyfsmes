import type { Ref } from 'vue'
import type { MaterialRow } from '@/composables/useOrderMaterials'
import { nextRowKey, useTableRowDragSort } from '@/composables/useTableRowDragSort'

export function nextMaterialRowKey() {
  return nextRowKey('material-row')
}

export function useOrderMaterialsRowDrag(materials: Ref<MaterialRow[]>) {
  function ensureMaterialRowKeys() {
    materials.value.forEach((row) => {
      if (!row.__rowKey) row.__rowKey = nextMaterialRowKey()
    })
  }

  const dragApi = useTableRowDragSort(materials, '.material-row-drag-handle', {
    beforeCreate: ensureMaterialRowKeys,
  })

  return {
    nextMaterialRowKey,
    setMaterialsTableRef: dragApi.setTableRef,
    ensureMaterialRowKeys,
    initMaterialsSortable: dragApi.initSortable,
    destroyMaterialsSortable: dragApi.destroySortable,
  }
}

import { computed, ref } from 'vue'
import type { CuttingListItem } from '@/api/production-cutting'

export function useCuttingSelection() {
  const selectedRows = ref<CuttingListItem[]>([])
  const hasSelection = computed(() => selectedRows.value.length > 0)
  const canRegisterSelection = computed(() =>
    selectedRows.value.length > 0 && selectedRows.value.some((r) => r.cuttingStatus !== 'completed'),
  )

  function onSelectionChange(rows: CuttingListItem[]) {
    selectedRows.value = rows
  }

  function clearSelection() {
    selectedRows.value = []
  }

  return {
    selectedRows,
    hasSelection,
    canRegisterSelection,
    onSelectionChange,
    clearSelection,
  }
}

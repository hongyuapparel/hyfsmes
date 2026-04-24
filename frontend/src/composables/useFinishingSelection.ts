import { computed, ref, type Ref } from 'vue'
import type { FinishingListItem } from '@/api/production-finishing'

export function useFinishingSelection() {
  const selectedRows = ref<FinishingListItem[]>([])
  const hasSelection = computed(() => selectedRows.value.length > 0)

  /** 待尾部 tab：可登记收货（当前业务仅处理首条选中记录） */
  const canRegisterReceiveSelection = computed(() =>
    selectedRows.value.length > 0 &&
    selectedRows.value.every((r) => r.finishingStatus === 'pending_receive'),
  )
  /** 尾部中：可登记包装完成（发货数、入库数、次品数、备注） */
  const canPackagingCompleteSelection = computed(() =>
    selectedRows.value.length > 0 &&
    selectedRows.value.every((r) => r.finishingStatus === 'pending_assign'),
  )
  /** 尾部完成：待仓尚未处理时可改入库/次品（与后端校验一致） */
  const canAmendPackagingSelection = computed(() =>
    selectedRows.value.length > 0 &&
    selectedRows.value.every((r) => r.finishingStatus === 'inbound'),
  )

  function onSelectionChange(rows: FinishingListItem[]) {
    selectedRows.value = rows
  }

  function clearSelection() {
    selectedRows.value = []
  }

  return {
    selectedRows,
    hasSelection,
    canRegisterReceiveSelection,
    canPackagingCompleteSelection,
    canAmendPackagingSelection,
    onSelectionChange,
    clearSelection,
  }
}

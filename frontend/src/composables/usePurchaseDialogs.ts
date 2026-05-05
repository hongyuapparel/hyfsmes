import { computed, type Ref } from 'vue'
import type { PurchaseItemRow } from '@/api/production-purchase'
import {
  isRegisterablePurchaseRow,
  usePurchaseRegisterDialog,
} from '@/composables/usePurchaseRegisterDialog'
import { usePurchasePickDialog } from '@/composables/usePurchasePickDialog'

type UsePurchaseDialogsOptions = {
  currentTab: Ref<string>
  hasSelection: Ref<boolean>
  selectedRows: Ref<PurchaseItemRow[]>
  reload: () => Promise<void>
  reloadTabCounts: () => Promise<void>
  clearSelection: () => void
}

export function usePurchaseDialogs(options: UsePurchaseDialogsOptions) {
  const register = usePurchaseRegisterDialog({
    selectedRows: options.selectedRows,
    reload: options.reload,
    reloadTabCounts: options.reloadTabCounts,
    clearSelection: options.clearSelection,
  })
  const pick = usePurchasePickDialog({
    selectedRows: options.selectedRows,
    reload: options.reload,
    reloadTabCounts: options.reloadTabCounts,
    clearSelection: options.clearSelection,
  })

  function isPurchaseRowSelectable(row: PurchaseItemRow): boolean {
    if (options.currentTab.value === 'picking') {
      return row.processRoute === 'picking' && row.pickStatus !== 'completed'
    }
    return isRegisterablePurchaseRow(row)
  }

  function onBatchHandle() {
    if (!options.hasSelection.value) return
    if (options.currentTab.value === 'picking') {
      pick.openPickDialog()
      return
    }
    register.openRegisterDialog()
  }

  const batchButtonLabel = computed(() =>
    options.currentTab.value === 'picking' ? '领料' : '登记实际采购',
  )

  return {
    ...register,
    ...pick,
    batchButtonLabel,
    isPurchaseRowSelectable,
    onBatchHandle,
  }
}

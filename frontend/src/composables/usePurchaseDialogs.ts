import { computed, ref, type Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { completePurchaseBatch, type PurchaseItemRow } from '@/api/production-purchase'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import {
  isEditableCompletedPurchaseRow,
  isRegisterablePurchaseRow,
  usePurchaseRegisterDialog,
} from '@/composables/usePurchaseRegisterDialog'
import { usePurchasePickDialog } from '@/composables/usePurchasePickDialog'

type UsePurchaseDialogsOptions = {
  currentTab: Ref<string>
  hasSelection: Ref<boolean>
  selectedRows: Ref<PurchaseItemRow[]>
  canAdminEditSubmitted: Ref<boolean>
  reload: () => Promise<void>
  reloadTabCounts: () => Promise<void>
  clearSelection: () => void
}

export function usePurchaseDialogs(options: UsePurchaseDialogsOptions) {
  const completing = ref(false)
  const canCompleteSelection = computed(() => options.selectedRows.value.length > 0
    && options.selectedRows.value.every(row => row.processRoute === 'purchase' && row.purchaseStatus === 'purchasing'))
  const canHandleSelection = computed(() => options.selectedRows.value.length > 0
    && options.selectedRows.value.every(row => options.currentTab.value === 'picking'
      ? row.processRoute === 'picking' && row.pickStatus !== 'completed'
      : isRegisterablePurchaseRow(row)))

  async function completeSelection() {
    if (completing.value || !canCompleteSelection.value) return
    const items = options.selectedRows.value.map(({ orderId, materialIndex }) => ({ orderId, materialIndex }))
    completing.value = true
    try {
      await ElMessageBox.confirm(`确认这 ${items.length} 条物料已到货并交接？完成后，物料齐备的订单将进入下一环节。`, '到货完成', {
        confirmButtonText: '确认完成', cancelButtonText: '取消', type: 'warning',
      })
      await completePurchaseBatch(items)
      ElMessage.success(`已完成 ${items.length} 条采购`)
      options.clearSelection()
      await options.reload()
      await options.reloadTabCounts()
    } catch (e: unknown) {
      if (e !== 'cancel' && e !== 'close' && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '到货完成失败'))
    } finally {
      completing.value = false
    }
  }
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
    if (row.processRoute === 'picking') {
      if (row.pickStatus !== 'completed') return true
      return options.canAdminEditSubmitted.value
    }
    if (isRegisterablePurchaseRow(row) || row.purchaseStatus === 'purchasing') return true
    return options.canAdminEditSubmitted.value && isEditableCompletedPurchaseRow(row)
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
    completing,
    canCompleteSelection,
    canHandleSelection,
    completeSelection,
    batchButtonLabel,
    isPurchaseRowSelectable,
    onBatchHandle,
  }
}

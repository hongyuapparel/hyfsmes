import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getOrderSizeBreakdown, type OrderSizeBreakdownRes } from '@/api/orders'
import { type FinishingListItem } from '@/api/production-finishing'
import {
  normalizeSizeBreakdown,
  orderSizePopoverBlocks as qtyPopoverBlocksFromData,
  orderSizePopoverWidth as qtyPopoverWidthFromData,
} from '@/utils/order-size-popover-breakdown'
import { getErrorMessage, isErrorHandled } from '@/api/request'

export function useFinishingSizePopover() {
  const sizeBreakdownCache = ref<Record<number, OrderSizeBreakdownRes>>({})
  const sizePopoverLoadingId = ref<number | null>(null)

  function qtyPopoverBlocks(orderId: number) {
    return qtyPopoverBlocksFromData(sizeBreakdownCache.value[orderId])
  }

  function qtyPopoverWidth(orderId: number) {
    return qtyPopoverWidthFromData(sizeBreakdownCache.value[orderId])
  }

  async function onShowQtyPopover(row: FinishingListItem) {
    const id = row.orderId
    if (sizeBreakdownCache.value[id] || sizePopoverLoadingId.value === id) return
    sizePopoverLoadingId.value = id
    try {
      const res = await getOrderSizeBreakdown(id)
      sizeBreakdownCache.value[id] = normalizeSizeBreakdown(res.data ?? { headers: [], rows: [] })
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '尺码明细加载失败'))
    } finally {
      if (sizePopoverLoadingId.value === id) sizePopoverLoadingId.value = null
    }
  }

  return {
    sizeBreakdownCache,
    sizePopoverLoadingId,
    qtyPopoverBlocks,
    qtyPopoverWidth,
    onShowQtyPopover,
  }
}

import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getOrderSizeBreakdown, type OrderListItem, type OrderSizeBreakdownRes } from '@/api/orders'
import {
  normalizeSizeBreakdown,
  orderSizePopoverBlocks as blocksFromOrderSizeData,
  orderSizePopoverWidth as widthFromOrderSizeData,
} from '@/utils/order-size-popover-breakdown'
import { getErrorMessage, isErrorHandled } from '@/api/request'

export function useOrderSizePopover() {
  const sizePopoverLoadingId = ref<number | null>(null)
  const sizeBreakdownCache = ref<Record<number, OrderSizeBreakdownRes>>({})

  async function onShowSizePopover(order: OrderListItem) {
    const id = order.id
    if (sizeBreakdownCache.value[id] || sizePopoverLoadingId.value === id) return
    sizePopoverLoadingId.value = id
    try {
      const sizeRes = await getOrderSizeBreakdown(id)
      sizeBreakdownCache.value[id] = normalizeSizeBreakdown(sizeRes.data ?? { headers: [], rows: [] })
    } catch (e: unknown) {
      if (!isErrorHandled(e)) {
        ElMessage.error(getErrorMessage(e, '尺码明细加载失败'))
      }
    } finally {
      if (sizePopoverLoadingId.value === id) sizePopoverLoadingId.value = null
    }
  }

  function getSizePopoverWidth(orderId: number): number {
    return widthFromOrderSizeData(sizeBreakdownCache.value[orderId])
  }

  function sizePopoverBlocks(orderId: number) {
    return blocksFromOrderSizeData(sizeBreakdownCache.value[orderId])
  }

  return {
    sizePopoverLoadingId,
    sizeBreakdownCache,
    onShowSizePopover,
    getSizePopoverWidth,
    sizePopoverBlocks,
  }
}

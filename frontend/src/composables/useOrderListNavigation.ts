import { useRouter } from 'vue-router'
import { type OrderListItem } from '@/api/orders'

/**
 * 订单列表页的路由导航操作：编辑、详情、成本、打印、新建。
 */
export function useOrderListNavigation() {
  const router = useRouter()

  function openEdit(order: OrderListItem) {
    const title = `订单编辑 ${order.orderNo || order.id}`
    router.push({
      name: 'OrdersEdit',
      params: { id: order.id },
      query: { tabTitle: title, tabKey: `orders-edit-${order.id}` },
    })
  }

  function openView(order: OrderListItem) {
    const title = `订单详情 ${order.orderNo || order.id}`
    router.push({
      name: 'OrdersDetail',
      params: { id: order.id },
      query: { tabTitle: title, tabKey: `orders-detail-${order.id}` },
    })
  }

  function openCost(order: OrderListItem) {
    const title = `订单成本 ${order.orderNo || order.id}`
    router.push({
      name: 'OrdersCost',
      params: { id: order.id },
      query: { tabTitle: title, tabKey: `orders-cost-${order.id}` },
    })
  }

  function printOrder(order: OrderListItem) {
    // 统一使用订单详情页进行打印，保证版式一致
    const title = `订单详情 ${order.orderNo || order.id}`
    router.push({
      name: 'OrdersDetail',
      params: { id: order.id },
      query: { tabTitle: title, tabKey: `orders-detail-${order.id}` },
    })
  }

  function onCreateOrder() {
    const key = `orders-edit-new-${Date.now()}`
    router.push({ name: 'OrdersEdit', query: { new: '1', tabKey: key, tabTitle: '订单编辑 新建' } })
  }

  return { openEdit, openView, openCost, printOrder, onCreateOrder }
}

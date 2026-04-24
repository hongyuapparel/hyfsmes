import { computed, ref, type Ref } from 'vue'
import type { OrderListItem } from '@/api/orders'

interface OrderPolicies {
  delete?: string[]
  review?: string[]
  edit?: string[]
}

interface AuthStoreLike {
  hasPermission: (permission: string) => boolean
  user?: {
    orderPolicies?: OrderPolicies
  }
}

interface UseOrderListSelectionParams {
  list: Ref<OrderListItem[]>
  totalQuantity: Ref<number>
  currentStatus: Ref<string>
  authStore: AuthStoreLike
}

export function useOrderListSelection(params: UseOrderListSelectionParams) {
  const { list, totalQuantity, currentStatus, authStore } = params

  const cardSelected = ref<Record<number, boolean>>({})
  const selectedIds = computed(() => {
    const map = cardSelected.value
    return list.value.filter((item) => map[item.id]).map((item) => item.id)
  })
  const hasSelection = computed(() => selectedIds.value.length > 0)

  const selectedQuantityTotal = computed(() => {
    let sum = 0
    for (const item of list.value) {
      if (!cardSelected.value[item.id]) continue
      sum += Number(item.quantity) || 0
    }
    return sum
  })

  const paginationQuantityLabel = computed(() => (hasSelection.value ? '已选件数' : '总件数'))
  const paginationQuantityValue = computed(() =>
    hasSelection.value ? selectedQuantityTotal.value : totalQuantity.value,
  )

  const isPendingReviewTab = computed(() => currentStatus.value === 'pending_review')
  const canEditOrders = computed(() => authStore.hasPermission('orders_edit'))
  const canDeleteOrders = computed(() => authStore.hasPermission('orders_delete'))
  const canReviewOrders = computed(() => authStore.hasPermission('orders_review'))

  const deleteAllowedStatuses = computed(() => {
    const arr = authStore.user?.orderPolicies?.delete ?? []
    return new Set(arr.map((s) => (s ?? '').trim()).filter(Boolean))
  })
  const reviewAllowedStatuses = computed(() => {
    const arr = authStore.user?.orderPolicies?.review ?? []
    return new Set(arr.map((s) => (s ?? '').trim()).filter(Boolean))
  })
  const selectedStatusList = computed(() =>
    list.value.filter((item) => cardSelected.value[item.id]).map((item) => (item.status ?? '').trim()),
  )

  const canDeleteSelectedByStatus = computed(() => {
    const statuses = selectedStatusList.value
    if (!statuses.length) return false
    if (!authStore.user?.orderPolicies?.delete) return false
    const allow = deleteAllowedStatuses.value
    if (!allow.size) return false
    return statuses.every((s) => allow.has(s))
  })

  const canReviewSelectedByStatus = computed(() => {
    const statuses = selectedStatusList.value
    if (!statuses.length) return false
    if (!authStore.user?.orderPolicies?.review) return false
    const allow = reviewAllowedStatuses.value
    if (!allow.size) return false
    return statuses.every((s) => allow.has(s))
  })

  function resetSelection() {
    cardSelected.value = {}
  }

  function onCardSelectChange() {
    // 选中状态变化时，selectedIds 由计算属性自动更新
  }

  function canEditOrderItem(item: OrderListItem): boolean {
    if (!canEditOrders.value) return false
    const allowed = authStore.user?.orderPolicies?.edit
    if (!allowed) return true
    const allowedSet = new Set((allowed ?? []).map((s) => (s ?? '').trim()).filter(Boolean))
    if (!allowedSet.size) return false
    return allowedSet.has((item.status ?? '').trim())
  }

  return {
    cardSelected,
    selectedIds,
    hasSelection,
    paginationQuantityLabel,
    paginationQuantityValue,
    isPendingReviewTab,
    canEditOrders,
    canDeleteOrders,
    canReviewOrders,
    canDeleteSelectedByStatus,
    canReviewSelectedByStatus,
    resetSelection,
    onCardSelectChange,
    canEditOrderItem,
  }
}

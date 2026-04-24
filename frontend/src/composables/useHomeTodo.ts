import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getOrders, type OrderListItem } from '@/api/orders'
import { getOrderStatuses, type OrderStatusItem } from '@/api/order-status-config'
import { getPendingInboundList, type PendingInboundItem } from '@/api/inventory-pending'

const TODO_LIST_PAGE_SIZE = 6

export type HomeTodoCounts = {
  pendingReview: number
  myMerchandiser: number
  dueSoon: number
  pendingInbound: number
}

export type HomeTodoLists = {
  pendingReview: OrderListItem[]
  myMerchandiser: OrderListItem[]
  dueSoon: OrderListItem[]
  pendingInbound: PendingInboundItem[]
}

function todayYYYYMMDD(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDaysYYYYMMDD(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateTs(value: string | null | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp
}

export function useHomeTodo() {
  const router = useRouter()
  const authStore = useAuthStore()

  const todoLoading = ref(false)
  const todoCounts = ref<HomeTodoCounts>({
    pendingReview: 0,
    myMerchandiser: 0,
    dueSoon: 0,
    pendingInbound: 0,
  })

  const todoLists = ref<HomeTodoLists>({
    pendingReview: [],
    myMerchandiser: [],
    dueSoon: [],
    pendingInbound: [],
  })

  const isAdmin = computed(() => authStore.user?.roleName === '超级管理员')
  const canAccessOrders = computed(() => authStore.hasRoutePermission('/orders/list'))
  const canReviewOrders = computed(() => authStore.hasPermission('orders_review'))
  const canAccessPendingInbound = computed(() => authStore.hasRoutePermission('/inventory/pending'))
  const displayName = computed(() => authStore.user?.displayName ?? '')

  const showMyMerchandiser = computed(() => !isAdmin.value && canAccessOrders.value && !!displayName.value)

  const hasAnyTodoCard = computed(
    () =>
      canReviewOrders.value ||
      showMyMerchandiser.value ||
      canAccessOrders.value ||
      canAccessPendingInbound.value,
  )

  const dueSoonStart = computed(() => todayYYYYMMDD())
  const dueSoonEnd = computed(() => addDaysYYYYMMDD(7))

  const pendingReviewLink = '/orders/list?status=pending_review'
  const myMerchandiserLink = computed(() => `/orders/list?merchandiser=${encodeURIComponent(displayName.value)}`)
  const dueSoonLink = computed(
    () =>
      `/orders/list?customerDueStart=${dueSoonStart.value}&customerDueEnd=${dueSoonEnd.value}`,
  )

  function goOrdersList(href: string) {
    const path = href.split('?')[0]
    const query: Record<string, string> = {}
    const queryString = href.includes('?') ? href.slice(href.indexOf('?') + 1) : ''
    queryString.split('&').forEach((pair) => {
      const [key, value] = pair.split('=')
      if (key && value) query[key] = decodeURIComponent(value)
    })
    router.push({ path, query })
  }

  function goOrderDetail(orderId: number) {
    router.push({ name: 'OrdersDetail', params: { id: String(orderId) } })
  }

  function goPendingInbound() {
    router.push({ path: '/inventory/pending' })
  }

  async function loadDueSoonTodo() {
    const statusRes = await getOrderStatuses()
    const allStatuses: OrderStatusItem[] = statusRes.data ?? []
    const remindableStatuses = allStatuses
      .filter((status) => status.enabled && status.code !== 'draft' && !status.isFinal)
      .map((status) => status.code)

    if (!remindableStatuses.length) {
      todoCounts.value.dueSoon = 0
      todoLists.value.dueSoon = []
      return
    }

    const responses = await Promise.all(
      remindableStatuses.map((statusCode) =>
        getOrders({
          status: statusCode,
          customerDueStart: dueSoonStart.value,
          customerDueEnd: dueSoonEnd.value,
          page: 1,
          pageSize: TODO_LIST_PAGE_SIZE,
        }),
      ),
    )

    let total = 0
    const merged: OrderListItem[] = []
    responses.forEach((res) => {
      const data = res.data
      total += data?.total ?? 0
      if (data?.list?.length) merged.push(...data.list)
    })

    merged.sort((a, b) => {
      const dueDiff = parseDateTs(a.customerDueDate) - parseDateTs(b.customerDueDate)
      if (dueDiff !== 0) return dueDiff
      return b.id - a.id
    })

    todoCounts.value.dueSoon = total
    todoLists.value.dueSoon = merged.slice(0, TODO_LIST_PAGE_SIZE)
  }

  async function loadTodo() {
    if (!canAccessOrders.value && !canAccessPendingInbound.value) return
    todoLoading.value = true
    try {
      const tasks: Promise<unknown>[] = []

      if (canReviewOrders.value) {
        tasks.push(
          getOrders({
            status: 'pending_review',
            page: 1,
            pageSize: TODO_LIST_PAGE_SIZE,
          }).then((res) => {
            const data = res.data
            todoCounts.value.pendingReview = data?.total ?? 0
            todoLists.value.pendingReview = data?.list ?? []
          }),
        )
      }

      if (showMyMerchandiser.value) {
        tasks.push(
          getOrders({
            merchandiser: displayName.value,
            page: 1,
            pageSize: TODO_LIST_PAGE_SIZE,
          }).then((res) => {
            const data = res.data
            todoCounts.value.myMerchandiser = data?.total ?? 0
            todoLists.value.myMerchandiser = data?.list ?? []
          }),
        )
      }

      if (canAccessOrders.value) {
        tasks.push(loadDueSoonTodo())
      }

      if (canAccessPendingInbound.value) {
        tasks.push(
          getPendingInboundList({ page: 1, pageSize: TODO_LIST_PAGE_SIZE }).then((res) => {
            const data = res.data
            todoCounts.value.pendingInbound = data?.total ?? 0
            todoLists.value.pendingInbound = data?.list ?? []
          }),
        )
      }

      await Promise.all(tasks)
    } finally {
      todoLoading.value = false
    }
  }

  return {
    authStore,
    todoLoading,
    todoCounts,
    todoLists,
    isAdmin,
    canAccessOrders,
    canReviewOrders,
    canAccessPendingInbound,
    displayName,
    showMyMerchandiser,
    hasAnyTodoCard,
    pendingReviewLink,
    myMerchandiserLink,
    dueSoonLink,
    goOrdersList,
    goOrderDetail,
    goPendingInbound,
    loadTodo,
  }
}

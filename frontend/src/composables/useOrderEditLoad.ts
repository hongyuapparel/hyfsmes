import { nextTick, onMounted, ref, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getOrderDetail, type OrderFormPayload } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useAuthStore } from '@/stores/auth'

interface SalesUserOption {
  id: number
  username: string
  displayName?: string
}

interface UseOrderEditLoadParams {
  route: RouteLocationNormalizedLoaded
  router: Router
  orderId: Ref<number | undefined>
  form: OrderFormPayload
  hasUnsavedChanges: Ref<boolean>
  skipDirtyCheck: Ref<boolean>
  salespersonOptions: Ref<SalesUserOption[]>
  ensureAtLeastOneColorRow: () => void
  hydrateOrderDetail: (orderDetail: unknown) => Promise<void>
  loadCollaborationOptions: () => Promise<void>
  loadOrderTypeTree: () => Promise<void>
  loadSalespersonOptions: () => Promise<void>
  loadMerchandiserOptions: () => Promise<void>
  loadMaterialTypes: () => Promise<void>
  loadMaterialSources: () => Promise<void>
  searchProcessSuppliers: (keyword: string) => Promise<void>
  loadProcessOptions: () => Promise<void>
  syncMaterialTypeIdsFromLabel: () => void
  syncMaterialSourceIdsFromLabel: () => void
  initSizeInfoSortable: () => void
  storageKey?: string
}

function getInitialOrderId(route: RouteLocationNormalizedLoaded) {
  const initialRouteId = route.params.id
  if (!initialRouteId) return undefined

  const parsed = Number(initialRouteId)
  return Number.isNaN(parsed) ? undefined : parsed
}

export function useOrderEditLoad({
  route,
  router,
  orderId,
  form,
  hasUnsavedChanges,
  skipDirtyCheck,
  salespersonOptions,
  ensureAtLeastOneColorRow,
  hydrateOrderDetail,
  loadCollaborationOptions,
  loadOrderTypeTree,
  loadSalespersonOptions,
  loadMerchandiserOptions,
  loadMaterialTypes,
  loadMaterialSources,
  searchProcessSuppliers,
  loadProcessOptions,
  syncMaterialTypeIdsFromLabel,
  syncMaterialSourceIdsFromLabel,
  initSizeInfoSortable,
  storageKey = 'orders_last_edit_id',
}: UseOrderEditLoadParams) {
  const pageLoading = ref(false)

  orderId.value = getInitialOrderId(route)

  async function loadDetail() {
    if (!orderId.value) {
      form.orderDate = new Date().toISOString().slice(0, 10)
      ensureAtLeastOneColorRow()
      return
    }

    try {
      skipDirtyCheck.value = true
      const res = await getOrderDetail(orderId.value)
      const detail = res.data
      if (!detail) return
      await hydrateOrderDetail(detail)
      sessionStorage.setItem(storageKey, String(orderId.value))
      nextTick(() => {
        hasUnsavedChanges.value = false
        skipDirtyCheck.value = false
      })
    } catch (e: unknown) {
      skipDirtyCheck.value = false
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    }
  }

  function injectCurrentSalesperson() {
    if (orderId.value) return

    const authStore = useAuthStore()
    if (!authStore.user) return

    const displayLabel = authStore.user.displayName || authStore.user.username
    if (!form.salesperson) form.salesperson = displayLabel

    const exists = salespersonOptions.value.some((user) => (user.displayName || user.username) === displayLabel)
    if (exists) return

    salespersonOptions.value.unshift({
      id: authStore.user.id,
      username: authStore.user.username,
      displayName: authStore.user.displayName ?? '',
    })
  }

  function restoreLastEditOrderIfNeeded() {
    if (route.query.new === '1') {
      sessionStorage.removeItem(storageKey)
      return
    }

    if (route.params.id || route.query.new === '1') return

    const lastId = sessionStorage.getItem(storageKey)
    if (!lastId) return

    const parsed = Number(lastId)
    if (Number.isNaN(parsed) || parsed <= 0) return

    const tabKey = typeof route.query?.tabKey === 'string' ? route.query.tabKey : undefined
    const tabTitle = typeof route.query?.tabTitle === 'string' ? route.query.tabTitle : undefined
    router.replace({ name: 'OrdersEdit', params: { id: lastId }, query: { tabKey, tabTitle } })
    orderId.value = parsed
  }

  onMounted(async () => {
    restoreLastEditOrderIfNeeded()
    if (orderId.value) pageLoading.value = true

    try {
      await Promise.all([
        (async () => {
          await Promise.all([
            loadCollaborationOptions(),
            loadOrderTypeTree(),
            loadSalespersonOptions(),
            loadMerchandiserOptions(),
          ])
          await loadMaterialTypes()
          await loadMaterialSources()
          await searchProcessSuppliers('')
          await loadProcessOptions()
        })(),
        loadDetail(),
      ])

      syncMaterialTypeIdsFromLabel()
      syncMaterialSourceIdsFromLabel()
      injectCurrentSalesperson()
    } finally {
      pageLoading.value = false
      initSizeInfoSortable()
      nextTick(() => {
        hasUnsavedChanges.value = false
        skipDirtyCheck.value = false
      })
    }
  })

  return {
    pageLoading,
    loadDetail,
  }
}

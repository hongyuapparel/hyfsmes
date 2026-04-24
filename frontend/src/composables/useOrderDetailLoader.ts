import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getOrderDetail, type OrderDetail } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'

interface UseOrderDetailLoaderOptions {
  route: RouteLocationNormalizedLoaded
  router: Router
}

export function useOrderDetailLoader({ route, router }: UseOrderDetailLoaderOptions) {
  const loading = ref(false)
  const detail = ref<OrderDetail | null>(null)

  async function loadDetail() {
    const idParam = route.params.id
    const id = Number(idParam)
    if (!id || Number.isNaN(id)) {
      ElMessage.error('订单ID无效')
      await router.push({ name: 'OrdersList' })
      return
    }
    loading.value = true
    try {
      const res = await getOrderDetail(id)
      detail.value = res.data ?? null
    } catch (e: unknown) {
      if (!isErrorHandled(e)) {
        ElMessage.error(getErrorMessage(e))
      }
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    detail,
    loadDetail,
  }
}

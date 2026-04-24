import { ref, type Ref } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import { ElMessage } from 'element-plus'
import { createOrderDraft, submitOrder, updateOrderDraft, type OrderFormPayload } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'

interface UseOrderEditSubmitParams {
  route: RouteLocationNormalizedLoaded
  router: Router
  orderId: Ref<number | undefined>
  orderStatus: Ref<string>
  orderNo: Ref<string>
  hasUnsavedChanges: Ref<boolean>
  collectPayload: () => Promise<OrderFormPayload>
  storageKey?: string
}

function resolveTabQuery(route: RouteLocationNormalizedLoaded) {
  return typeof route.query?.tabKey === 'string' ? route.query.tabKey : undefined
}

function buildTabTitle(orderNo: string, id: number) {
  return `订单编辑 ${orderNo || id}`
}

export function useOrderEditSubmit({
  route,
  router,
  orderId,
  orderStatus,
  orderNo,
  hasUnsavedChanges,
  collectPayload,
  storageKey = 'orders_last_edit_id',
}: UseOrderEditSubmitParams) {
  const saving = ref(false)
  const submitting = ref(false)

  function persistCurrentOrder(id: number) {
    sessionStorage.setItem(storageKey, String(id))
  }

  function replaceEditRoute(id: number, title: string) {
    const tabKey = resolveTabQuery(route)
    router.replace({
      name: 'OrdersEdit',
      params: { id: String(id) },
      query: { tabKey, tabTitle: title },
    })
  }

  async function onSaveDraft() {
    const payload = await collectPayload().catch(() => undefined)
    if (!payload) return

    saving.value = true
    try {
      if (orderId.value) {
        const res = await updateOrderDraft(orderId.value, payload)
        ElMessage.success('草稿已保存')
        orderStatus.value = res.data?.status ?? orderStatus.value
        orderNo.value = res.data?.orderNo ?? orderNo.value
        hasUnsavedChanges.value = false
        persistCurrentOrder(orderId.value)
        return
      }

      const res = await createOrderDraft(payload)
      ElMessage.success('草稿已创建')
      const createdId = res.data?.id
      orderStatus.value = res.data?.status ?? 'draft'
      orderNo.value = res.data?.orderNo ?? ''
      if (!createdId) {
        hasUnsavedChanges.value = false
        return
      }

      orderId.value = createdId
      persistCurrentOrder(createdId)
      replaceEditRoute(createdId, buildTabTitle(orderNo.value, createdId))
      hasUnsavedChanges.value = false
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      saving.value = false
    }
  }

  async function onSaveAndSubmit() {
    const payload = await collectPayload().catch(() => undefined)
    if (!payload) return

    submitting.value = true
    try {
      if (orderId.value) {
        await updateOrderDraft(orderId.value, payload)
        const res = await submitOrder(orderId.value)
        ElMessage.success('提交成功')
        orderNo.value = res.data?.orderNo ?? orderNo.value
        orderStatus.value = res.data?.status ?? orderStatus.value
        hasUnsavedChanges.value = false
        persistCurrentOrder(orderId.value)
        return
      }

      const draftRes = await createOrderDraft(payload)
      const createdId = draftRes.data?.id
      if (!createdId) return

      orderId.value = createdId
      persistCurrentOrder(createdId)
      replaceEditRoute(createdId, buildTabTitle(draftRes.data?.orderNo ?? '', createdId))

      const submitRes = await submitOrder(createdId)
      orderNo.value = submitRes.data?.orderNo ?? draftRes.data?.orderNo ?? ''
      orderStatus.value = submitRes.data?.status ?? orderStatus.value
      hasUnsavedChanges.value = false
      ElMessage.success('提交成功')
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      submitting.value = false
    }
  }

  return {
    saving,
    submitting,
    onSaveDraft,
    onSaveAndSubmit,
  }
}

import { computed, ref, type Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { buildSnapshotPayload } from '@/utils/order-cost'
import type { OrderDetail } from '@/api/orders'
import { confirmOrderCost, saveOrderCost } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'

interface OrderCostQuoteAuthLike {
  user?: { displayName?: string; username?: string } | null
}

interface UseOrderCostQuoteActionsParams {
  authStore: OrderCostQuoteAuthLike
  orderId: Readonly<Ref<number>>
  order: Ref<OrderDetail | null>
  canSubmitCost: Readonly<Ref<boolean>>
  computedExFactoryPrice: Readonly<Ref<number>>
  quoteConfirmedAt: Ref<string>
  quoteConfirmedBy: Ref<string>
  quoteNeedsReconfirm: Ref<boolean>
  hasLocalDraftChanges: Readonly<Ref<boolean>>
  isQuoteQueue: Readonly<Ref<boolean>>
  buildCurrentSnapshot: () => ReturnType<typeof buildSnapshotPayload>
  markSaved: (snapshot: ReturnType<typeof buildSnapshotPayload>) => void
  costIssues: Readonly<Ref<string[]>>
  structureDifferences: Readonly<Ref<string[]>>
  goAfterQuoteConfirm: (action: 'next' | 'return') => Promise<void>
}

function formatTimeLabel(iso: string): string {
  if (!iso) return ''
  const time = new Date(iso)
  return Number.isNaN(time.getTime()) ? '' : time.toLocaleString()
}

/** 成本草稿与确认报价操作；只有确认报价才会同步订单卡片价格。 */
export function useOrderCostQuoteActions(params: UseOrderCostQuoteActionsParams) {
  const savingDraft = ref(false)
  const confirmingQuote = ref(false)
  const navigatingAfterConfirm = ref(false)
  // Keep controls locked while fetching the next order, but allow navigation after the save succeeds.
  const blockingSubmission = computed(() => savingDraft.value || (confirmingQuote.value && !navigatingAfterConfirm.value))

  const costNotice = computed(() => {
    if (!params.canSubmitCost.value) return '你没有“订单成本可提交”权限：可在页面试算，但不能保存草稿或确认报价。'
    if (params.quoteConfirmedAt.value && params.hasLocalDraftChanges.value) return '当前成本已被修改但尚未确认报价，订单卡片仍显示上次已确认出厂价。'
    if (params.quoteConfirmedAt.value && params.quoteNeedsReconfirm.value) return '当前成本在上次确认后有修改，需重新确认报价；订单卡片仍显示上次已确认出厂价。'
    if (params.quoteNeedsReconfirm.value) return '当前为草稿版本，尚未首次确认报价，不会同步到订单卡片。'
    if (params.quoteConfirmedAt.value) {
      const by = params.quoteConfirmedBy.value || '未知用户'
      const at = formatTimeLabel(params.quoteConfirmedAt.value)
      return `最近一次确认报价：${by}${at ? `（${at}）` : ''}`
    }
    return '尚未确认报价，订单卡片暂不更新本次试算价格。'
  })

  async function saveDraft() {
    if (savingDraft.value || confirmingQuote.value) return
    if (!params.orderId.value || !params.order.value) return
    if (!params.canSubmitCost.value) return ElMessage.warning('你没有“订单成本可提交”权限，当前仅可试算')
    savingDraft.value = true
    const snapshot = params.buildCurrentSnapshot()
    try {
      const res = await saveOrderCost(params.orderId.value, { snapshot })
      const savedSnapshot = res.data?.snapshot
      params.quoteNeedsReconfirm.value = Boolean(savedSnapshot?.quoteNeedsReconfirm)
      if (typeof savedSnapshot?.quoteConfirmedAt === 'string') params.quoteConfirmedAt.value = savedSnapshot.quoteConfirmedAt
      if (typeof savedSnapshot?.quoteConfirmedBy === 'string') params.quoteConfirmedBy.value = savedSnapshot.quoteConfirmedBy
      params.markSaved(snapshot)
      const saveMessage = params.quoteConfirmedAt.value
        ? params.quoteNeedsReconfirm.value
          ? '草稿已保存（待重新确认报价）'
          : '草稿已保存（报价确认状态未变化）'
        : '草稿已保存（尚未首次确认报价）'
      ElMessage.success(saveMessage)
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '保存失败'))
    } finally {
      savingDraft.value = false
    }
  }

  async function confirmQuote(afterConfirm: 'stay' | 'next' | 'return' = 'stay') {
    if (savingDraft.value || confirmingQuote.value) return
    if (!params.orderId.value || !params.order.value) return
    if (!params.canSubmitCost.value) return ElMessage.warning('你没有“订单成本可提交”权限，当前仅可试算')
    const price = params.computedExFactoryPrice.value
    if (!Number.isFinite(price) || price <= 0) return ElMessage.warning('请先填写成本并计算得出有效出厂价')
    confirmingQuote.value = true
    const warnings = [...params.costIssues.value]
    if (params.structureDifferences.value.length) warnings.push(`${params.structureDifferences.value.join('、')}与订单不同，请确认当前成本已覆盖实际需求`)
    if (warnings.length) {
      try {
        await ElMessageBox.confirm(warnings.join('；'), '报价前核对', {
          confirmButtonText: '已核对，确认报价', cancelButtonText: '返回检查', type: 'warning',
        })
      } catch { confirmingQuote.value = false; return }
    }
    const snapshot = params.buildCurrentSnapshot()
    let confirmed = false
    try {
      await confirmOrderCost(params.orderId.value, { snapshot })
      params.order.value.exFactoryPrice = price.toFixed(2)
      params.quoteNeedsReconfirm.value = false
      params.quoteConfirmedBy.value = params.authStore.user?.displayName || params.authStore.user?.username || ''
      params.quoteConfirmedAt.value = new Date().toISOString()
      params.markSaved(snapshot)
      confirmed = true
      ElMessage.success('已确认报价并同步订单卡片出厂价')
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '确认报价失败'))
    } finally {
      if (!confirmed) confirmingQuote.value = false
    }
    if (!confirmed) return
    if (!params.isQuoteQueue.value || afterConfirm === 'stay') {
      confirmingQuote.value = false
      return
    }
    try {
      navigatingAfterConfirm.value = true
      await params.goAfterQuoteConfirm(afterConfirm)
    } finally {
      navigatingAfterConfirm.value = false
      confirmingQuote.value = false
    }
  }

  return { savingDraft, confirmingQuote, blockingSubmission, costNotice, saveDraft, confirmQuote }
}

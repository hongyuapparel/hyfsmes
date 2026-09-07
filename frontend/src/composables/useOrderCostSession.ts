import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import type { buildSnapshotPayload } from '@/utils/order-cost'
import { getRouteTabKey, registerTabCloseGuard } from './useRouteCacheControl'

type Snapshot = ReturnType<typeof buildSnapshotPayload>

/** Track only persisted cost fields; searches and row selections do not change a draft. */
export function useOrderCostSession(
  snapshot: () => Snapshot,
  restore: (value: Snapshot) => void,
  loading: Ref<boolean>,
  submitting: () => boolean,
) {
  const baseline = ref('')
  const current = computed(() => JSON.stringify(snapshot()))
  const dirty = computed(() => !loading.value && !!baseline.value && current.value !== baseline.value)
  function markSaved(value: Snapshot) { baseline.value = JSON.stringify(value) }
  watch(loading, (busy) => { if (!busy) baseline.value = current.value }, { flush: 'sync' })

  let pending: Promise<boolean> | undefined
  async function confirmDiscard(): Promise<boolean> {
    if (submitting()) return false
    if (!dirty.value) return true
    if (pending) return pending
    pending = ElMessageBox.confirm('成本修改尚未保存，是否放弃本次修改？', '未保存的成本', {
      confirmButtonText: '放弃修改', cancelButtonText: '继续编辑', type: 'warning',
    }).then(async () => {
      restore(JSON.parse(baseline.value) as Snapshot)
      await nextTick()
      baseline.value = current.value
      return true
    }).catch(() => false).finally(() => { pending = undefined })
    return pending
  }

  const tabKey = getRouteTabKey(useRoute())
  const unregister = registerTabCloseGuard(tabKey, confirmDiscard)
  onBeforeRouteLeave(confirmDiscard)
  onBeforeRouteUpdate((to, from) => {
    if (getRouteTabKey(from) === tabKey && (to.params.id !== from.params.id || getRouteTabKey(to) !== tabKey)) {
      return confirmDiscard()
    }
    return true
  })
  function beforeUnload(event: BeforeUnloadEvent) {
    if (!dirty.value && !submitting()) return
    event.preventDefault()
    event.returnValue = ''
  }
  window.addEventListener('beforeunload', beforeUnload)
  onBeforeUnmount(() => {
    unregister()
    window.removeEventListener('beforeunload', beforeUnload)
  })
  return { hasLocalDraftChanges: dirty, markSaved }
}

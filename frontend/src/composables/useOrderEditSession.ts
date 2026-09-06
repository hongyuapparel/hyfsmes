import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { getRouteTabKey, registerTabCloseGuard } from './useRouteCacheControl'

export function useOrderEditSession(form: object, fields: Ref<unknown>[], dirty: Ref<boolean>, skip: Ref<boolean>) {
  let saved = ''
  let discard = false
  const snapshot = () => JSON.stringify({ form, fields: fields.map(field => field.value) })
  watch([dirty, skip], ([changed, loading]) => {
    if (!changed && !loading) saved = snapshot()
  }, { immediate: true, flush: 'post' })
  function beforeUnload(event: BeforeUnloadEvent) {
    if (!dirty.value) return
    event.preventDefault()
    event.returnValue = ''
  }
  window.addEventListener('beforeunload', beforeUnload)
  onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
  async function confirmDiscard() {
    if (!dirty.value) return true
    try {
      await ElMessageBox.confirm('放弃本次未保存的修改？订单将恢复到上次保存的内容。', '取消编辑', {
        confirmButtonText: '放弃修改', cancelButtonText: '继续编辑', type: 'warning',
      })
      const data = JSON.parse(saved) as { form: object; fields: unknown[] }
      skip.value = true
      Object.assign(form, data.form)
      fields.forEach((field, index) => { field.value = data.fields[index] })
      await nextTick()
      dirty.value = false
      skip.value = false
      return true
    } catch { return false }
  }
  const unregister = registerTabCloseGuard(getRouteTabKey(useRoute()), confirmDiscard)
  onBeforeUnmount(unregister)
  onBeforeRouteLeave(async () => !discard || await confirmDiscard())
  async function cancel(navigate: () => Promise<unknown>) {
    discard = true
    try { await navigate() } finally { discard = false }
  }
  return { cancel }
}

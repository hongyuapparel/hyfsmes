import { type Ref, ref, watch, onUnmounted, nextTick } from 'vue'

export function useFlexShellTableHeight(
  shellRef: Ref<HTMLElement | null>,
  _options?: { tableRef?: Ref<unknown> },
) {
  const tableHeight = ref<number | undefined>(undefined)
  let observer: ResizeObserver | null = null

  function update() {
    if (shellRef.value) {
      tableHeight.value = shellRef.value.clientHeight
    }
  }

  watch(shellRef, (el) => {
    observer?.disconnect()
    observer = null
    if (el) {
      nextTick(() => {
        update()
        observer = new ResizeObserver(update)
        observer.observe(el)
      })
    } else {
      tableHeight.value = undefined
    }
  }, { immediate: true })

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
  })

  return { tableHeight }
}

import { type Ref, ref, onMounted, onUnmounted, nextTick } from 'vue'

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

  onMounted(() => {
    nextTick(() => {
      update()
      if (shellRef.value) {
        observer = new ResizeObserver(update)
        observer.observe(shellRef.value)
      }
    })
  })

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
  })

  return { tableHeight }
}

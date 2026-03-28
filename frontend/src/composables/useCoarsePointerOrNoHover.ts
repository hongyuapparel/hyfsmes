import { ref, onMounted, onBeforeUnmount } from 'vue'

function readCoarseOrNoHover(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches
  )
}

/**
 * 移动端/触摸或无法可靠 hover 的环境：用点击打开预览而非悬停浮层。
 */
export function useCoarsePointerOrNoHover() {
  const isCoarseOrNoHover = ref(readCoarseOrNoHover())
  let mqHover: MediaQueryList | null = null
  let mqPointer: MediaQueryList | null = null

  function update() {
    isCoarseOrNoHover.value = readCoarseOrNoHover()
  }

  onMounted(() => {
    mqHover = window.matchMedia('(hover: none)')
    mqPointer = window.matchMedia('(pointer: coarse)')
    update()
    mqHover.addEventListener('change', update)
    mqPointer.addEventListener('change', update)
  })

  onBeforeUnmount(() => {
    mqHover?.removeEventListener('change', update)
    mqPointer?.removeEventListener('change', update)
  })

  return { isCoarseOrNoHover }
}
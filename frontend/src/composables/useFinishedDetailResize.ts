import { onBeforeUnmount, ref } from 'vue'

const MIN_WIDTH = 760
const DEFAULT_WIDTH = 900
const MAX_MARGIN = 48
const STORAGE_KEY = 'inventory_finished_detail_drawer_width'

export function useFinishedDetailResize() {
  const drawerWidth = ref(DEFAULT_WIDTH)
  const rafId = ref<number | null>(null)
  const moveFn = ref<((event: MouseEvent) => void) | null>(null)
  const upFn = ref<(() => void) | null>(null)

  function maxWidth() {
    return Math.max(MIN_WIDTH, window.innerWidth - MAX_MARGIN)
  }

  function clampWidth(width: number) {
    return Math.min(Math.max(width, MIN_WIDTH), maxWidth())
  }

  function loadSavedWidth() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const width = Number(raw)
      return Number.isFinite(width) && width > 0 ? clampWidth(width) : DEFAULT_WIDTH
    } catch {
      return DEFAULT_WIDTH
    }
  }

  function saveWidth(width: number) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(clampWidth(width)))
    } catch {
      // 忽略 localStorage 不可用场景
    }
  }

  function stopResize() {
    if (moveFn.value) {
      window.removeEventListener('mousemove', moveFn.value)
      moveFn.value = null
    }
    if (upFn.value) {
      window.removeEventListener('mouseup', upFn.value)
      upFn.value = null
    }
    if (rafId.value != null) {
      window.cancelAnimationFrame(rafId.value)
      rafId.value = null
    }
    document.body.classList.remove('detail-drawer-resizing')
  }

  function startResize(event: MouseEvent) {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = drawerWidth.value
    let latestX = startX

    const onMove = (moveEvent: MouseEvent) => {
      latestX = moveEvent.clientX
      if (rafId.value != null) return
      rafId.value = window.requestAnimationFrame(() => {
        rafId.value = null
        drawerWidth.value = clampWidth(startWidth + (startX - latestX))
      })
    }
    const onUp = () => {
      stopResize()
      saveWidth(drawerWidth.value)
    }

    stopResize()
    moveFn.value = onMove
    upFn.value = onUp
    document.body.classList.add('detail-drawer-resizing')
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function resetWidthFromStorage() {
    drawerWidth.value = loadSavedWidth()
  }

  onBeforeUnmount(stopResize)

  return {
    drawerWidth,
    startResize,
    stopResize,
    resetWidthFromStorage,
  }
}

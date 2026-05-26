import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 统一的移动端断点判断（仅用于「手机适配」逻辑，桌面端行为不受影响）。
 * 断点与 design-system.css / app store 保持一致：max-width 768px。
 */
const MOBILE_QUERY = '(max-width: 768px)'

export function useIsMobile() {
  const isMobile = ref(
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(MOBILE_QUERY).matches
      : false,
  )

  let mql: MediaQueryList | null = null
  const handleChange = (e: MediaQueryListEvent) => {
    isMobile.value = e.matches
  }

  onMounted(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    mql = window.matchMedia(MOBILE_QUERY)
    isMobile.value = mql.matches
    mql.addEventListener('change', handleChange)
  })

  onBeforeUnmount(() => {
    mql?.removeEventListener('change', handleChange)
    mql = null
  })

  return { isMobile }
}

import { ref } from 'vue'

/**
 * 模块级移动端断点单例：供「纯函数工具」（如筛选宽度助手）零调用方改动地感知手机端。
 * 与 useIsMobile / design-system.css 断点保持一致：max-width 768px。
 * 组件内仍用 useIsMobile()（自带挂载/卸载生命周期）。
 */
const MOBILE_QUERY = '(max-width: 768px)'

function readMobile(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(MOBILE_QUERY).matches
  )
}

export const isMobileViewport = ref(readMobile())

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const mql = window.matchMedia(MOBILE_QUERY)
  const handleChange = (e: MediaQueryListEvent) => {
    isMobileViewport.value = e.matches
  }
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handleChange)
  } else {
    mql.addListener(handleChange)
  }
}

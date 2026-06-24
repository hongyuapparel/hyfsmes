import { ref, watch } from 'vue'
import { isMobileViewport } from './useViewport'

/**
 * 手机端筛选栏折叠状态（桌面端恒为展开）。
 * 折叠时保留第一行筛选项，隐藏其余项；状态按 storageKey 记在 localStorage。
 */
export function useFilterCollapse(storageKey = '', defaultCollapsed = true) {
  function readStored(): boolean | null {
    if (!storageKey) return null
    try {
      const raw = localStorage.getItem(`filter-collapse:${storageKey}`)
      if (raw === '1') return true
      if (raw === '0') return false
    } catch {
      // 存储不可用时按默认值
    }
    return null
  }

  const collapsed = ref(readStored() ?? defaultCollapsed)

  function toggle() {
    collapsed.value = !collapsed.value
  }

  watch(collapsed, (v) => {
    if (!storageKey) return
    try {
      localStorage.setItem(`filter-collapse:${storageKey}`, v ? '1' : '0')
    } catch {
      // 忽略写入失败
    }
  })

  return { collapsed, toggle, isMobile: isMobileViewport }
}

import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { systemUpdates, type SystemUpdate } from '@/data/updates'

const READ_KEY_PREFIX = 'erp_updates_read:'
const AUTO_OPEN_FLAG = 'erp_updates_auto_open'
const RECENT_DAYS = 7

function getReadKey(userId: number | string | undefined | null): string {
  return `${READ_KEY_PREFIX}${userId ?? 'anon'}`
}

function loadReadIds(userId: number | string | undefined | null): Set<string> {
  try {
    const raw = localStorage.getItem(getReadKey(userId))
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((x): x is string => typeof x === 'string'))
    }
  } catch {
    // ignore parse / storage errors
  }
  return new Set()
}

function saveReadIds(userId: number | string | undefined | null, ids: Set<string>): void {
  try {
    localStorage.setItem(getReadKey(userId), JSON.stringify([...ids]))
  } catch {
    // ignore quota / storage errors
  }
}

export function markPendingAutoOpen(): void {
  try {
    sessionStorage.setItem(AUTO_OPEN_FLAG, '1')
  } catch {
    // ignore
  }
}

export function useSystemUpdates() {
  const authStore = useAuthStore()
  const userId = computed<number | string | null>(() => authStore.user?.id ?? null)
  const readIds = ref<Set<string>>(loadReadIds(userId.value))

  watch(userId, (next) => {
    readIds.value = loadReadIds(next)
  })

  const recentUpdates = computed<SystemUpdate[]>(() => {
    const now = Date.now()
    const windowMs = RECENT_DAYS * 24 * 60 * 60 * 1000
    return systemUpdates
      .filter((u) => {
        const t = new Date(u.date).getTime()
        if (Number.isNaN(t)) return false
        return now - t <= windowMs
      })
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  })

  const unreadCount = computed<number>(
    () => recentUpdates.value.filter((u) => !readIds.value.has(u.id)).length,
  )

  function isUnread(id: string): boolean {
    return !readIds.value.has(id)
  }

  function markAllRead(): void {
    const next = new Set(readIds.value)
    recentUpdates.value.forEach((u) => next.add(u.id))
    readIds.value = next
    saveReadIds(userId.value, next)
  }

  function consumeAutoOpenFlag(): boolean {
    try {
      const v = sessionStorage.getItem(AUTO_OPEN_FLAG)
      if (v) {
        sessionStorage.removeItem(AUTO_OPEN_FLAG)
        return true
      }
    } catch {
      // ignore
    }
    return false
  }

  return {
    recentUpdates,
    unreadCount,
    isUnread,
    markAllRead,
    consumeAutoOpenFlag,
  }
}

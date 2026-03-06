import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as apiLogin, getMe, type MeRes } from '@/api/auth'
import { TOKEN_KEY } from '@/constants'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const user = ref<MeRes | null>(null)

  const isLoggedIn = computed(() => !!token.value)
  const permissionRoutes = computed(() => {
    const list = user.value?.permissions?.map((p) => p.routePath) ?? []
    return list as string[]
  })
  const permissionCodes = computed(() => {
    const list = user.value?.permissions?.map((p) => p.code) ?? []
    return list as string[]
  })

  function setToken(t: string) {
    token.value = t
    localStorage.setItem(TOKEN_KEY, t)
  }

  function clearAuth() {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
  }

  function isLikelyJwt(token: unknown): token is string {
    if (typeof token !== 'string' || !token) return false
    const parts = token.trim().split('.')
    return parts.length === 3 && parts.every((p) => p.length > 0)
  }

  async function login(username: string, password: string) {
    const res = await apiLogin(username, password)
    const token = res.data?.access_token
    if (!isLikelyJwt(token)) {
      throw new Error('后端返回异常（如数据库未连接），请确认后端已启动且数据库正常')
    }
    setToken(token)
    await fetchUser()
  }

  async function fetchUser() {
    if (!token.value) return
    try {
      const res = await getMe()
      user.value = res.data
      return res.data
    } catch {
      clearAuth()
      throw new Error('未登录或已过期')
    }
  }

  function logout() {
    clearAuth()
  }

  function hasRoutePermission(path: string): boolean {
    if (!permissionRoutes.value.length) return false
    return permissionRoutes.value.includes(path)
  }

  function hasPermission(code: string): boolean {
    if (!permissionCodes.value.length) return false
    return permissionCodes.value.includes(code)
  }

  return {
    token,
    user,
    isLoggedIn,
    permissionRoutes,
    permissionCodes,
    setToken,
    clearAuth,
    login,
    fetchUser,
    logout,
    hasRoutePermission,
    hasPermission,
  }
})

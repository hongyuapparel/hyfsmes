import axios, { type AxiosError } from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { TOKEN_KEY } from '@/constants'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 15000,
})

request.interceptors.request.use((config) => {
  const t = localStorage.getItem(TOKEN_KEY)
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

export function getErrorMessage(err: unknown, fallback = '操作失败'): string {
  if (err && typeof err === 'object' && 'userMessage' in err && typeof (err as { userMessage?: string }).userMessage === 'string') {
    return (err as { userMessage: string }).userMessage
  }
  const data = (err as AxiosError)?.response?.data as { message?: string | string[] } | undefined
  const msg = data?.message
  if (Array.isArray(msg)) return msg[0] ?? fallback
  if (typeof msg === 'string') return msg
  return fallback
}

/** 是否已由拦截器处理（避免重复提示） */
export function isErrorHandled(err: unknown): boolean {
  return !!(err && typeof err === 'object' && (err as { errorHandled?: boolean }).errorHandled)
}

function extractErrorMessage(err: AxiosError): string {
  const data = err.response?.data as { message?: string | string[] } | undefined
  const msg = data?.message
  if (Array.isArray(msg)) return msg[0] ?? '请求失败'
  if (typeof msg === 'string') return msg
  if (err.response?.status === 403) return '无权限访问'
  if (err.response?.status && err.response.status >= 500) return '服务器错误，请稍后重试'
  if (err.code === 'ERR_NETWORK' || !err.response) return '无法连接服务器，请检查网络或后端是否启动'
  return '操作失败'
}

request.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const msg = extractErrorMessage(err)
    ;(err as AxiosError & { userMessage?: string }).userMessage = msg

    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      const isLoginRequest = (err.config?.url ?? '').includes('/auth/login')
      if (!isLoginRequest) {
        router.push('/login')
        ElMessage.error('登录已过期，请重新登录')
      }
    } else {
      const status = err.response?.status
      const skip = (err.config as { skipGlobalErrorHandler?: boolean })?.skipGlobalErrorHandler
      const shouldShow = !skip && (status === 400 || status === 403 || (status != null && status >= 500) || !err.response)
      if (shouldShow) {
        ElMessage.error(msg)
        ;(err as AxiosError & { errorHandled?: boolean }).errorHandled = true
      }
    }

    return Promise.reject(err)
  }
)

export default request

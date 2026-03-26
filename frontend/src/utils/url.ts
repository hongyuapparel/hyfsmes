const ABSOLUTE_URL_RE = /^(?:https?:)?\/\//i
const SPECIAL_URL_RE = /^(?:data|blob):/i

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function getUploadBaseUrl(): string {
  const explicitBase = trimTrailingSlash((import.meta.env.VITE_UPLOAD_BASE_URL ?? '').trim())
  if (explicitBase) return explicitBase

  // 默认不加前缀，保持后端返回的 /uploads 路径，避免错误拼成 /api/uploads
  return ''
}

function looksLikeUploadPath(value: string): boolean {
  if (!value) return false
  if (ABSOLUTE_URL_RE.test(value) || SPECIAL_URL_RE.test(value)) return false
  const normalized = value.startsWith('/') ? value : `/${value}`
  return normalized.startsWith('/uploads/')
}

export function resolveAssetUrl(value: string): string {
  const url = String(value ?? '').trim()
  if (!url) return ''
  if (ABSOLUTE_URL_RE.test(url) || SPECIAL_URL_RE.test(url)) return url

  const normalized = url.startsWith('/') ? url : `/${url}`
  const baseUrl = getUploadBaseUrl()
  if (!baseUrl) return normalized
  if (baseUrl.startsWith('/') && (normalized === baseUrl || normalized.startsWith(`${baseUrl}/`))) {
    return normalized
  }

  return `${baseUrl}${normalized}`
}

export function normalizeUploadUrlsDeep<T>(input: T): T {
  if (typeof input === 'string' && looksLikeUploadPath(input)) {
    return resolveAssetUrl(input) as T
  }
  return input
}

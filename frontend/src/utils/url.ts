const ABSOLUTE_URL_RE = /^(?:https?:)?\/\//i
const SPECIAL_URL_RE = /^(?:data|blob):/i

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function getUploadBaseUrl(): string {
  const explicitBase = trimTrailingSlash((import.meta.env.VITE_UPLOAD_BASE_URL ?? '').trim())
  if (explicitBase) return explicitBase

  // Keep uploads on the same proxy prefix as API so production can route
  // static files through `/api -> backend` even when `/uploads` is not exposed.
  return trimTrailingSlash((import.meta.env.VITE_API_BASE_URL || '/api').trim())
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
  if (typeof input === 'string') {
    return (looksLikeUploadPath(input) ? resolveAssetUrl(input) : input) as T
  }

  if (Array.isArray(input)) {
    for (let i = 0; i < input.length; i += 1) {
      input[i] = normalizeUploadUrlsDeep(input[i])
    }
    return input
  }

  if (!input || typeof input !== 'object') return input

  const record = input as Record<string, unknown>
  for (const key of Object.keys(record)) {
    record[key] = normalizeUploadUrlsDeep(record[key])
  }
  return input
}

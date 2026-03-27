const ABSOLUTE_URL_RE = /^(?:https?:)?\/\//i
const SPECIAL_URL_RE = /^(?:data|blob):/i
const LEGACY_ASSET_HOST_RE = /^https?:\/\/47\.112\.218\.75(?::\d+)?(?=\/|$)/i
const LEGACY_ASSET_HOST_GLOBAL_RE = /https?:\/\/47\.112\.218\.75(?::\d+)?(?=\/|$)/gi

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function getUploadBaseUrl(): string {
  const explicitBase = trimTrailingSlash((import.meta.env.VITE_UPLOAD_BASE_URL ?? '').trim())
  if (explicitBase) return explicitBase

  // 默认不加前缀，保持后端返回的 /uploads 路径，避免错误拼成 /api/uploads
  return ''
}

function normalizeLegacyAbsoluteAssetUrl(value: string): string {
  const url = String(value ?? '').trim()
  if (!url) return ''
  if (!LEGACY_ASSET_HOST_RE.test(url)) return url
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/'
  } catch {
    return url.replace(LEGACY_ASSET_HOST_RE, '') || '/'
  }
}

function looksLikeAssetPath(value: string): boolean {
  if (!value) return false
  if (SPECIAL_URL_RE.test(value)) return false
  if (LEGACY_ASSET_HOST_RE.test(value)) return true
  if (ABSOLUTE_URL_RE.test(value)) return false
  const normalized = value.startsWith('/') ? value : `/${value}`
  return (
    normalized.startsWith('/uploads/')
    || normalized.startsWith('/Public/')
    || normalized.startsWith('/migration-old/')
  )
}

export function resolveAssetUrl(value: string): string {
  const source = String(value ?? '').trim()
  if (!source) return ''
  if (SPECIAL_URL_RE.test(source)) return source

  const url = normalizeLegacyAbsoluteAssetUrl(source)
  if (!url) return ''
  if (ABSOLUTE_URL_RE.test(url)) return url

  const normalized = url.startsWith('/') ? url : `/${url}`
  const baseUrl = getUploadBaseUrl()
  if (!baseUrl) return normalized
  if (baseUrl.startsWith('/') && (normalized === baseUrl || normalized.startsWith(`${baseUrl}/`))) {
    return normalized
  }

  return `${baseUrl}${normalized}`
}

export function normalizeUploadUrlsDeep<T>(input: T): T {
  const seen = new WeakSet<object>()
  return normalizeUploadUrlsDeepInternal(input, seen)
}

function normalizeUploadUrlsDeepInternal<T>(input: T, seen: WeakSet<object>): T {
  if (typeof input === 'string') {
    const normalizedText = input.replace(LEGACY_ASSET_HOST_GLOBAL_RE, '')
    return (looksLikeAssetPath(normalizedText) ? resolveAssetUrl(normalizedText) : normalizedText) as T
  }
  if (input == null || typeof input !== 'object') return input
  if (seen.has(input as object)) return input

  seen.add(input as object)
  if (Array.isArray(input)) {
    for (let i = 0; i < input.length; i += 1) {
      input[i] = normalizeUploadUrlsDeepInternal(input[i], seen)
    }
    return input
  }

  const obj = input as Record<string, unknown>
  Object.keys(obj).forEach((key) => {
    obj[key] = normalizeUploadUrlsDeepInternal(obj[key], seen)
  })
  return input
}

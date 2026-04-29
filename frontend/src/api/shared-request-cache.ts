import type { AxiosResponse } from 'axios'

type CacheLeaf = string | number | boolean | null

interface CacheObject {
  [key: string]: CacheValue | undefined
}

type CacheValue = CacheLeaf | CacheObject | CacheValue[]

interface CachedEntry<T> {
  expiresAt: number
  value: T
}

export interface SharedRequestCacheOptions {
  ttlMs?: number
}

const resolvedCache = new Map<string, CachedEntry<unknown>>()
const pendingCache = new Map<string, Promise<unknown>>()

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
}

function normalizeCacheValue(value: unknown): CacheValue | undefined {
  if (value === undefined) return undefined
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value as CacheLeaf
  }
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) {
    return value.map((item) => normalizeCacheValue(item) ?? null)
  }
  if (isPlainObject(value)) {
    const normalized: CacheObject = {}
    for (const key of Object.keys(value).sort()) {
      const next = normalizeCacheValue(value[key])
      if (next !== undefined) normalized[key] = next
    }
    return normalized
  }
  return String(value)
}

function stableStringify(value: CacheValue | undefined): string {
  if (value === undefined) return 'undefined'
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`
}

export function buildSharedGetKey(url: string, params?: unknown, extra?: unknown): string {
  return [url, stableStringify(normalizeCacheValue(params)), stableStringify(normalizeCacheValue(extra))].join('::')
}

export function sharedGet<T>(
  key: string,
  loader: () => Promise<AxiosResponse<T>>,
  options?: SharedRequestCacheOptions,
): Promise<AxiosResponse<T>> {
  const ttlMs = options?.ttlMs ?? 0
  const cached = resolvedCache.get(key) as CachedEntry<AxiosResponse<T>> | undefined
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value)
  }

  const pending = pendingCache.get(key) as Promise<AxiosResponse<T>> | undefined
  if (pending) return pending

  const promise = loader().then((response) => {
    if (ttlMs > 0) {
      resolvedCache.set(key, {
        value: response,
        expiresAt: Date.now() + ttlMs,
      })
    }
    return response
  })

  pendingCache.set(key, promise)

  return promise.finally(() => {
    if (pendingCache.get(key) === promise) {
      pendingCache.delete(key)
    }
  })
}

export function invalidateSharedGetCache(prefix?: string): void {
  if (!prefix) {
    resolvedCache.clear()
    pendingCache.clear()
    return
  }

  for (const key of resolvedCache.keys()) {
    if (key.startsWith(prefix)) {
      resolvedCache.delete(key)
    }
  }

  for (const key of pendingCache.keys()) {
    if (key.startsWith(prefix)) {
      pendingCache.delete(key)
    }
  }
}

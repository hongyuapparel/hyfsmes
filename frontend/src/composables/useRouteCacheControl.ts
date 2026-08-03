import { reactive } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

export const OUTER_ROUTE_CACHE_MAX = 4
export const INNER_ROUTE_CACHE_MAX = 8

export interface RouteCacheDropTarget {
  key: string
  fullPath: string
  path: string
}

const routeCacheVersions = reactive<Record<string, number>>({})

function normalizeKey(value: unknown): string {
  return String(value ?? '').trim()
}

export function getRouteTabKey(route: RouteLocationNormalizedLoaded): string {
  const tabKey = normalizeKey(route.query?.tabKey)
  return tabKey || route.path
}

function getRouteVersion(...keys: string[]): string {
  return keys.map((key) => routeCacheVersions[key] ?? 0).join('.')
}

function getReusableQueryBaseKey(route: RouteLocationNormalizedLoaded): string {
  const reusableKeys = Array.isArray(route.meta?.reuseQueryKeys)
    ? route.meta.reuseQueryKeys.map(normalizeKey).filter(Boolean)
    : []
  if (!reusableKeys.length) return route.fullPath

  const ignoredKeys = new Set(reusableKeys)
  const search = new URLSearchParams()
  Object.entries(route.query ?? {})
    .filter(([key]) => !ignoredKeys.has(key) && key !== 'tabKey')
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([key, value]) => {
      const values = Array.isArray(value) ? value : [value]
      values.forEach((item) => {
        if (item != null) search.append(key, String(item))
      })
    })
  const query = search.toString()
  return query ? `${route.path}?${query}` : route.path
}

export function markRouteCacheDropped(target: RouteCacheDropTarget): void {
  const keys = new Set([target.key, target.fullPath, target.path].map(normalizeKey).filter(Boolean))
  keys.forEach((key) => {
    routeCacheVersions[key] = (routeCacheVersions[key] ?? 0) + 1
  })
}

export function getOuterRouteCacheKey(route: RouteLocationNormalizedLoaded): string {
  const groupKey = normalizeKey(route.matched[1]?.path) || route.path
  return `${groupKey}::${getRouteVersion(groupKey, route.path)}`
}

export function getInnerRouteCacheKey(route: RouteLocationNormalizedLoaded): string {
  const tabKey = normalizeKey(route.query?.tabKey)
  if (tabKey) {
    return `${tabKey}::${getRouteVersion(tabKey, route.path, route.fullPath, tabKey)}`
  }
  const baseKey = getReusableQueryBaseKey(route)
  return `${baseKey}::${getRouteVersion(baseKey, route.path, route.fullPath, tabKey)}`
}

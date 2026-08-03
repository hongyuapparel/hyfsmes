import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { getInnerRouteCacheKey, markRouteCacheDropped } from './useRouteCacheControl'

function makeRoute(
  fullPath: string,
  options: { reuseQueryKeys?: string[]; query?: Record<string, unknown> } = {},
): RouteLocationNormalizedLoaded {
  const query = options.query ?? Object.fromEntries(new URLSearchParams(fullPath.split('?')[1] ?? ''))
  return {
    path: '/orders/list',
    fullPath,
    query,
    meta: { reuseQueryKeys: options.reuseQueryKeys },
  } as unknown as RouteLocationNormalizedLoaded
}

describe('inner route cache key', () => {
  it('reuses the order-list instance only when the unquoted shortcut changes', () => {
    const normal = makeRoute('/orders/list', { reuseQueryKeys: ['unquoted'] })
    const unquoted = makeRoute('/orders/list?unquoted=1', { reuseQueryKeys: ['unquoted'] })

    expect(getInnerRouteCacheKey(unquoted)).toBe(getInnerRouteCacheKey(normal))
  })

  it.each([
    '/orders/list?status=pending_review',
    '/orders/list?merchandiser=Andy',
    '/orders/list?customerDueStart=2026-08-03&customerDueEnd=2026-08-10',
  ])('isolates business filter query %s', (fullPath) => {
    const normal = makeRoute('/orders/list', { reuseQueryKeys: ['unquoted'] })
    const filtered = makeRoute(fullPath, { reuseQueryKeys: ['unquoted'] })

    expect(getInnerRouteCacheKey(filtered)).not.toBe(getInnerRouteCacheKey(normal))
  })

  it('normalizes query order before building a reusable key', () => {
    const first = makeRoute('/orders/list?status=completed&unquoted=1&merchandiser=Andy', {
      reuseQueryKeys: ['unquoted'],
      query: { status: 'completed', unquoted: '1', merchandiser: 'Andy' },
    })
    const second = makeRoute('/orders/list?merchandiser=Andy&status=completed', {
      reuseQueryKeys: ['unquoted'],
      query: { merchandiser: 'Andy', status: 'completed' },
    })

    expect(getInnerRouteCacheKey(first)).toBe(getInnerRouteCacheKey(second))
  })

  it('still gives explicit tab instances their own cache keys', () => {
    const first = makeRoute('/orders/list?tabKey=first', {
      reuseQueryKeys: ['unquoted'],
      query: { tabKey: 'first' },
    })
    const second = makeRoute('/orders/list?tabKey=second', {
      reuseQueryKeys: ['unquoted'],
      query: { tabKey: 'second' },
    })

    expect(getInnerRouteCacheKey(first)).not.toBe(getInnerRouteCacheKey(second))
  })

  it('invalidates both normal and unquoted variants when the route cache is dropped', () => {
    const normal = makeRoute('/orders/list', { reuseQueryKeys: ['unquoted'] })
    const unquoted = makeRoute('/orders/list?unquoted=1', { reuseQueryKeys: ['unquoted'] })
    const previousKey = getInnerRouteCacheKey(normal)

    markRouteCacheDropped({
      key: '/orders/list?unquoted=1',
      fullPath: '/orders/list?unquoted=1',
      path: '/orders/list',
    })

    expect(getInnerRouteCacheKey(unquoted)).toBe(getInnerRouteCacheKey(normal))
    expect(getInnerRouteCacheKey(normal)).not.toBe(previousKey)
  })
})

import { effectScope, nextTick, reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { useOrderCostRouteIdentity } from './useOrderCostRouteIdentity'

function makeRoute(id: number, tabKey: string) {
  return reactive({
    path: `/orders/cost/${id}`,
    fullPath: `/orders/cost/${id}?tabKey=${tabKey}`,
    params: { id: String(id) },
    query: { tabKey },
    meta: {},
  }) as unknown as RouteLocationNormalizedLoaded
}

describe('order cost route identity', () => {
  it('does not update a cached cost page when another tab becomes active', async () => {
    const route = makeRoute(101, 'orders-cost-101')
    const scope = effectScope()
    const firstOrderId = scope.run(() => useOrderCostRouteIdentity(route))
    if (!firstOrderId) throw new Error('route identity unavailable')

    route.path = '/orders/cost/202'
    route.params.id = '202'
    route.query.tabKey = 'orders-cost-202'
    await nextTick()

    expect(firstOrderId.value).toBe(101)
    scope.stop()
  })

  it('updates the active instance when the quote queue reuses the same tab', async () => {
    const route = makeRoute(101, 'orders-cost-101')
    const scope = effectScope()
    const orderId = scope.run(() => useOrderCostRouteIdentity(route))
    if (!orderId) throw new Error('route identity unavailable')

    route.path = '/orders/cost/102'
    route.params.id = '102'
    await nextTick()

    expect(orderId.value).toBe(102)
    scope.stop()
  })
})

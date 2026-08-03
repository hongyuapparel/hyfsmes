import { effectScope, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const routing = vi.hoisted(() => ({
  route: { path: '/orders/list', query: {} as Record<string, unknown> },
  push: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => routing.route,
  useRouter: () => ({ push: routing.push, replace: routing.replace }),
}))

import { useOrderListQuoteQueue } from './useOrderListQuoteQueue'

function createQueueState(status = 'all', active = false) {
  const currentStatus = ref(status)
  const unquoted = ref(active)
  const pagination = { page: 4 }
  const load = vi.fn().mockResolvedValue(undefined)
  const scope = effectScope()
  const queue = scope.run(() => useOrderListQuoteQueue({
    currentStatus,
    unquoted,
    pagination,
    resetCardScroll: vi.fn(),
    resetSelection: vi.fn(),
    load,
    getCurrentQuery: () => ({ status: currentStatus.value }),
    openCost: vi.fn(),
  }))
  if (!queue) throw new Error('queue composable unavailable')
  return { currentStatus, unquoted, pagination, load, queue, scope }
}

describe('order list quote queue state', () => {
  beforeEach(() => {
    routing.route.query = {}
    routing.push.mockReset()
    routing.replace.mockReset()
  })

  it('does not overwrite a normal completed filter when the queue is already inactive', async () => {
    const state = createQueueState('completed', false)
    await state.queue.applyUnquotedState(false, { syncRoute: false, reload: false })
    expect(state.currentStatus.value).toBe('completed')
    state.scope.stop()
  })

  it('restores the previous status after toggling the queue off', async () => {
    const state = createQueueState('pending_review', false)
    await state.queue.applyUnquotedState(true, { syncRoute: false, reload: false })
    expect(state.currentStatus.value).toBe('completed')
    expect(state.unquoted.value).toBe(true)

    await state.queue.applyUnquotedState(false, { syncRoute: false, reload: false })
    expect(state.currentStatus.value).toBe('pending_review')
    expect(state.unquoted.value).toBe(false)
    state.scope.stop()
  })

  it('keeps the user-selected status when that action exits the queue', async () => {
    const state = createQueueState('all', false)
    await state.queue.applyUnquotedState(true, { syncRoute: false, reload: false })
    state.currentStatus.value = 'in_production'

    await expect(state.queue.exitUnquotedForStatusChange()).resolves.toBe(true)
    expect(state.currentStatus.value).toBe('in_production')
    expect(state.unquoted.value).toBe(false)
    state.scope.stop()
  })

  it('waits for route removal before loading the normal list', async () => {
    const events: string[] = []
    routing.route.query = { unquoted: '1' }
    routing.replace.mockImplementation(async () => {
      events.push('route')
    })
    const state = createQueueState('completed', true)
    state.load.mockImplementation(async () => {
      events.push('load')
    })

    await state.queue.toggleUnquoted()

    expect(events).toEqual(['route', 'load'])
    expect(routing.replace).toHaveBeenCalledWith({ path: '/orders/list', query: {} })
    expect(state.unquoted.value).toBe(false)
    expect(state.currentStatus.value).toBe('all')
    expect(state.queue.quoteQueueSwitching.value).toBe(false)
    state.scope.stop()
  })

  it('adds a history entry when entering so browser back can restore the prior list', async () => {
    routing.push.mockResolvedValue(undefined)
    const state = createQueueState('pending_review', false)

    await state.queue.toggleUnquoted()

    expect(routing.push).toHaveBeenCalledWith({
      path: '/orders/list',
      query: { unquoted: '1' },
    })
    expect(routing.replace).not.toHaveBeenCalled()
    expect(state.currentStatus.value).toBe('completed')
    expect(state.unquoted.value).toBe(true)
    state.scope.stop()
  })

  it('ignores a second toggle while the first route transition is unfinished', async () => {
    let finishRoute!: () => void
    routing.push.mockReturnValue(new Promise<void>((resolve) => {
      finishRoute = resolve
    }))
    const state = createQueueState('all', false)

    const firstToggle = state.queue.toggleUnquoted()
    const secondToggle = state.queue.toggleUnquoted()

    expect(state.queue.quoteQueueSwitching.value).toBe(true)
    expect(routing.push).toHaveBeenCalledTimes(1)
    finishRoute()
    await Promise.all([firstToggle, secondToggle])
    expect(state.unquoted.value).toBe(true)
    expect(state.load).toHaveBeenCalledTimes(1)
    state.scope.stop()
  })
})

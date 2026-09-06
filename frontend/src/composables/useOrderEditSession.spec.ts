import { defineComponent, nextTick, reactive, ref, watch } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOrderEditSession } from './useOrderEditSession'
import { canCloseTab } from './useRouteCacheControl'

const mocks = vi.hoisted(() => ({ guard: undefined as undefined | (() => Promise<boolean>), confirm: vi.fn() }))
vi.mock('element-plus', () => ({ ElMessageBox: { confirm: mocks.confirm } }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/orders/edit/1', query: { tabKey: 'edit-1' } }),
  onBeforeRouteLeave: (guard: () => Promise<boolean>) => { mocks.guard = guard },
}))

describe('order cancellation and cached tabs', () => {
  beforeEach(() => { mocks.confirm.mockReset(); mocks.confirm.mockResolvedValue('confirm') })
  function setup() {
    const form = reactive({ sku: '' })
    const rows = ref<string[]>([])
    const dirty = ref(false)
    const skip = ref(false)
    let session: ReturnType<typeof useOrderEditSession>
    const wrapper = mount(defineComponent({ setup() {
      watch([form, rows], () => { if (!skip.value) dirty.value = true }, { deep: true })
      session = useOrderEditSession(form, [rows], dirty, skip)
      return () => null
    } }))
    return { form, rows, dirty, skip, wrapper, cancel: () => session.cancel(async () => mocks.guard?.()) }
  }
  it('restores server-loaded baseline after cancelling and supports reopening cached state', async () => {
    const s = setup()
    s.skip.value = true; s.form.sku = 'SKU1'; s.rows.value = ['胸围']; await nextTick()
    s.skip.value = false; await nextTick()
    s.form.sku = 'wrong'; s.rows.value.push('wrong paste'); await nextTick()
    await s.cancel()
    expect(s.form.sku).toBe('SKU1'); expect(s.rows.value).toEqual(['胸围']); expect(s.dirty.value).toBe(false)
    s.wrapper.unmount()
  })
  it('retains edits on tab switch and on rejected cancellation', async () => {
    const s = setup()
    s.form.sku = 'editing'; await nextTick()
    expect(await mocks.guard?.()).toBe(true)
    expect(mocks.confirm).not.toHaveBeenCalled()
    mocks.confirm.mockRejectedValue('cancel')
    await s.cancel(); expect(s.form.sku).toBe('editing'); expect(s.dirty.value).toBe(true)
    expect(await canCloseTab('edit-1')).toBe(false)
    s.wrapper.unmount()
  })
  it('restores latest saved content and guards closing an inactive tab', async () => {
    const s = setup()
    s.form.sku = 'saved'; await nextTick(); s.dirty.value = false; await nextTick()
    s.form.sku = 'wrong'; await nextTick()
    expect(await canCloseTab('edit-1')).toBe(true)
    expect(s.form.sku).toBe('saved')
    s.wrapper.unmount()
  })
})

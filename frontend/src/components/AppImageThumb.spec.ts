import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import AppImageThumb from './AppImageThumb.vue'

const pointer = vi.hoisted(() => ({ value: false }))
vi.mock('@/composables/useCoarsePointerOrNoHover', () => ({ useCoarsePointerOrNoHover: () => ({ isCoarseOrNoHover: pointer }) }))
let wrapper: VueWrapper | undefined
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })
const src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'
async function show(props: Record<string, unknown>) {
  wrapper = mount(AppImageThumb, { props: { src, ...props }, attachTo: document.body, global: { plugins: [ElementPlus] } })
  await flushPromises()
  return wrapper
}
describe.each([false, true])('thumbnail loading with coarse pointer %s', (coarse) => {
  it('dialog creates the image without a visibility callback and switches its source', async () => {
    pointer.value = coarse
    const view = await show({ variant: 'dialog' })
    expect(view.find('img').attributes('src')).toBe(src)
    await view.setProps({ src: src + '#second' })
    await flushPromises()
    expect(view.find('img').attributes('src')).toBe(src + '#second')
  })
  it('table keeps deferred loading before visibility is reported', async () => {
    pointer.value = coarse
    const view = await show({ variant: 'table' })
    expect(view.find('img').exists()).toBe(false)
  })
  it('explicit lazy setting remains supported', async () => {
    pointer.value = coarse
    const view = await show({ variant: 'dialog', lazy: true })
    expect(view.find('img').exists()).toBe(false)
  })
})

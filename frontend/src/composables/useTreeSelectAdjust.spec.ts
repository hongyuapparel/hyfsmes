import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { useTreeSelectAdjust } from './useTreeSelectAdjust'

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

it('跳过缓存的隐藏面板，并在切换实例后调整当前可见面板', () => {
  vi.useFakeTimers()
  const panels = [false, true].map((visible) => {
    const panel = document.createElement('div')
    panel.className = 'test-tree-popper el-popper'
    panel.innerHTML = '<div class="el-tree"><div class="el-tree-node__content"><span class="el-select-dropdown__item">修改版</span></div></div>'
    let shown = visible
    Object.defineProperty(panel, 'getClientRects', { value: () => shown ? [{}] : [] })
    document.body.append(panel)
    return { panel, show: (value: boolean) => { shown = value } }
  })
  let adjust!: (name: string) => void
  const wrapper = mount(defineComponent({
    setup() { adjust = useTreeSelectAdjust().adjustTreePopperWidth; return () => null },
  }))
  adjust('test-tree-popper')
  vi.advanceTimersByTime(0)
  expect(panels[0].panel.style.width).toBe('')
  expect(panels[1].panel.style.width).not.toBe('')
  panels[0].show(true)
  panels[1].show(false)
  panels[1].panel.style.width = ''
  adjust('test-tree-popper')
  vi.advanceTimersByTime(0)
  expect(panels[0].panel.style.width).not.toBe('')
  expect(panels[1].panel.style.width).toBe('')
  wrapper.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

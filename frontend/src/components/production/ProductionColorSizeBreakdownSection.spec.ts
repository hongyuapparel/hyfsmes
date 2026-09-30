import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProductionColorSizeBreakdownSection from './ProductionColorSizeBreakdownSection.vue'

describe('生产明细颜色图片', () => {
  it('每个颜色显示自己的图片，调整行顺序后仍正确，无图不拿其他颜色代替', async () => {
    const wrapper = mount(ProductionColorSizeBreakdownSection, {
      props: { sizeHeaders: ['S'], totals: [], stages: [], colorRows: [
        { colorName: '蓝色', imageUrl: '/blue.png' }, { colorName: '红色', imageUrl: '/red.png' },
      ] },
      global: { stubs: { AppImageThumb: { props: ['rawUrl'], template: '<img :src="rawUrl" />' } } },
    })
    const read = () => wrapper.findAll('.color-bd-color-name').map(block => ({
      color: block.text(), image: block.find('img').exists() ? block.find('img').attributes('src') : null,
    }))
    expect(read()).toEqual([{ color: '蓝色', image: '/blue.png' }, { color: '红色', image: '/red.png' }])
    await wrapper.setProps({ colorRows: [{ colorName: '红色', imageUrl: '/red.png' }, { colorName: '蓝色' }] })
    expect(read()).toEqual([{ color: '红色', image: '/red.png' }, { color: '蓝色', image: null }])
    wrapper.unmount()
  })
})

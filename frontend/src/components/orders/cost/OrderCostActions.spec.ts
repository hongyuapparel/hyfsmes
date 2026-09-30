import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import OrderCostActions from './OrderCostActions.vue'

let wrapper: VueWrapper | undefined
afterEach(() => { wrapper?.unmount() })
function show(props: Partial<InstanceType<typeof OrderCostActions>['$props']> = {}) {
  wrapper = mount(OrderCostActions, {
    props: { total: 63, price: 70, margin: 0.1, disabled: false, saving: false, confirming: false, isQuoteQueue: false, ...props },
    global: { plugins: [ElementPlus] },
  })
  return wrapper
}

describe('order cost header actions', () => {
  it('shows unit cost and suggested price, and sends the existing save/confirm events', async () => {
    const view = show()
    expect(view.text()).toContain('单件成本 63 元')
    expect(view.text()).toContain('建议出厂单价 70 元')
    const buttons = view.findAll('.cost-quote-actions button')
    expect(buttons.map((button) => button.text())).toEqual(['保存草稿', '确认报价'])
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    expect(view.emitted('save')).toEqual([[]])
    expect(view.emitted('confirm')).toEqual([['stay']])
  })

  it('retains percentage conversion and input bounds', async () => {
    const view = show()
    const input = view.findComponent({ name: 'ElInputNumber' })
    expect(input.props()).toMatchObject({ modelValue: 10, min: 0, max: 99, precision: 2 })
    input.vm.$emit('update:modelValue', 15)
    input.vm.$emit('update:modelValue', undefined)
    expect(view.emitted('update:margin')).toEqual([[0.15], [0]])
    await view.setProps({ total: 85, price: 100, margin: 0.15 })
    expect(view.text()).toContain('建议出厂单价 100 元')
    expect(input.props('modelValue')).toBe(15)
  })

  it('retains both quotation queue actions', async () => {
    const view = show({ isQuoteQueue: true })
    const buttons = view.findAll('.cost-quote-actions button')
    expect(buttons.map((button) => button.text())).toEqual(['保存草稿', '确认并返回列表', '确认并处理下一条'])
    await buttons[1].trigger('click')
    await buttons[2].trigger('click')
    expect(view.emitted('confirm')).toEqual([['return'], ['next']])
  })

  it.each(['disabled', 'saving', 'confirming'] as const)('locks editing and submission while %s', async (state) => {
    const view = show({ [state]: true })
    expect(view.find('fieldset').attributes('disabled')).toBeDefined()
    expect(view.find('fieldset').attributes('inert')).toBeDefined()
    for (const button of view.findAll('.cost-quote-actions button')) {
      expect(button.attributes('disabled') !== undefined || button.classes().includes('is-loading')).toBe(true)
      await button.trigger('click')
    }
    expect(view.emitted('save')).toBeUndefined()
    expect(view.emitted('confirm')).toBeUndefined()
  })
})

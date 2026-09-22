import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import OrderCostSummary from './OrderCostSummary.vue'

let wrapper: VueWrapper | undefined
afterEach(() => { wrapper?.unmount() })
function show(ready: boolean) {
  wrapper = mount(OrderCostSummary, {
    props: { order: null, notice: '尚未确认报价', ready },
    slots: { heading: '<span>订单成本</span>', default: '<button>保存草稿</button>' },
    global: { stubs: { AppImageThumb: true } },
  })
  return wrapper
}

describe('compact order cost summary', () => {
  it('keeps navigation visible without exposing data or actions before loading succeeds', () => {
    const view = show(false)
    expect(view.text()).toBe('订单成本')
    expect(view.find('.cost-order-image').exists()).toBe(false)
    expect(view.find('.cost-order-info').exists()).toBe(false)
    expect(view.find('button').exists()).toBe(false)
  })

  it('shows the heading, quote notice, details and actions once ready', async () => {
    const view = show(false)
    await view.setProps({ ready: true })
    expect(view.find('.cost-summary-heading').text()).toContain('尚未确认报价')
    expect(view.find('.cost-order-info').text()).toContain('订单数量：0 件')
    expect(view.find('.cost-order-actions button').text()).toBe('保存草稿')
    expect(view.findComponent({ name: 'AppImageThumb' }).props()).toMatchObject({ width: 48, height: 48 })
  })

  it('hides previous details and actions when returning to a loading or failed state', async () => {
    const view = show(true)
    await view.setProps({ ready: false })
    expect(view.text()).toBe('订单成本')
    expect(view.find('.cost-order-actions').exists()).toBe(false)
  })
})

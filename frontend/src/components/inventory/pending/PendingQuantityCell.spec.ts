import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { PendingListItem } from '@/api/inventory'
import PendingQuantityCell from './PendingQuantityCell.vue'

function render(status: PendingListItem['detailStatus'], shipped: boolean) {
  const row: PendingListItem = { id: 1, orderId: 1, orderNo: 'QA', skuCode: 'QA', customerName: '',
    imageUrl: '', quantity: 5, createdAt: '', colorSizeSnapshot: null, detailStatus: status }
  return shallowMount(PendingQuantityCell, { props: { row, shipped }, global: {
    stubs: { ElButton: true, ElPopover: { template: '<div><slot /></div>' }, ElTag: { template: '<span><slot /></span>' } },
  } })
}
describe('待仓数量明细来源说明', () => {
  it('历史发货未确认原因时不声称用户漏填，不要求补录', () => {
    const wrapper = render('unknown', true)
    expect(wrapper.text()).toContain('无法确认是否原本不分尺码')
    expect(wrapper.text()).not.toContain('未留存')
    expect(wrapper.text()).not.toContain('补录')
    wrapper.unmount()
  })
  it('有依据的不分尺码状态不描述成缺失', () => {
    const wrapper = render('not_applicable', true)
    expect(wrapper.text()).toContain('无尺码维度，仅记录总数')
    wrapper.unmount()
  })
  it('真正缺失的待处理批次仍提示纠错补录', () => {
    const wrapper = render('missing', false)
    expect(wrapper.text()).toContain('明细待补')
    expect(wrapper.text()).toContain('补录')
    wrapper.unmount()
  })
})

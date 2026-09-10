import { shallowMount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AccessoriesOutboundTab from './AccessoriesOutboundTab.vue'

const api = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/api/inventory', () => ({ getAccessoryOutboundRecords: api.list }))
vi.mock('@/composables/useFlexShellTableHeight', () => ({ useFlexShellTableHeight: () => ({ tableHeight: ref(500) }) }))
vi.mock('@/composables/useTableColumnWidthPersist', () => ({ useTableColumnWidthPersist: () => ({ restoreColumnWidths: vi.fn() }) }))

function setup(active = true, renderNames = false) {
  return shallowMount(AccessoriesOutboundTab, { props: { active }, global: {
    directives: { loading: () => {} },
    stubs: {
      ElInput: { name: 'ElInput', props: ['modelValue', 'size'], template: '<input />' },
      ElOption: true, ElSelect: true, ElButton: true,
      ElTableColumn: renderNames ? { props: ['prop'], inject: ['rows'], template: '<div v-if="prop === \'accessoryName\'"><slot v-for="row in rows()" :row="row" /></div>' } : true,
      ElForm: { template: '<form><slot /></form>' },
      ElDatePicker: { name: 'ElDatePicker', props: ['modelValue', 'size'], template: '<input />' },
      ElTable: { name: 'ElTable', props: ['data'], provide() { return { rows: () => this.data } }, template: renderNames ? '<div><slot /></div>' : '<div />' },
    },
  } })
}
beforeEach(() => { api.list.mockReset(); api.list.mockResolvedValue({ data: { list: [{ id: 1 }], total: 100 } }) })

describe('辅料出库记录页签刷新', () => {
  it('展示保存的名称，重新进入后显示新名称；没有关联名称时不伪造', async () => {
    api.list.mockResolvedValue({ data: { list: [{ id: 1, accessoryName: '旧吊牌名' }, { id: 2, accessoryName: null }], total: 2 } })
    const wrapper = setup(true, true); await flushPromises()
    expect(wrapper.text()).toContain('旧吊牌名')
    expect(wrapper.text()).toContain('名称不可用')
    await wrapper.setProps({ active: false })
    api.list.mockResolvedValue({ data: { list: [{ id: 1, accessoryName: '新吊牌名' }], total: 1 } })
    await wrapper.setProps({ active: true }); await flushPromises()
    expect(wrapper.text()).toContain('新吊牌名')
    expect(wrapper.text()).not.toContain('旧吊牌名')
    wrapper.unmount()
  })
  it('返回记录页读取最新记录，保留日期、关键词和页码', async () => {
    const wrapper = setup(); await flushPromises()
    const keyword = wrapper.findComponent({ name: 'ElInput' })
    const date = wrapper.findComponent({ name: 'ElDatePicker' })
    keyword.vm.$emit('update:modelValue', 'QA')
    date.vm.$emit('update:modelValue', ['2026-09-01', '2026-09-08'])
    wrapper.findComponent({ name: 'AppPaginationBar' }).vm.$emit('update:currentPage', 2)
    await wrapper.setProps({ active: false })
    expect(api.list).toHaveBeenCalledTimes(1)
    api.list.mockResolvedValue({ data: { list: [{ id: 2 }], total: 101 } })
    await wrapper.setProps({ active: true }); await flushPromises()
    expect(api.list).toHaveBeenCalledTimes(2)
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ orderNo: 'QA', startDate: '2026-09-01', endDate: '2026-09-08', page: 2 }))
    expect(wrapper.findComponent({ name: 'ElTable' }).props('data')).toEqual([{ id: 2 }])
    wrapper.unmount()
  })
  it('未显示时不查询，首次进入只查询一次', async () => {
    const wrapper = setup(false); await flushPromises()
    expect(api.list).not.toHaveBeenCalled()
    await wrapper.setProps({ active: true }); await flushPromises()
    expect(api.list).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})

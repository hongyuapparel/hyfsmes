import { shallowMount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FabricOutboundTab from './FabricOutboundTab.vue'
const api = vi.hoisted(() => ({ list: vi.fn(), error: vi.fn() }))
vi.mock('@/api/inventory', () => ({ getFabricOutboundRecords: api.list }))
vi.mock('@/api/request', () => ({ getErrorMessage: () => '失败', isErrorHandled: () => false }))
vi.mock('element-plus', () => ({ ElMessage: { error: api.error } }))
vi.mock('@/composables/useFlexShellTableHeight', () => ({ useFlexShellTableHeight: () => ({ tableHeight: ref(500) }) }))
vi.mock('@/composables/useTableColumnWidthPersist', () => ({ useTableColumnWidthPersist: () => ({ restoreColumnWidths: vi.fn() }) }))
function response(id: number) { return { data: { list: [{ id }], total: id } } }
function setup() {
  return shallowMount(FabricOutboundTab, { props: { customerOptions: [], inventoryTypeOptions: [] }, global: {
    directives: { loading: () => {} },
    stubs: {
      ElInput: true, ElOption: true, ElSelect: true, ElButton: true, ElTableColumn: true, ElTooltip: true,
      ElForm: { template: '<form><slot /></form>' },
      ElDatePicker: { name: 'ElDatePicker', props: ['modelValue'], template: '<input />' },
      ElTable: { name: 'ElTable', props: ['data'], template: '<div />' },
    },
  } })
}
beforeEach(() => { vi.clearAllMocks(); api.list.mockResolvedValue(response(1)) })
describe('面料出库日期清空及查询顺序', () => {
  it('日期组件发送 null 时恢复空范围并正常查询', async () => {
    const wrapper = setup(); await flushPromises(); const picker = wrapper.findComponent({ name: 'ElDatePicker' })
    picker.vm.$emit('update:modelValue', ['2026-09-01', '2026-09-08']); picker.vm.$emit('change'); await flushPromises()
    picker.vm.$emit('update:modelValue', null); picker.vm.$emit('change'); await flushPromises()
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: undefined, endDate: undefined }))
    expect(picker.props('modelValue')).toEqual([]); wrapper.unmount()
  })
  it('晚返回的旧请求不会覆盖新筛选结果', async () => {
    let resolve!: (value: ReturnType<typeof response>) => void
    api.list.mockReturnValueOnce(new Promise(done => { resolve = done })); const wrapper = setup()
    api.list.mockResolvedValueOnce(response(2)); await wrapper.vm.load(); resolve(response(1)); await flushPromises()
    expect(wrapper.findComponent({ name: 'ElTable' }).props('data')).toEqual([{ id: 2 }]); wrapper.unmount()
  })
})

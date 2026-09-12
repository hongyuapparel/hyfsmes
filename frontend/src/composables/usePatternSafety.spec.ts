import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PatternListItem } from '@/api/production-pattern'
const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn(), assign: vi.fn(), items: vi.fn(), counts: vi.fn(), logs: vi.fn() }))
vi.mock('@/api/production-pattern', () => ({
  getPatternLogs: api.logs, getPatternMaterials: api.get, savePatternMaterials: api.save, assignPattern: api.assign,
  getPatternItems: api.items, getPatternTabCounts: api.counts, exportPatternItems: vi.fn(),
  checkPatternCompletion: vi.fn(), completePattern: vi.fn(), editCompletedPattern: vi.fn(),
}))
vi.mock('@/api/hr', () => ({ getStaffOptions: vi.fn() }))
vi.mock('@/api/dicts', () => ({ getDictItems: vi.fn(), getDictTree: vi.fn() }))
vi.mock('@/api/uploads', () => ({ uploadImage: vi.fn() }))
vi.mock('@/api/operation-logs', () => ({ fetchOrderOperationLogs: async () => [], toLogSectionItems: () => [] }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => true }) }))
vi.mock('element-plus', () => ({ ElMessage: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }))
vi.mock('@/api/request', () => ({ getErrorMessage: () => '测试错误', isErrorHandled: () => false }))
import { usePatternDialogs } from './usePatternDialogs'
import { usePatternList } from './usePatternList'

function row(orderId: number): PatternListItem {
  return {
    orderId, orderNo: `TEST-${orderId}`, customerName: '', salesperson: '', merchandiser: '', quantity: 1,
    arrivedAtPattern: null, completedAt: null, orderDate: null, customerDueDate: null,
    skuCode: '', imageUrl: '', orderTypeId: null, collaborationTypeId: null,
    patternStatus: 'in_progress', patternMaster: 'A', sampleMaker: 'B', sampleImageUrl: '',
    timeRating: '进行中', timeRatingReason: '', overdueDays: 0, canAssign: true,
  }
}
function setup() {
  const selected = ref([1, 2, 3].map(row))
  const loaders = { reloadList: vi.fn() }
  return { selected, loaders, ...usePatternDialogs(selected, loaders, { findOrderTypeLabelById: () => '', findCollaborationLabelById: () => '' }) }
}

describe('纸样交互安全', () => {
  beforeEach(() => { vi.resetAllMocks(); api.logs.mockResolvedValue({ data: [] }); api.assign.mockResolvedValue({}); api.save.mockResolvedValue({}) })
  it('第二单先返回、第一单后返回，物料仍然属于第二单', async () => {
    const resolves: Array<(value: unknown) => void> = []
    api.get.mockImplementation(() => new Promise((resolve) => resolves.push(resolve)))
    const state = setup()
    const first = state.openPatternDetailDrawer(row(1))
    const second = state.openPatternDetailDrawer(row(2))
    resolves[1]({ data: { materials: [{ materialName: '订单2物料' }] } }); await second
    resolves[0]({ data: { materials: [{ materialName: '订单1物料' }] } }); await first
    expect(state.detailDrawer.row?.orderId).toBe(2)
    expect(state.materialsForm.materials[0].materialName).toBe('订单2物料')
  })
  it('关闭后返回的请求不能重新填入物料', async () => {
    let resolve: ((value: unknown) => void) | undefined
    api.get.mockImplementation(() => new Promise((r) => { resolve = r }))
    const state = setup(); const loading = state.openPatternDetailDrawer(row(1))
    state.detailDrawer.visible = false; await nextTick(); state.onDetailDrawerClosed()
    resolve?.({ data: { materials: [{ materialName: '迟到物料' }] } }); await loading
    expect(state.materialsForm.materials).toEqual([])
    expect(state.detailDrawer.loaded).toBe(false)
  })
  it('加载失败时清空旧单内容，并阻止保存', async () => {
    const state = setup()
    state.materialsForm.materials = [{ materialName: '旧物料' }]
    api.get.mockRejectedValue(new Error('加载失败'))
    await state.openPatternDetailDrawer(row(2)); await state.submitMaterials()
    expect(state.materialsForm.materials).toEqual([])
    expect(api.save).not.toHaveBeenCalled()
    expect(state.detailDrawer.loaded).toBe(false)
  })
  it('追踪未保存修改，取消恢复原值，保存后解除未保存标记', async () => {
    const state = setup(); api.get.mockResolvedValue({ data: { materials: [{ materialName: '原物料' }], remark: '' } })
    await state.openPatternDetailDrawer(row(1)); state.onEnterEdit()
    expect(state.hasUnsavedMaterials.value).toBe(false)
    state.materialsForm.remark = '修改'; expect(state.hasUnsavedMaterials.value).toBe(true)
    state.onCancelEdit(); expect(state.materialsForm.remark).toBe('')
    state.onEnterEdit(); state.materialsForm.remark = '保存'; await state.submitMaterials()
    expect(state.hasUnsavedMaterials.value).toBe(false)
  })
  it('分配失败重试只处理剩余订单，成功部分会更新列表及数量', async () => {
    const state = setup(); api.assign.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('失败'))
    state.openAssignDialog(); await state.submitAssign()
    expect(state.assignDialog.rows.map(r => r.orderId)).toEqual([2, 3])
    expect(state.assignDialog.error).toContain('TEST-2')
    expect(state.loaders.reloadList).toHaveBeenCalledOnce()
    await state.submitAssign()
    expect(api.assign.mock.calls.map(([payload]) => payload.orderId)).toEqual([1, 2, 2, 3])
    expect(state.assignDialog.succeeded).toBe(3)
  })
  it('已完成或不可分配的订单混选时不能开启分配', () => {
    const state = setup(); state.selected.value[0].canAssign = false
    expect(state.canAssignSelection.value).toBe(false)
    state.openAssignDialog(); expect(state.assignDialog.visible).toBe(false)
  })
  it('人员未填写或重复点击时不会重复发送分配', async () => {
    const state = setup(); state.openAssignDialog(); state.assignForm.sampleMaker = ''
    await state.submitAssign(); expect(api.assign).not.toHaveBeenCalled()
    state.assignForm.sampleMaker = 'B'
    let finish: (() => void) | undefined
    api.assign.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    const submit = state.submitAssign(); await state.submitAssign()
    expect(api.assign).toHaveBeenCalledOnce()
    finish?.(); await submit; expect(api.assign).toHaveBeenCalledTimes(3)
  })
  it('仅看超期联动列表、数量及排序参数，清空筛选恢复全部', async () => {
    api.items.mockResolvedValue({ data: { list: [], total: 0, totalQuantity: 0, tabCounts: { all: 7, pending_assign: 3 } } })
    api.counts.mockResolvedValue({ data: { all: 0 } })
    const state = usePatternList(); state.filter.onlyOverdue = true
    state.onSortChange({ prop: 'overdueDays', order: 'descending' }); await nextTick()
    expect(api.items.mock.calls[0][0]).toMatchObject({ onlyOverdue: true, sortField: 'overdueDays', sortOrder: 'desc', page: 1 })
    expect(api.counts).not.toHaveBeenCalled()
    expect(state.tabTotal.value).toBe(7)
    state.onReset(() => { void state.load() }); await nextTick()
    expect(api.items.mock.calls[api.items.mock.calls.length - 1]?.[0].onlyOverdue).toBeUndefined()
    expect(state.currentTab.value).toBe('all')
  })
})

describe('先保存再完成与异常保留', () => {
  beforeEach(() => { vi.resetAllMocks(); api.logs.mockResolvedValue({ data: [] }); api.get.mockResolvedValue({ data: { materials: [{ materialName: '主布', usagePerPiece: 1 }], remark: '', version: 'old' } }) })
  it('完成不再隐式保存；编辑未保存则不打开完成窗口', async () => {
    const state=setup(); await state.openPatternDetailDrawer(row(1)); state.onEnterEdit(); state.materialsForm.remark='待保存';
    state.completeFromDrawer(); expect(state.completeDialog.visible).toBe(false);
    state.onCancelEdit(); state.completeFromDrawer(); expect(state.completeDialog.visible).toBe(true);
    expect(api.save).not.toHaveBeenCalled();
  })
  it('保存冲突保留输入和未保存提示，并携带打开时的版本', async () => {
    const state=setup(); await state.openPatternDetailDrawer(row(1)); state.onEnterEdit(); state.materialsForm.remark='我的修改';
    api.save.mockRejectedValue(new Error('conflict')); expect(await state.submitMaterials()).toBe(false);
    expect(api.save.mock.calls[0][1].expectedVersion).toBe('old');
    expect(state.materialsForm.remark).toBe('我的修改'); expect(state.hasUnsavedMaterials.value).toBe(true);
  })
  it('历史加载失败明确提示，不伪装成暂无记录', async () => {
    api.logs.mockRejectedValue(new Error('forbidden')); const state=setup(); await state.openPatternDetailDrawer(row(1)); await nextTick();
    await vi.waitFor(()=>expect(state.patternDrawerLogsError.value).toContain('加载失败'));
  })
})

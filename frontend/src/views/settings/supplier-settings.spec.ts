import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import SupplierSettings from './supplier-settings.vue'

type Node = {
  id: number
  value: string
  parentId: number | null
  sortOrder: number
}

let seq = 100
let db: Node[] = []

function resetDb() {
  seq = 100
  db = [
    { id: 1, value: '工艺供应商', parentId: null, sortOrder: 0 },
    { id: 2, value: '绣花', parentId: 1, sortOrder: 0 },
    { id: 3, value: '印花', parentId: 1, sortOrder: 1 },
    { id: 4, value: '丝网胶浆', parentId: 3, sortOrder: 0 },
  ]
}

function childrenOf(parentId: number | null) {
  return db
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
}

function toTree(parentId: number | null): any[] {
  return childrenOf(parentId).map((n) => ({
    id: n.id,
    optionType: 'supplier_types',
    value: n.value,
    sortOrder: n.sortOrder,
    parentId: n.parentId,
    children: toTree(n.id),
  }))
}

vi.mock('@/api/system-options', () => {
  return {
    getSystemOptionsRoots: vi.fn(async () => ({
      data: childrenOf(null).map((n) => ({
        id: n.id,
        value: n.value,
        sortOrder: n.sortOrder,
        hasChildren: childrenOf(n.id).length > 0,
      })),
    })),
    getSystemOptionsChildren: vi.fn(async (_type: string, parentId: number) => ({
      data: childrenOf(parentId).map((n) => ({
        id: n.id,
        value: n.value,
        sortOrder: n.sortOrder,
        hasChildren: childrenOf(n.id).length > 0,
      })),
    })),
    getSystemOptionsTree: vi.fn(async () => ({
      data: toTree(null),
    })),
    createSystemOption: vi.fn(async (payload: { value: string; parent_id?: number | null; sort_order?: number }) => {
      db.push({
        id: ++seq,
        value: payload.value,
        parentId: payload.parent_id ?? null,
        sortOrder: payload.sort_order ?? 0,
      })
      return { data: {} }
    }),
    updateSystemOption: vi.fn(async (id: number, payload: { value?: string; parent_id?: number | null }) => {
      const target = db.find((n) => n.id === id)
      if (target) {
        if (payload.value != null) target.value = payload.value
        if (payload.parent_id !== undefined) target.parentId = payload.parent_id
      }
      return { data: {} }
    }),
    deleteSystemOption: vi.fn(async (id: number) => {
      const removeIds = new Set<number>()
      const stack = [id]
      while (stack.length) {
        const cur = stack.shift()!
        removeIds.add(cur)
        db.filter((n) => n.parentId === cur).forEach((n) => stack.push(n.id))
      }
      db = db.filter((n) => !removeIds.has(n.id))
      return { data: {} }
    }),
    batchUpdateSystemOptionOrder: vi.fn(async (_type: string, parentId: number | null, items: { id: number; sort_order: number }[]) => {
      for (const item of items) {
        const target = db.find((n) => n.id === item.id && n.parentId === parentId)
        if (target) target.sortOrder = item.sort_order
      }
      return { data: {} }
    }),
  }
})

vi.mock('@/api/request', () => ({
  getErrorMessage: () => 'error',
  isErrorHandled: () => false,
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
  ElMessageBox: {
    confirm: vi.fn(async () => true),
  },
}))

async function mountPage() {
  const wrapper = shallowMount(SupplierSettings, {
    global: {
      stubs: {
        ElTable: true,
        ElTableColumn: true,
        ElDialog: true,
        ElForm: true,
        ElFormItem: true,
        ElSelect: true,
        ElOption: true,
        ElInput: true,
        ElButton: true,
        ElTooltip: true,
        ElIcon: true,
      },
    },
  })
  const hooks = (wrapper.vm as any).__test
  await hooks.reloadSupplierTree({ anchorIds: [1] })
  return { wrapper, hooks }
}

describe('supplier-settings 防复发即时更新', () => {
  beforeEach(() => {
    resetDb()
  })

  it('编辑后立即显示新值', async () => {
    const { hooks } = await mountPage()
    const root = hooks.state.treeData.value.find((n: any) => n.id === 1)
    const parent = root.children.find((n: any) => n.id === 2)
    await hooks.openEdit(parent)
    hooks.state.form.value.value = '绣花(新)'
    await hooks.submit()
    const root2 = hooks.state.treeData.value.find((n: any) => n.id === 1)
    expect(root2.children.some((n: any) => n.value === '绣花(新)')).toBe(true)
  })

  it('新增分组后立即出现', async () => {
    const { hooks } = await mountPage()
    await hooks.openAdd(1, 0)
    hooks.state.form.value.value = '打条'
    await hooks.submit()
    const root = hooks.state.treeData.value.find((n: any) => n.id === 1)
    expect(root.children.some((n: any) => n.value === '打条')).toBe(true)
  })

  it('删除后立即消失', async () => {
    const { hooks } = await mountPage()
    const root = hooks.state.treeData.value.find((n: any) => n.id === 1)
    const target = root.children.find((n: any) => n.id === 3)
    await hooks.remove(target)
    const root2 = hooks.state.treeData.value.find((n: any) => n.id === 1)
    expect(root2.children.some((n: any) => n.id === 3)).toBe(false)
  })

  it('上移下移后顺序立即变化', async () => {
    const { hooks } = await mountPage()
    let root = hooks.state.treeData.value.find((n: any) => n.id === 1)
    const before = root.children.map((n: any) => n.id)
    const target = root.children.find((n: any) => n.id === 3)
    await hooks.moveRow(target, -1)
    root = hooks.state.treeData.value.find((n: any) => n.id === 1)
    const after = root.children.map((n: any) => n.id)
    expect(after).not.toEqual(before)
    expect(after[0]).toBe(3)
  })

  it('刷新后展开状态保留', async () => {
    const { hooks } = await mountPage()
    hooks.state.expandedIds.value = new Set([1])
    await hooks.reloadSupplierTree({ anchorIds: [] })
    expect(hooks.state.expandedIds.value.has(1)).toBe(true)
  })
})


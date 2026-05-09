import { describe, it, expect, beforeEach, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useSupplierSettings } from '@/composables/useSupplierSettings'

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

type TreeNode = {
  id: number
  optionType: string
  value: string
  sortOrder: number
  parentId: number | null
  children: TreeNode[]
}

function toTree(parentId: number | null): TreeNode[] {
  return childrenOf(parentId).map((n) => ({
    id: n.id,
    optionType: 'supplier_types',
    value: n.value,
    sortOrder: n.sortOrder,
    parentId: n.parentId,
    children: toTree(n.id),
  }))
}

vi.mock('@/api/system-options', () => ({
  getSystemOptionsTree: vi.fn(async () => ({ data: toTree(null) })),
  createSystemOption: vi.fn(
    async (payload: { value: string; parent_id?: number | null; sort_order?: number }) => {
      db.push({
        id: ++seq,
        value: payload.value,
        parentId: payload.parent_id ?? null,
        sortOrder: payload.sort_order ?? 0,
      })
      return { data: {} }
    },
  ),
  updateSystemOption: vi.fn(
    async (id: number, payload: { value?: string; parent_id?: number | null }) => {
      const target = db.find((n) => n.id === id)
      if (target) {
        if (payload.value != null) target.value = payload.value
        if (payload.parent_id !== undefined) target.parentId = payload.parent_id
      }
      return { data: {} }
    },
  ),
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
  batchUpdateSystemOptionOrder: vi.fn(
    async (
      _type: string,
      parentId: number | null,
      items: { id: number; sort_order: number }[],
    ) => {
      for (const item of items) {
        const target = db.find((n) => n.id === item.id && n.parentId === parentId)
        if (target) target.sortOrder = item.sort_order
      }
      return { data: {} }
    },
  ),
}))

vi.mock('@/api/request', () => ({
  getErrorMessage: () => 'error',
  isErrorHandled: () => false,
}))

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
  ElMessageBox: { confirm: vi.fn(async () => true) },
}))

type Hooks = ReturnType<typeof useSupplierSettings>

async function setup() {
  let hooks!: Hooks
  const Host = defineComponent({
    setup() {
      hooks = useSupplierSettings()
      return () => h('div')
    },
  })
  const wrapper = mount(Host)
  await nextTick()
  await hooks.loadTree()
  return { wrapper, hooks }
}

describe('useSupplierSettings 即时刷新', () => {
  beforeEach(() => {
    resetDb()
  })

  it('新增子分组后 treeData 立即包含新节点', async () => {
    const { hooks } = await setup()
    hooks.openAdd(1, 0)
    hooks.form.value = { value: '打条' }
    await hooks.submit()
    const root = hooks.treeData.value.find((n) => n.id === 1)
    expect(root?.children?.some((n) => n.value === '打条')).toBe(true)
  })

  it('编辑后 treeData 立即反映新值', async () => {
    const { hooks } = await setup()
    const root = hooks.treeData.value.find((n) => n.id === 1)
    const parent = root?.children?.find((n) => n.id === 2)
    expect(parent).toBeTruthy()
    await hooks.openEdit(parent!)
    hooks.form.value = { value: '绣花(新)' }
    await hooks.submit()
    const root2 = hooks.treeData.value.find((n) => n.id === 1)
    expect(root2?.children?.some((n) => n.value === '绣花(新)')).toBe(true)
    expect(root2?.children?.some((n) => n.value === '绣花')).toBe(false)
  })

  it('删除后 treeData 立即移除该节点', async () => {
    const { hooks } = await setup()
    const root = hooks.treeData.value.find((n) => n.id === 1)
    const target = root?.children?.find((n) => n.id === 3)
    expect(target).toBeTruthy()
    await hooks.remove(target!)
    const root2 = hooks.treeData.value.find((n) => n.id === 1)
    expect(root2?.children?.some((n) => n.id === 3)).toBe(false)
  })

  it('上移后顺序立即变化', async () => {
    const { hooks } = await setup()
    const root = hooks.treeData.value.find((n) => n.id === 1)
    const target = root?.children?.find((n) => n.id === 3)
    expect(target).toBeTruthy()
    await hooks.moveRow(target!, -1)
    const root2 = hooks.treeData.value.find((n) => n.id === 1)
    expect(root2?.children?.[0]?.id).toBe(3)
  })

  it('loadTree 后展开状态保留（仅保留仍存在的 id）', async () => {
    const { hooks } = await setup()
    hooks.expandedIds.value = new Set([1, 9999])
    await hooks.loadTree()
    expect(hooks.expandedIds.value.has(1)).toBe(true)
    expect(hooks.expandedIds.value.has(9999)).toBe(false)
  })

  it('新增节点后会自动把父节点 id 加入展开集合', async () => {
    const { hooks } = await setup()
    hooks.expandedIds.value = new Set()
    hooks.openAdd(1, 0)
    hooks.form.value = { value: '打条' }
    await hooks.submit()
    expect(hooks.expandedIds.value.has(1)).toBe(true)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePackingGridRows, setPackingSizeQuantity } from './usePackingGridRows'
import { usePackingListEdit } from './usePackingListEdit'
import type { PackingListDetail, SavePackingListPayload } from '@/api/packing-lists'

const api = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), warning: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { id: '1' } }), useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('element-plus', () => ({ ElMessage: { warning: api.warning, success: vi.fn(), error: vi.fn() }, ElMessageBox: {} }))
vi.mock('@/api/packing-lists', () => ({ getPackingListDetail: api.get, updatePackingList: api.update, createPackingList: vi.fn() }))
vi.mock('@/api/request', () => ({ getErrorMessage: () => '', isErrorHandled: () => false }))
vi.mock('@/api/customers', () => ({ getAllCustomerCompanyOptions: vi.fn(), getSalespeople: vi.fn() }))

function detail(): PackingListDetail {
  return { id: 1, code: 'TEST', customerId: null, customerName: '', serviceManager: '', poNo: '', country: '',
    postalCode: '', xiaomanOrderNo: '', xiaomanOrderId: '', packDate: null, remark: '', showCompany: true,
    sizeHeaders: ['OSFA'], status: 'draft', shippedAt: null, operatorUsername: '', createdAt: '',
    boxes: [{ id: 1, boxSeq: 1, weightKg: null, cartonSize: '', remark: '', items: [{ id: 1, styleNo: 'manual',
      styleName: '', colorName: '', imageUrl: '', sizeQuantities: { OSFA: 5 }, totalQty: 5, sourceType: 'manual', sourceId: null }] }],
  }
}
beforeEach(() => vi.clearAllMocks())

describe('packing edit load/save boundary', () => {
  it('load deletes orphan quantities without adding columns or mutating the API response', () => {
    const raw = detail()
    raw.boxes[0].items[0].sizeQuantities.S = 5
    const grid = usePackingGridRows(), edit = usePackingListEdit(grid)
    edit.applyDetail(raw)
    expect(grid.sizeHeaders.value).toEqual(['OSFA'])
    expect(grid.boxes.value[0].items[0].sizeQuantities).toEqual({ OSFA: 5 })
    expect(api.warning).not.toHaveBeenCalled()
    expect(grid.totals.value.totalQty).toBe(5)
    expect(edit.detail.value?.sizeHeaders).toEqual(['OSFA'])
    expect(edit.detail.value?.boxes[0].items[0].totalQty).toBe(5)
    expect(raw.sizeHeaders).toEqual(['OSFA'])
    expect(raw.boxes[0].items[0].sizeQuantities).toEqual({ OSFA: 5, S: 5 })
  })

  it('all removed sizes stay zero on load; legitimate S and 0 headers are retained', () => {
    const raw = detail()
    raw.boxes[0].items[0].sizeQuantities = { S: 4, '0': 5 }
    raw.boxes[0].items[0].totalQty = 9
    const grid = usePackingGridRows(), edit = usePackingListEdit(grid)
    edit.applyDetail(raw)
    expect(grid.sizeHeaders.value).toEqual(['OSFA'])
    expect(grid.boxes.value[0].items[0].sizeQuantities).toEqual({})
    expect(grid.totals.value.totalQty).toBe(0)
    raw.sizeHeaders = ['S', '0']
    edit.applyDetail(raw)
    expect(grid.sizeHeaders.value).toEqual(['S', '0'])
    expect(grid.totals.value.totalQty).toBe(9)
  })

  it('save/reload, clear to zero, save/reload, copy, delete column never resurrects old 5', async () => {
    let stored = detail()
    api.get.mockImplementation(async () => ({ data: structuredClone(stored) }))
    api.update.mockImplementation(async (_id: number, payload: SavePackingListPayload) => {
      stored = JSON.parse(JSON.stringify({ ...stored, ...payload }))
    })
    const grid = usePackingGridRows(), edit = usePackingListEdit(grid)
    await edit.load()
    expect(grid.boxes.value[0].items[0].totalQty).toBe(0)
    setPackingSizeQuantity(grid.boxes.value[0].items[0], 'OSFA', 0)
    expect(await edit.save()).toBe(true)
    await edit.load()
    expect(grid.totals.value.totalQty).toBe(0)
    setPackingSizeQuantity(grid.boxes.value[0].items[0], 'OSFA', 5)
    expect(await edit.save()).toBe(true)
    grid.copyBox(0)
    expect(grid.totals.value.totalQty).toBe(10)
    grid.removeSizeHeader('OSFA')
    expect(grid.totals.value.totalQty).toBe(0)
    expect(await edit.save()).toBe(true)
    await edit.load()
    expect(grid.totals.value.totalQty).toBe(0)
    expect(stored.boxes.flatMap(b => b.items.map(i => i.totalQty))).toEqual([0, 0])
  })

  it('all-zero legacy size map overrides stale total; quantity-only manual rows still work', () => {
    const raw = detail()
    raw.boxes[0].items[0].sizeQuantities = { OSFA: 0 }
    const grid = usePackingGridRows(), edit = usePackingListEdit(grid)
    edit.applyDetail(raw)
    expect(grid.totals.value.totalQty).toBe(0)
    raw.boxes[0].items[0].sizeQuantities = {}
    edit.applyDetail(raw)
    expect(grid.totals.value.totalQty).toBe(5)
  })
})

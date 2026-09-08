import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { buildPayload, type PackingForm } from './packingListPayload'
import type { PackingBoxDraft } from './usePackingGridRows'

function form(): PackingForm {
  return {
    customerId: null,
    customerName: ' 客户A ',
    serviceManager: '',
    poNo: '',
    country: '',
    postalCode: '',
    xiaomanOrderNo: '',
    xiaomanOrderId: '',
    packDate: '2026-08-20',
    remark: '',
    showCompany: true,
  }
}

function box(sizeQuantities: Record<string, number>, totalQty = 0): PackingBoxDraft {
  return {
    key: 'test-box',
    weightKg: null,
    cartonSize: '',
    remark: '',
    items: [{
      styleNo: 'IS2604493',
      styleName: '',
      colorName: '加拿大U620656',
      imageUrl: '',
      sizeQuantities,
      totalQty,
      sourceType: 'manual',
      sourceId: null,
    }],
  }
}

describe('packingListPayload', () => {
  it('保存时规范当前表头尺码并重算合计，不信任旧 totalQty', () => {
    const payload = buildPayload(form(), {
      sizeHeaders: ref([' OSFA ', 'OSFA']),
      boxes: ref([box({ OSFA: 5 }, 10)]),
    })
    expect(payload.sizeHeaders).toEqual(['OSFA'])
    expect(payload.boxes[0].items[0].sizeQuantities).toEqual({ OSFA: 5 })
    expect(payload.boxes[0].items[0].totalQty).toBe(5)
  })

  it('表头外数量作为已删除数据清除，不能转成手填合计', () => {
    const payload = buildPayload(form(), {
      sizeHeaders: ref(['OSFA']),
      boxes: ref([box({ S: 5 }, 10)]),
    })
    expect(payload.boxes[0].items[0].sizeQuantities).toEqual({})
    expect(payload.boxes[0].items[0].totalQty).toBe(0)
  })
})

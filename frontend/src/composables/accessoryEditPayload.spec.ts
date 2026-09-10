import { describe, expect, it } from 'vitest'
import type { AccessoryItem } from '@/api/inventory'
import type { AccessoriesFormModel } from './useAccessoriesFormDialog'
import { buildAccessoryEditSizePayload } from './accessoryEditPayload'

const original: AccessoryItem = { id: 1, name: 'QA', quantity: 10, isSized: true,
  sizeHeaders: ['S', 'M', 'L'], sizeQuantities: [-1, 5, 6], unit: '个', createdAt: '', category: '', remark: '' }
function form(): AccessoriesFormModel {
  return { name: 'QA', quantity: 10, isSized: true, sizeHeaders: ['S', 'M', 'L'], sizeQuantities: [-1, 5, 6],
    unit: '个', category: '', warehouseId: null, location: '', customerName: '', salesperson: 'Andy',
    imageUrl: '', imageUrls: [], remark: '只改备注' }
}
describe('辅料编辑不覆盖未修改的库存明细', () => {
  it('只改备注或地址时不发送数量和分码字段', () => {
    expect(buildAccessoryEditSizePayload(form(), original)).toEqual({})
  })
  it('确实修改分码数量时保留真实负值', () => {
    const edited = form(); edited.sizeQuantities = [-1, 4, 6]
    expect(buildAccessoryEditSizePayload(edited, original)).toEqual({ isSized: true,
      sizeHeaders: ['S', 'M', 'L'], sizeQuantities: [-1, 4, 6] })
  })
  it('切换为不分码时明确提交关闭', () => {
    expect(buildAccessoryEditSizePayload({ ...form(), isSized: false }, original)).toEqual({ isSized: false })
  })
  it.each([1.5, NaN, Infinity])('拒绝非法或小数数量 %s，不转换为零', (value) => {
    expect(() => buildAccessoryEditSizePayload({ ...form(), sizeQuantities: [value, 5, 6] }, original)).toThrow('整数')
  })
})

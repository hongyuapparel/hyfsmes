import { describe, expect, it } from 'vitest'
import { usePackingGridRows, type PackingItemDraft } from './usePackingGridRows'
import type { PickableLine } from '@/api/packing-lists'

function makeItem(overrides: Partial<PackingItemDraft> = {}): PackingItemDraft {
  return {
    styleNo: 'ST-001',
    styleName: '',
    colorName: '红色',
    imageUrl: '',
    sizeQuantities: {},
    totalQty: 0,
    sourceType: 'manual',
    sourceId: null,
    ...overrides,
  }
}

function makePickedLine(overrides: Partial<PickableLine> = {}): PickableLine {
  return {
    sourceType: 'finished',
    sourceId: 1,
    orderNo: 'ORD-1',
    styleNo: 'ST-001',
    customerName: '客户A',
    colorName: '红色',
    imageUrl: '',
    sizeQuantities: { S: 10, M: 20 },
    totalQty: 30,
    hasSnapshot: true,
    ...overrides,
  }
}

describe('usePackingGridRows', () => {
  it('addBox 创建带一个空行的箱，flatRows 标记箱首行与 rowspan', () => {
    const grid = usePackingGridRows()
    grid.addBox()
    grid.addItemToBox(0, makeItem())
    expect(grid.boxes.value).toHaveLength(1)
    expect(grid.boxes.value[0].items).toHaveLength(2)
    expect(grid.flatRows.value).toHaveLength(2)
    expect(grid.flatRows.value[0].isFirstRow).toBe(true)
    expect(grid.flatRows.value[0].rowspan).toBe(2)
    expect(grid.flatRows.value[1].isFirstRow).toBe(false)
  })

  it('copyBox 深拷贝且箱序号按位置重排', () => {
    const grid = usePackingGridRows()
    grid.addBox()
    grid.addBox()
    grid.boxes.value[0].cartonSize = '60x40x40'
    grid.boxes.value[0].items[0].styleNo = 'A'
    grid.copyBox(0)
    expect(grid.boxes.value).toHaveLength(3)
    expect(grid.boxes.value[1].cartonSize).toBe('60x40x40')
    expect(grid.boxes.value[1].items[0].styleNo).toBe('A')
    expect(grid.boxes.value[1].key).not.toBe(grid.boxes.value[0].key)
    // 修改副本不影响原箱
    grid.boxes.value[1].items[0].styleNo = 'B'
    expect(grid.boxes.value[0].items[0].styleNo).toBe('A')
    // 箱号按数组位置：1/2/3
    expect(grid.flatRows.value.map((r) => r.boxIndex + 1)).toEqual([1, 2, 3])
  })

  it('removeItem 删最后一行时保留一个空行', () => {
    const grid = usePackingGridRows()
    grid.addBox()
    grid.boxes.value[0].items[0].styleNo = 'A'
    grid.removeItem(0, 0)
    expect(grid.boxes.value[0].items).toHaveLength(1)
    expect(grid.boxes.value[0].items[0].styleNo).toBe('')
  })

  it('insertSizeHeader 不丢已有数量，拒绝重复码名', () => {
    const grid = usePackingGridRows()
    grid.sizeHeaders.value = ['S', 'M']
    grid.addBox()
    grid.boxes.value[0].items[0].sizeQuantities = { S: 5, M: 6 }
    expect(grid.insertSizeHeader('L', 1)).toBe(true)
    expect(grid.sizeHeaders.value).toEqual(['S', 'L', 'M'])
    expect(grid.boxes.value[0].items[0].sizeQuantities).toEqual({ S: 5, M: 6 })
    expect(grid.insertSizeHeader('S')).toBe(false)
    expect(grid.insertSizeHeader('  ')).toBe(false)
  })

  it('removeSizeHeader 同步清掉行内该码数量', () => {
    const grid = usePackingGridRows()
    grid.sizeHeaders.value = ['S', 'M']
    grid.addBox()
    grid.boxes.value[0].items[0].sizeQuantities = { S: 5, M: 6 }
    grid.removeSizeHeader('S')
    expect(grid.sizeHeaders.value).toEqual(['M'])
    expect(grid.boxes.value[0].items[0].sizeQuantities).toEqual({ M: 6 })
  })

  it('addSizeColumn 追加空列并返回下标', () => {
    const grid = usePackingGridRows()
    grid.sizeHeaders.value = ['S']
    const idx = grid.addSizeColumn()
    expect(idx).toBe(1)
    expect(grid.sizeHeaders.value).toEqual(['S', ''])
  })

  it('commitSizeHeader 改名迁移行内数据', () => {
    const grid = usePackingGridRows()
    grid.sizeHeaders.value = ['S', 'M']
    grid.addBox()
    grid.boxes.value[0].items[0].sizeQuantities = { S: 5, M: 6 }
    grid.sizeHeaders.value[1] = 'L'
    expect(grid.commitSizeHeader(1, 'M')).toBe('ok')
    expect(grid.sizeHeaders.value).toEqual(['S', 'L'])
    expect(grid.boxes.value[0].items[0].sizeQuantities).toEqual({ S: 5, L: 6 })
  })

  it('commitSizeHeader 重名拒绝并撤销回旧名', () => {
    const grid = usePackingGridRows()
    grid.sizeHeaders.value = ['S', 'M']
    grid.sizeHeaders.value[1] = 'S'
    expect(grid.commitSizeHeader(1, 'M')).toBe('duplicate')
    expect(grid.sizeHeaders.value).toEqual(['S', 'M'])
  })

  it('commitSizeHeader 空名删除无数据的新列', () => {
    const grid = usePackingGridRows()
    grid.sizeHeaders.value = ['S']
    const idx = grid.addSizeColumn()
    expect(grid.commitSizeHeader(idx, '')).toBe('removed')
    expect(grid.sizeHeaders.value).toEqual(['S'])
  })

  it('commitSizeHeader 空名但旧列有数据则撤销回旧名', () => {
    const grid = usePackingGridRows()
    grid.sizeHeaders.value = ['S', 'M']
    grid.addBox()
    grid.boxes.value[0].items[0].sizeQuantities = { M: 6 }
    grid.sizeHeaders.value[1] = ''
    expect(grid.commitSizeHeader(1, 'M')).toBe('ok')
    expect(grid.sizeHeaders.value).toEqual(['S', 'M'])
  })

  it('removeSizeColumnAt 按下标删列并清数据', () => {
    const grid = usePackingGridRows()
    grid.sizeHeaders.value = ['S', 'M']
    grid.addBox()
    grid.boxes.value[0].items[0].sizeQuantities = { S: 5, M: 6 }
    grid.removeSizeColumnAt(0)
    expect(grid.sizeHeaders.value).toEqual(['M'])
    expect(grid.boxes.value[0].items[0].sizeQuantities).toEqual({ M: 6 })
  })

  it('totals 汇总箱数/件数/重量/每码合计；行合计优先取分码和', () => {
    const grid = usePackingGridRows()
    grid.sizeHeaders.value = ['S', 'M']
    grid.addBox()
    grid.addBox()
    grid.boxes.value[0].weightKg = 10.5
    grid.boxes.value[1].weightKg = 4.5
    grid.boxes.value[0].items[0] = makeItem({ sizeQuantities: { S: 3, M: 7 } })
    grid.boxes.value[1].items[0] = makeItem({ sizeQuantities: {}, totalQty: 20 })
    expect(grid.totals.value.boxCount).toBe(2)
    expect(grid.totals.value.totalQty).toBe(30)
    expect(grid.totals.value.totalWeight).toBeCloseTo(15)
    expect(grid.totals.value.bySize).toEqual({ S: 3, M: 7 })
  })

  it('allocationBySource 同 source 同色跨箱累加', () => {
    const grid = usePackingGridRows()
    grid.sizeHeaders.value = ['S', 'M']
    grid.addBox()
    grid.addBox()
    grid.boxes.value[0].items[0] = makeItem({ sourceType: 'finished', sourceId: 7, sizeQuantities: { S: 3 } })
    grid.boxes.value[1].items[0] = makeItem({ sourceType: 'finished', sourceId: 7, sizeQuantities: { S: 4, M: 2 } })
    const allocation = grid.allocationBySource.value.get('finished:7:红色')
    expect(allocation?.sizeQuantities).toEqual({ S: 7, M: 2 })
    expect(allocation?.totalQty).toBe(9)
  })

  it('validateAgainstPicked 检出 finished 逐码超发', () => {
    const grid = usePackingGridRows()
    grid.sizeHeaders.value = ['S', 'M']
    grid.addBox()
    grid.boxes.value[0].items[0] = makeItem({ sourceType: 'finished', sourceId: 1, sizeQuantities: { S: 11, M: 5 } })
    const errors = grid.validateAgainstPicked([makePickedLine()])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ sourceType: 'finished', sourceId: 1, colorName: '红色', sizeName: 'S', allocated: 11, available: 10 })
  })

  it('validateAgainstPicked 检出 pending 按 source 总量超发（跨颜色合并）', () => {
    const grid = usePackingGridRows()
    grid.sizeHeaders.value = ['S']
    grid.addBox()
    grid.boxes.value[0].items[0] = makeItem({ sourceType: 'pending', sourceId: 2, colorName: '红色', sizeQuantities: { S: 8 } })
    grid.addItemToBox(0, makeItem({ sourceType: 'pending', sourceId: 2, colorName: '蓝色', sizeQuantities: { S: 8 } }))
    const picked = [
      makePickedLine({ sourceType: 'pending', sourceId: 2, colorName: '红色', sizeQuantities: { S: 10 }, totalQty: 10 }),
      makePickedLine({ sourceType: 'pending', sourceId: 2, colorName: '蓝色', sizeQuantities: { S: 5 }, totalQty: 5 }),
    ]
    const errors = grid.validateAgainstPicked(picked)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ sourceType: 'pending', sourceId: 2, sizeName: null, allocated: 16, available: 15 })
  })

  it('validateAgainstPicked 对无 picked 信息的来源行跳过（交给后端校验）', () => {
    const grid = usePackingGridRows()
    grid.addBox()
    grid.boxes.value[0].items[0] = makeItem({ sourceType: 'finished', sourceId: 99, sizeQuantities: { S: 100 } })
    expect(grid.validateAgainstPicked([])).toHaveLength(0)
  })
})

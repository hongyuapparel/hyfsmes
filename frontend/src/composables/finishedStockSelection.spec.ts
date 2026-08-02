import { describe, expect, it } from 'vitest'
import {
  buildFinishedStockTableSelection,
  resolveFinishedStockLeafSelection,
} from './finishedStockSelection'
import type { StockTableLeafRow, StockTableParentRow } from '@/utils/finishedStockTableUtils'

function makeLeaf(key: string, colorName: string): StockTableLeafRow {
  return {
    id: 1,
    orderId: 1,
    orderNo: 'ORDER-1',
    skuCode: 'XH3227',
    quantity: 10,
    warehouseId: 1,
    inventoryTypeId: 1,
    department: '成品部',
    location: 'A区',
    createdAt: '2026-08-01 10:00:00',
    type: 'stored',
    _uiKey: key,
    _rowKind: 'leaf',
    _groupKey: 'xh3227',
    _displayColor: colorName,
    _effectiveImageUrl: `/uploads/${key}.png`,
    _selectedColorName: colorName,
  }
}

function makeParent(children: StockTableLeafRow[]): StockTableParentRow {
  return {
    ...children[0],
    _uiKey: 'parent-xh3227',
    _rowKind: 'parent',
    _children: children,
    _mixedUnitPrice: false,
    _mixedInventoryType: false,
    _mixedWarehouse: false,
    _mixedDepartment: false,
    _mixedLocation: false,
    _mixedOrderNo: false,
  }
}

describe('resolveFinishedStockLeafSelection', () => {
  const green = makeLeaf('green', '大白色+粉绿')
  const blue = makeLeaf('blue', '大白色+蓝色')
  const parent = makeParent([green, blue])

  it('首次只勾选父行时选择全部子行', () => {
    expect(resolveFinishedStockLeafSelection([parent])).toEqual([green, blue])
  })

  it('取消一个子行后只保留仍显式勾选的子行', () => {
    expect(resolveFinishedStockLeafSelection([parent, blue], [green, blue])).toEqual([blue])
  })

  it('取消最后一个子行时不会因残留父行重新全选', () => {
    expect(resolveFinishedStockLeafSelection([parent], [blue])).toEqual([])
  })

  it('重复出现的叶子行只保留一次', () => {
    expect(resolveFinishedStockLeafSelection([parent, green, blue])).toEqual([green, blue])
  })

  it('父行全选时表格保留父子勾选', () => {
    const leaves = resolveFinishedStockLeafSelection([parent])
    expect(buildFinishedStockTableSelection([parent], leaves)).toEqual([parent, green, blue])
  })

  it('取消一个子行后表格取消父行勾选并保留其余子行', () => {
    const leaves = resolveFinishedStockLeafSelection([parent, blue], [green, blue])
    expect(buildFinishedStockTableSelection([parent], leaves)).toEqual([blue])
  })

  it('取消最后一个子行后表格不保留父行勾选', () => {
    const leaves = resolveFinishedStockLeafSelection([parent], [blue])
    expect(buildFinishedStockTableSelection([parent], leaves)).toEqual([])
  })
})

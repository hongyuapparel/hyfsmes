import { describe, expect, it } from 'vitest'
import { buildInventoryOperationLogSummary } from './inventoryOperationLogSummary'

describe('buildInventoryOperationLogSummary', () => {
  it('显示面料出库数量与前后库存', () => {
    expect(buildInventoryOperationLogSummary({
      action: 'outbound',
      beforeSnapshot: { quantity: '100', unit: '米' },
      afterSnapshot: { quantity: '82.5', unit: '米' },
      remark: '1688发货',
    })).toBe('出库 17.5米，库存 100米 → 82.5米；备注：1688发货')
  })

  it('显示分码辅料入库的真实变化', () => {
    expect(buildInventoryOperationLogSummary({
      action: 'inbound',
      beforeSnapshot: { quantity: 10, unit: '个', sizeHeaders: ['S', 'M'], sizeQuantities: [4, 6] },
      afterSnapshot: { quantity: 15, unit: '个', sizeHeaders: ['S', 'M'], sizeQuantities: [6, 9] },
    })).toBe('入库 5个，库存 10个 → 15个；分码：S +2个、M +3个')
  })

  it('历史日志缺快照时不推算数量', () => {
    expect(buildInventoryOperationLogSummary({ action: 'outbound' }))
      .toBe('出库（历史记录未保存数量明细）')
  })

  it('分码数组不完整时不补零推算', () => {
    expect(buildInventoryOperationLogSummary({
      action: 'outbound',
      beforeSnapshot: { quantity: 10, unit: '个', sizeHeaders: ['S', 'M'], sizeQuantities: [4] },
      afterSnapshot: { quantity: 8, unit: '个', sizeHeaders: ['S', 'M'], sizeQuantities: [3, 5] },
    })).toBe('出库 2个，库存 10个 → 8个；分码明细未完整留存')
  })

  it('新增日志缺少前快照时不猜测原库存为零', () => {
    expect(buildInventoryOperationLogSummary({
      action: 'create',
      afterSnapshot: { quantity: 8, unit: '个' },
    })).toBe('新增入库（历史记录未保存数量明细）')
  })

  it('分码值非法时不当作零库存', () => {
    expect(buildInventoryOperationLogSummary({
      action: 'inbound',
      beforeSnapshot: { quantity: 10, unit: '个', sizeHeaders: ['S'], sizeQuantities: ['未记录'] },
      afterSnapshot: { quantity: 12, unit: '个', sizeHeaders: ['S'], sizeQuantities: [12] },
    })).toBe('入库 2个，库存 10个 → 12个；分码明细未完整留存')
  })

  it('单据无数量变化时明确标记异常', () => {
    expect(buildInventoryOperationLogSummary({
      action: 'inbound',
      beforeSnapshot: { quantity: 10, unit: '个' },
      afterSnapshot: { quantity: 10, unit: '个' },
    })).toBe('入库记录异常，库存实际 10个 → 10个')
  })

  it('领取人和用途分开展示', () => {
    expect(buildInventoryOperationLogSummary({
      action: 'outbound',
      beforeSnapshot: { quantity: 10, unit: '个' },
      afterSnapshot: { quantity: 8, unit: '个' },
      remark: '领取人：齐雅芳；样衣使用',
    })).toBe('出库 2个，库存 10个 → 8个；领取人：齐雅芳；备注：样衣使用')
  })

  it('操作类型与库存方向冲突时明确标记异常', () => {
    expect(buildInventoryOperationLogSummary({
      action: 'inbound',
      beforeSnapshot: { quantity: 20, unit: '个' },
      afterSnapshot: { quantity: 15, unit: '个' },
    })).toBe('入库记录异常，库存实际 20个 → 15个')
  })

  it('辅料编辑逐项显示实际字段变化并解析仓库名称', () => {
    expect(buildInventoryOperationLogSummary({
      action: 'update',
      beforeSnapshot: {
        name: '旧吊牌', customerName: '客户A', warehouseId: 1, location: '', remark: '',
        quantity: 100, unit: '个', imageUrls: ['/old.png'],
      },
      afterSnapshot: {
        name: '新吊牌', customerName: '客户B', warehouseId: 2, location: 'A-01', remark: '待核对',
        quantity: 100, unit: '个', imageUrls: ['/new.png', '/detail.png'],
      },
    }, {
      valueLabels: { warehouseId: { 1: '旧仓', 2: '新仓' } },
    })).toBe('编辑；名称「旧吊牌」→「新吊牌」；客户「客户A」→「客户B」；仓库「旧仓」→「新仓」；存放地址「-」→「A-01」；备注「-」→「待核对」；图片已更新（1张→2张）')
  })

  it('分码总数不变时仍记录各尺码的真实变化', () => {
    expect(buildInventoryOperationLogSummary({
      action: 'update',
      beforeSnapshot: { quantity: 10, unit: '个', isSized: true, sizeHeaders: ['S', 'M'], sizeQuantities: [4, 6] },
      afterSnapshot: { quantity: 10, unit: '个', isSized: true, sizeHeaders: ['S', 'M'], sizeQuantities: [5, 5] },
    })).toBe('编辑；分码：S +1个、M -1个')
  })

  it('没有字段变化的保存如实标记为未修改', () => {
    expect(buildInventoryOperationLogSummary({
      action: 'update',
      beforeSnapshot: { name: '吊牌', quantity: 10, unit: '个' },
      afterSnapshot: { name: '吊牌', quantity: 10, unit: '个' },
    })).toBe('编辑；未修改任何字段')
  })

  it('删除记录展示被删除对象和删除前库存', () => {
    expect(buildInventoryOperationLogSummary({
      action: 'delete',
      beforeSnapshot: { name: '吊牌', quantity: 10, unit: '个' },
    })).toBe('删除「吊牌」，删除前库存 10个')
  })
})

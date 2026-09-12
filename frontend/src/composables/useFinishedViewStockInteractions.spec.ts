import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import type { FinishedStockRow } from '@/api/inventory'
import { useFinishedStockTable } from './useFinishedStockTable'
import { useFinishedViewStockInteractions } from './useFinishedViewStockInteractions'

function stock(id: number, unitPrice: string): FinishedStockRow {
  return { id, type: 'stored', orderId: null, orderNo: '', skuCode: 'QA', quantity: 5,
    unitPrice, department: '仓库', warehouseId: 1, inventoryTypeId: 1, location: 'QA', createdAt: '',
    sizeBreakdown: { headers: ['S'], rows: [{ colorName: '蓝色', values: [5] }] } }
}

describe('成品详情保存后刷新真实分组', () => {
  it.each(['other', 'same', 'closed'] as const)('迟到的保存刷新不干扰用户新会话：%s', async mode => {
    const list = ref([stock(1, '10'), { ...stock(2, '20'), skuCode: 'OTHER' }])
    const table = useFinishedStockTable(list)
    let finish!: () => void
    const waiting = new Promise<void>(resolve => { finish = resolve })
    const interaction = useFinishedViewStockInteractions({ list, ...table,
      getSharedProductImageUrl: () => '', load: () => waiting,
    })
    const first = table.stockTableData.value.find(row => row.skuCode === 'QA')!
    interaction.openDetail(first)
    const saving = interaction.onMetaSaved()
    interaction.detailDrawer.visible = false
    if (mode !== 'closed') {
      interaction.openDetail(mode === 'same' ? first : table.stockTableData.value.find(row => row.skuCode === 'OTHER')!)
      // 新会话现场不应被旧回调重新初始化，包括同一 ID 重新打开的情况。
      interaction.detailDrawer.groupProductImage = 'new-session-image'
    }
    finish(); await saving
    expect(interaction.detailDrawer.visible).toBe(mode !== 'closed')
    if (mode !== 'closed') {
      expect(interaction.detailDrawer.stockId).toBe(mode === 'same' ? 1 : 2)
      expect(interaction.detailDrawer.groupProductImage).toBe('new-session-image')
    }
  })
  it.each([1, 2])('保存后使用最新单价，即使库存记录被重建为 id=%s', async (id) => {
    const list = ref([stock(1, '10')])
    const table = useFinishedStockTable(list)
    const interaction = useFinishedViewStockInteractions({ list, ...table,
      getSharedProductImageUrl: () => '', load: async () => { list.value = [stock(id, '12')] },
    })
    interaction.openDetail(table.stockTableData.value[0])
    await interaction.onMetaSaved()
    expect(interaction.detailDrawer.visible).toBe(true)
    expect(interaction.detailDrawer.stockId).toBe(id)
    expect(interaction.detailDrawer.groupColorSizeSnapshot?.rows[0].unitPrice).toBe('12')
  })
  it('当前筛选范围内已不存在的库存关闭详情，不保留旧数据', async () => {
    const list = ref([stock(1, '10')])
    const table = useFinishedStockTable(list)
    const interaction = useFinishedViewStockInteractions({ list, ...table,
      getSharedProductImageUrl: () => '', load: async () => { list.value = [] },
    })
    interaction.openDetail(table.stockTableData.value[0])
    await interaction.onMetaSaved()
    expect(interaction.detailDrawer.visible).toBe(false)
  })
})

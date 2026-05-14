import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { FinishingListItem } from '@/api/production-finishing'

vi.mock('@/api/production-finishing', () => ({
  registerFinishingPackagingComplete: vi.fn(async () => ({ data: undefined })),
  getFinishingRegisterFormData: vi.fn(async () => ({
    data: {
      headers: ['合计'],
      orderRow: [100],
      cutRow: [100],
      sewingRow: [100],
      tailReceivedRow: [100],
      tailInboundRow: null,
      defectRow: null,
    },
  })),
}))

vi.mock('element-plus', () => ({
  ElMessage: { warning: vi.fn(), success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/api/request', () => ({
  getErrorMessage: (_: unknown, fallback: string) => fallback,
  isErrorHandled: () => false,
}))

import { useFinishingPackaging } from './useFinishingPackaging'
import { registerFinishingPackagingComplete, getFinishingRegisterFormData } from '@/api/production-finishing'

const makeRow = (overrides: Partial<FinishingListItem> = {}): FinishingListItem => ({
  orderId: 1,
  orderNo: 'O-1',
  skuCode: 'SKU-1',
  imageUrl: '',
  customerName: '',
  salesperson: '',
  merchandiser: '',
  quantity: 100,
  customerDueDate: null,
  arrivedAt: null,
  completedAt: null,
  finishingStatus: 'pending_assign',
  cutTotal: 100,
  sewingQuantity: 100,
  factoryName: null,
  tailReceivedQty: 100,
  tailShippedQty: 0,
  tailInboundQty: 0,
  defectQuantity: 0,
  remark: null,
  timeRating: '',
  ...overrides,
})

describe('useFinishingPackaging — partial / full', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('全部入库：本次合计等于剩余 → mode=full 调接口', async () => {
    const selectedRows = ref([makeRow()])
    const c = useFinishingPackaging({
      selectedRows,
      reloadList: async () => {},
      reloadTabCounts: async () => {},
    })
    await c.openPackagingCompleteDialog()
    c.packagingCompleteDialog.items[0].inboundQuantities[0] = 100
    await c.submitPackagingComplete('full')
    expect(registerFinishingPackagingComplete).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 1, mode: 'full', tailInboundQty: 100, defectQuantity: 0 }),
    )
  })

  it('部分入库：本次合计小于剩余 → mode=partial 调接口', async () => {
    const selectedRows = ref([makeRow()])
    const c = useFinishingPackaging({
      selectedRows,
      reloadList: async () => {},
      reloadTabCounts: async () => {},
    })
    await c.openPackagingCompleteDialog()
    c.packagingCompleteDialog.items[0].inboundQuantities[0] = 50
    await c.submitPackagingComplete('partial')
    expect(registerFinishingPackagingComplete).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 1, mode: 'partial', tailInboundQty: 50, defectQuantity: 0 }),
    )
  })

  it('全部入库未填满：报错且不调接口', async () => {
    const selectedRows = ref([makeRow()])
    const c = useFinishingPackaging({
      selectedRows,
      reloadList: async () => {},
      reloadTabCounts: async () => {},
    })
    await c.openPackagingCompleteDialog()
    c.packagingCompleteDialog.items[0].inboundQuantities[0] = 50
    await c.submitPackagingComplete('full')
    expect(registerFinishingPackagingComplete).not.toHaveBeenCalled()
  })

  it('部分入库超过剩余：报错且不调接口', async () => {
    const selectedRows = ref([makeRow({ tailInboundQty: 70 })])
    const c = useFinishingPackaging({
      selectedRows,
      reloadList: async () => {},
      reloadTabCounts: async () => {},
    })
    await c.openPackagingCompleteDialog()
    c.packagingCompleteDialog.items[0].inboundQuantities[0] = 50
    await c.submitPackagingComplete('partial')
    expect(registerFinishingPackagingComplete).not.toHaveBeenCalled()
  })

  it('多尺码部分入库：不被按尺码=收货数的校验拦截，正常调接口', async () => {
    // 回归 C1：register 模式不应跑 assertPackagingPerSize（该校验要求每码入库+次品===该码收货数，
    // 对部分入库必然不成立）。仅 amend 模式才校验。
    vi.mocked(getFinishingRegisterFormData).mockResolvedValueOnce({
      data: {
        headers: ['S', 'M', '合计'],
        orderRow: [60, 40, 100],
        cutRow: [60, 40, 100],
        sewingRow: [60, 40, 100],
        tailReceivedRow: [60, 40, 100],
        tailInboundRow: null,
        defectRow: null,
      },
    } as Awaited<ReturnType<typeof getFinishingRegisterFormData>>)
    const selectedRows = ref([makeRow()])
    const c = useFinishingPackaging({
      selectedRows,
      reloadList: async () => {},
      reloadTabCounts: async () => {},
    })
    await c.openPackagingCompleteDialog()
    // 本批只入 S 码 30 件，远未填满任何一码的收货数
    c.packagingCompleteDialog.items[0].inboundQuantities[0] = 30
    c.packagingCompleteDialog.items[0].inboundQuantities[1] = 0
    await c.submitPackagingComplete('partial')
    expect(registerFinishingPackagingComplete).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 1, mode: 'partial', tailInboundQty: 30, defectQuantity: 0 }),
    )
  })

  it('remainingQty / alreadyInboundQty 暴露给视图', async () => {
    const selectedRows = ref([makeRow({ tailInboundQty: 30, defectQuantity: 5 })])
    const c = useFinishingPackaging({
      selectedRows,
      reloadList: async () => {},
      reloadTabCounts: async () => {},
    })
    await c.openPackagingCompleteDialog()
    const item = c.packagingCompleteDialog.items[0]
    expect(c.remainingQty(item)).toBe(100 - 30 - 5)
    expect(c.alreadyInboundQty(item)).toBe(30)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { FinishingListItem } from '@/api/production-finishing'

vi.mock('@/api/production-finishing', () => ({
  registerFinishingReceive: vi.fn(async () => ({ data: undefined })),
  getFinishingRegisterFormData: vi.fn(async () => ({
    data: {
      headers: ['S', 'M', '合计'],
      sizeHeaders: ['S', 'M'],
      orderRow: [7, 15, 22],
      cutRow: [7, 15, 22],
      sewingRow: [7, 15, 22],
      tailReceivedRow: [null, null, 0],
      tailInboundRow: null,
      defectRow: null,
      planColorRows: [{ colorName: '杏色', quantities: [7, 15] }],
      cutColorRows: [{ colorName: '杏色', quantities: [7, 15] }],
      sewingColorRows: [{ colorName: '杏色', quantities: [7, 15] }],
      tailReceivedColorRows: [],
      tailInboundColorRows: [],
      defectColorRows: [],
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

import { useFinishingReceive } from './useFinishingReceive'
import { registerFinishingReceive } from '@/api/production-finishing'

const row: FinishingListItem = {
  orderId: 1,
  orderNo: 'O-1',
  skuCode: 'SKU-1',
  imageUrl: '',
  customerName: '',
  salesperson: '',
  merchandiser: '',
  quantity: 22,
  customerDueDate: null,
  arrivedAt: null,
  completedAt: null,
  finishingStatus: 'pending_receive',
  cutTotal: 22,
  sewingQuantity: 22,
  factoryName: null,
  tailReceivedQty: 0,
  tailShippedQty: 0,
  tailInboundQty: 0,
  defectQuantity: 0,
  remark: null,
  timeRating: '',
}

describe('useFinishingReceive — 真实收货录入', () => {
  beforeEach(() => vi.clearAllMocks())

  it('打开登记时不复制车缝数量，实际收货必须由用户填写', async () => {
    const c = useFinishingReceive({
      selectedRows: ref([row]),
      reloadList: async () => {},
      reloadTabCounts: async () => {},
    })
    await c.openReceiveDialog()
    expect(c.receiveDialog.tailReceivedQuantitiesByColor).toEqual([
      { colorName: '杏色', quantities: [0, 0] },
    ])
    expect(registerFinishingReceive).not.toHaveBeenCalled()
  })
})

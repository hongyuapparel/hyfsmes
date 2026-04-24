import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getCuttingCompletedDetail, type CuttingCompletedDetailRes, type CuttingListItem } from '@/api/production-cutting'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { formatDisplayNumber } from '@/utils/display-number'
import type { ProductionOrderBriefModel } from '@/components/production/ProductionOrderBriefPanel.vue'

export function useCuttingDetail() {
  const detailDrawer = reactive<{ visible: boolean; loading: boolean; row: CuttingListItem | null }>({
    visible: false,
    loading: false,
    row: null,
  })
  const detailPayload = ref<CuttingCompletedDetailRes | null>(null)

  function cuttingBriefFromRow(row: CuttingListItem): ProductionOrderBriefModel {
    return {
      orderNo: row.orderNo,
      skuCode: row.skuCode,
      imageUrl: row.imageUrl,
      customerName: row.customerName,
      merchandiser: row.merchandiser,
      customerDueDate: row.customerDueDate,
      orderQuantity: row.quantity,
    }
  }

  const detailGrandPieces = computed(() => {
    const rows = detailPayload.value?.actualCutRows ?? []
    return rows.reduce(
      (sum, r) =>
        sum +
        (Array.isArray(r.quantities) ? r.quantities.reduce((a, q) => a + (Number(q) || 0), 0) : 0),
      0,
    )
  })

  const cuttingDetailDrawerSize = computed(() =>
    detailDrawer.row?.cuttingStatus === 'completed' ? 940 : '460px',
  )

  function onDetailDrawerClosed() {
    detailPayload.value = null
    detailDrawer.row = null
  }

  function displayDash(v: string | null | undefined) {
    const s = (v ?? '').trim()
    return s || '—'
  }

  function moneyDisplay(v: string | null | undefined) {
    if (v == null || String(v).trim() === '') return '—'
    return formatDisplayNumber(v)
  }

  function fabricMetersDisplay(v: string | null | undefined) {
    if (v == null || String(v).trim() === '') return '—'
    return formatDisplayNumber(v)
  }

  async function openCuttingDetailDrawer(row: CuttingListItem) {
    detailDrawer.row = row
    detailDrawer.visible = true
    detailPayload.value = null
    if (row.cuttingStatus !== 'completed') return
    detailDrawer.loading = true
    try {
      const res = await getCuttingCompletedDetail(row.orderId)
      detailPayload.value = res.data ?? null
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载详情失败'))
      detailDrawer.visible = false
    } finally {
      detailDrawer.loading = false
    }
  }

  return {
    detailDrawer,
    detailPayload,
    cuttingBriefFromRow,
    detailGrandPieces,
    cuttingDetailDrawerSize,
    onDetailDrawerClosed,
    displayDash,
    moneyDisplay,
    fabricMetersDisplay,
    openCuttingDetailDrawer,
  }
}

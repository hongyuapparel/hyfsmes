import { computed, reactive, ref, type Ref } from 'vue'
import type { FinishedStockRow } from '@/api/inventory'
import { normalizeColorName, isStockTableLeafRow, type StockTableLeafRow, type StockTableRow } from '@/utils/finishedStockTableUtils'

type DetailDrawerState = {
  visible: boolean
  stockId: number | null
  groupProductImage: string
  groupSizeHeaders: string[]
  selectedColorName: string | null
  selectedQuantity: number | null
}

type InboundDialogState = {
  visible: boolean
  stockId: number | null
  stockLabel: string
}

type OutboundDialogState = {
  visible: boolean
  stockId: number | null
  stockInfo: {
    orderId: number | null
    orderNo: string
    skuCode: string
    customerName: string
    quantity: number
    imageUrl: string
    colorName: string
    sizeBreakdown: FinishedStockRow['sizeBreakdown'] | null
    colorImages: Array<{ colorName: string; imageUrl: string }>
  } | null
}

type StockInteractionsOptions = {
  list: Ref<FinishedStockRow[]>
  getSharedProductImageUrl: (row: StockTableRow) => string
  getGroupSizeHeaders: (row: StockTableRow) => string[]
  load: () => void | Promise<void>
}

export function useFinishedViewStockInteractions(options: StockInteractionsOptions) {
  const { list, getSharedProductImageUrl, getGroupSizeHeaders, load } = options

  const selectedRows = ref<StockTableLeafRow[]>([])
  const pendingRows = computed(() => selectedRows.value.filter((row) => row.type === 'pending'))
  const storedRows = computed(() => selectedRows.value.filter((row) => row.type === 'stored'))
  const hasPendingSelection = computed(() => pendingRows.value.length > 0)
  const hasStoredSelection = computed(() => storedRows.value.length > 0)

  const detailDrawer = reactive<DetailDrawerState>({
    visible: false,
    stockId: null,
    groupProductImage: '',
    groupSizeHeaders: [],
    selectedColorName: null,
    selectedQuantity: null,
  })

  const inboundDialog = reactive<InboundDialogState>({
    visible: false,
    stockId: null,
    stockLabel: '',
  })

  const outboundDialog = reactive<OutboundDialogState>({
    visible: false,
    stockId: null,
    stockInfo: null,
  })

  const createDialogVisible = ref(false)
  const createSeed = ref<StockTableLeafRow | null>(null)

  function onSelectionChange(rows: StockTableRow[]) {
    selectedRows.value = rows.filter((row): row is StockTableLeafRow => isStockTableLeafRow(row))
  }

  function openDetail(row: StockTableRow) {
    if (!isStockTableLeafRow(row)) return
    detailDrawer.groupProductImage = getSharedProductImageUrl(row)
    detailDrawer.groupSizeHeaders = getGroupSizeHeaders(row)
    detailDrawer.stockId = row.id
    detailDrawer.selectedColorName = row._selectedColorName != null ? normalizeColorName(row._selectedColorName) : null
    detailDrawer.selectedQuantity = row.quantity != null ? Math.max(0, Math.trunc(Number(row.quantity) || 0)) : null
    detailDrawer.visible = true
  }

  function openInboundDialog() {
    if (!pendingRows.value.length) return
    const first = pendingRows.value[0]
    inboundDialog.stockId = first?.id ?? null
    inboundDialog.stockLabel = `${first?.orderNo || '-'} / ${first?.skuCode || '-'}`
    inboundDialog.visible = true
  }

  function openOutboundDialog() {
    if (storedRows.value.length === 0) return
    const row = { ...storedRows.value[0] }
    outboundDialog.stockId = row.id
    outboundDialog.stockInfo = {
      orderId: row.orderId ?? null,
      orderNo: row.orderNo || '',
      skuCode: row.skuCode || '',
      customerName: row.customerName || '',
      quantity: Number(row.quantity) || 0,
      imageUrl: getSharedProductImageUrl(row) || '',
      colorName: normalizeColorName(row._selectedColorName || row._displayColor),
      sizeBreakdown: row.sizeBreakdown ?? null,
      colorImages: Array.isArray(row.colorImages) ? row.colorImages : [],
    }
    outboundDialog.visible = true
  }

  function openCreateDialog() {
    createSeed.value = storedRows.value.length === 1 ? { ...storedRows.value[0] } : null
    createDialogVisible.value = true
  }

  function syncStockColorImage(stockId: number, colorName: string, imageUrl: string) {
    const targetColorName = normalizeColorName(colorName)
    if (!targetColorName) return
    list.value = list.value.map((item) => {
      if (item.id !== stockId) return item
      const colorImages = Array.isArray(item.colorImages) ? [...item.colorImages] : []
      const index = colorImages.findIndex((entry) => normalizeColorName(entry.colorName) === targetColorName)
      if (imageUrl) {
        const nextEntry = { ...(index >= 0 ? colorImages[index] : {}), colorName: targetColorName, imageUrl }
        if (index >= 0) colorImages[index] = nextEntry
        else colorImages.push(nextEntry)
      } else if (index >= 0) {
        colorImages.splice(index, 1)
      }
      return { ...item, colorImages }
    })
  }

  function syncStockColorImages(
    stockId: number,
    colorImages: Array<{ colorName?: string; imageUrl?: string }> | null | undefined,
  ) {
    const normalized = Array.isArray(colorImages)
      ? colorImages
          .map((item) => ({
            colorName: normalizeColorName(item?.colorName),
            imageUrl: String(item?.imageUrl ?? '').trim(),
          }))
          .filter((item) => item.colorName && item.imageUrl)
      : []
    list.value = list.value.map((item) => (item.id === stockId ? { ...item, colorImages: normalized } : item))
  }

  function onColorImagesSynced(stockId: number, colorImages: Array<{ colorName?: string; imageUrl?: string }>) {
    syncStockColorImages(stockId, colorImages)
  }

  function onColorImageSaved(payload: { stockId: number; colorName: string; imageUrl: string }) {
    syncStockColorImage(payload.stockId, payload.colorName, payload.imageUrl)
  }

  async function onMetaSaved() {
    await load()
  }

  function clearSelection() {
    selectedRows.value = []
  }

  return {
    selectedRows,
    hasPendingSelection,
    hasStoredSelection,
    detailDrawer,
    inboundDialog,
    outboundDialog,
    createDialogVisible,
    createSeed,
    onSelectionChange,
    openDetail,
    openInboundDialog,
    openOutboundDialog,
    openCreateDialog,
    onColorImagesSynced,
    onColorImageSaved,
    onMetaSaved,
    clearSelection,
  }
}

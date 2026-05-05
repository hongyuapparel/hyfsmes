import { computed, reactive, ref, type Ref } from 'vue'
import type { FinishedStockRow } from '@/api/inventory'
import type { FinishedCreateQuickAddSource } from '@/composables/useFinishedCreateForm'
import { buildFinishedQuickAddSourceFromRows } from '@/composables/finishedQuickAddSource'
import {
  buildFinishedGroupColorImages,
  buildFinishedGroupColorSizeSnapshot,
} from '@/composables/finishedStockGroupDetail'
import {
  normalizeColorName,
  isStockTableLeafRow,
  isStockTableParentRow,
  type NormalizedStoredBreakdownSnapshot,
  type StockTableLeafRow,
  type StockTableRow,
} from '@/utils/finishedStockTableUtils'

type DetailDrawerState = {
  visible: boolean
  stockId: number | null
  groupProductImage: string
  groupSizeHeaders: string[]
  groupColorSizeSnapshot: NormalizedStoredBreakdownSnapshot | null
  groupColorImages: Array<{ colorName: string; imageUrl: string }>
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
  getGroupLeafRows: (row: StockTableRow) => StockTableLeafRow[]
  getGroupSizeHeaders: (row: StockTableRow) => string[]
  load: () => void | Promise<void>
}

export function useFinishedViewStockInteractions(options: StockInteractionsOptions) {
  const { list, getSharedProductImageUrl, getGroupLeafRows, getGroupSizeHeaders, load } = options

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
    groupColorSizeSnapshot: null,
    groupColorImages: [],
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

  const createDrawerVisible = ref(false)
  const createSeed = ref<FinishedCreateQuickAddSource | null>(null)

  function onSelectionChange(rows: StockTableRow[]) {
    // Parent row selection expands to visible child rows; count by table row key, not stock id.
    const seen = new Set<string>()
    const result: StockTableLeafRow[] = []
    rows.forEach((row) => {
      if (isStockTableParentRow(row)) {
        row._children.forEach((child) => {
          if (!seen.has(child._uiKey)) {
            seen.add(child._uiKey)
            result.push(child)
          }
        })
      } else if (isStockTableLeafRow(row)) {
        if (!seen.has(row._uiKey)) {
          seen.add(row._uiKey)
          result.push(row)
        }
      }
    })
    selectedRows.value = result
  }

  function openDetail(row: StockTableRow) {
    const detailRow = isStockTableParentRow(row) ? row._children[0] : row
    if (!isStockTableLeafRow(detailRow)) return
    detailDrawer.groupProductImage = getSharedProductImageUrl(row)
    detailDrawer.groupSizeHeaders = getGroupSizeHeaders(row)
    detailDrawer.groupColorSizeSnapshot = buildFinishedGroupColorSizeSnapshot(row, getGroupLeafRows, getGroupSizeHeaders)
    detailDrawer.groupColorImages = buildFinishedGroupColorImages(row, getGroupLeafRows)
    detailDrawer.stockId = detailRow.id
    detailDrawer.selectedColorName = isStockTableParentRow(row)
      ? null
      : detailRow._selectedColorName != null
        ? normalizeColorName(detailRow._selectedColorName)
        : null
    detailDrawer.selectedQuantity = isStockTableParentRow(row)
      ? null
      : detailRow.quantity != null
        ? Math.max(0, Math.trunc(Number(detailRow.quantity) || 0))
        : null
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

  function openCreateDrawer() {
    if (storedRows.value.length >= 1) {
      createSeed.value = buildFinishedQuickAddSourceFromRows(
        storedRows.value,
        getSharedProductImageUrl,
        getGroupSizeHeaders,
      )
    } else {
      createSeed.value = null
    }
    createDrawerVisible.value = true
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
    createDrawerVisible,
    createSeed,
    onSelectionChange,
    openDetail,
    openInboundDialog,
    openOutboundDialog,
    openCreateDrawer,
    onColorImagesSynced,
    onColorImageSaved,
    onMetaSaved,
    clearSelection,
  }
}

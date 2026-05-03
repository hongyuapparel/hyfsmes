import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  type FinishedStockDetailRes,
  getFinishedStockDetail,
  updateFinishedStockMeta,
  upsertFinishedStockColorImage,
} from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { createAdjustLogSummaryBuilder, mergeSizeHeaders } from '@/composables/useFinishedDetailHelpers'
import { useFinishedDetailDisplayData } from '@/composables/useFinishedDetailDisplayData'
import type { NormalizedStoredBreakdownSnapshot } from '@/utils/finishedStockTableUtils'

export type FinishedDetailEditForm = {
  department: string
  inventoryTypeId: number | null
  warehouseId: number | null
  location: string
  unitPrice: string
  imageUrl: string
  remark: string
}

type UseFinishedDetailDataOptions = {
  inventoryTypeOptions: () => Array<{ id: number; label: string }>
  warehouseOptions: () => Array<{ id: number; label: string }>
  onColorImagesSynced: (stockId: number, colorImages: unknown[]) => void
  onColorImageSaved: (payload: { stockId: number; colorName: string; imageUrl: string }) => void
  onMetaSaved: () => void
}

type OpenDetailPayload = {
  stockId: number
  groupProductImage: string
  groupSizeHeaders: string[]
  groupColorSizeSnapshot: NormalizedStoredBreakdownSnapshot | null
  groupColorImages: Array<{ colorName: string; imageUrl: string }>
  initialColorName: string | null
  initialQuantity: number | null
}

type FinishedDetailData = FinishedStockDetailRes & {
  groupSizeHeaders?: string[]
}

type StockMeta = {
  department?: string
  inventoryTypeId?: number | null
  warehouseId?: number | null
  location?: string
  unitPrice?: number | string | null
  imageUrl?: string
  quantity?: number
}

export function useFinishedDetailData(options: UseFinishedDetailDataOptions) {
  const loading = ref(false)
  const saving = ref(false)
  const data = ref<FinishedDetailData | null>(null)
  const colorImageMap = ref<Record<string, string>>({})
  const selectedColorName = ref<string | null>(null)
  const selectedQuantity = ref<number | null>(null)
  const internalGroupProductImage = ref('')
  const internalGroupSizeHeaders = ref<string[]>([])
  const internalGroupColorSizeSnapshot = ref<NormalizedStoredBreakdownSnapshot | null>(null)
  const internalGroupColorImages = ref<Array<{ colorName: string; imageUrl: string }>>([])
  const metaEditing = ref(false)

  const editForm = reactive<FinishedDetailEditForm>({
    department: '',
    inventoryTypeId: null,
    warehouseId: null,
    location: '',
    unitPrice: '',
    imageUrl: '',
    remark: '',
  })

  function findInventoryTypeLabel(id: number | null | undefined): string {
    if (id == null) return ''
    return options.inventoryTypeOptions().find((item) => item.id === id)?.label ?? ''
  }

  function findWarehouseLabel(id: number | null | undefined): string {
    if (id == null) return ''
    return options.warehouseOptions().find((item) => item.id === id)?.label ?? ''
  }

  const getAdjustLogSummary = createAdjustLogSummaryBuilder({ findInventoryTypeLabel, findWarehouseLabel })
  const adjustLogs = computed(() => {
    const logs = Array.isArray(data.value?.adjustLogs) ? data.value.adjustLogs : []
    return logs.map((log, index) => {
      const item = (log ?? {}) as Record<string, unknown>
      return {
        id: String(item.id ?? index),
        operatorUsername: String(item.operatorUsername ?? ''),
        createdAt: String(item.createdAt ?? ''),
        summary: getAdjustLogSummary(item),
      }
    })
  })

  const displayProductImage = computed(() => {
    const stock = data.value?.stock as StockMeta | undefined
    return String(stock?.imageUrl || internalGroupProductImage.value || data.value?.productImageUrl || '')
  })

  const {
    displaySizeHeaders,
    displayColorSizeRows,
    tableUnitPrice,
    rowTotalPrice,
    getColorSizeSummary,
  } = useFinishedDetailDisplayData({
    data,
    groupSizeHeaders: internalGroupSizeHeaders,
    groupSnapshot: internalGroupColorSizeSnapshot,
    selectedColorName,
    selectedQuantity,
    metaEditing,
    editUnitPrice: () => editForm.unitPrice,
  })

  function fillEditFormFromStock() {
    const stock = data.value?.stock as StockMeta | undefined
    editForm.department = stock?.department ?? ''
    editForm.inventoryTypeId = stock?.inventoryTypeId ?? null
    editForm.warehouseId = stock?.warehouseId ?? null
    editForm.location = stock?.location ?? ''
    editForm.unitPrice = stock?.unitPrice != null ? String(stock.unitPrice) : ''
    editForm.imageUrl = stock?.imageUrl ?? ''
    editForm.remark = ''
  }

  async function loadDetail(stockId: number) {
    loading.value = true
    saving.value = false
    data.value = null
    colorImageMap.value = {}
    try {
      const detail = (await getFinishedStockDetail(stockId)).data as FinishedDetailData
      data.value = detail
      internalGroupSizeHeaders.value = mergeSizeHeaders(
        internalGroupSizeHeaders.value,
        Array.isArray(detail?.groupSizeHeaders) ? detail.groupSizeHeaders : [],
        Array.isArray(detail?.colorSize?.headers) ? detail.colorSize.headers : [],
      )
      const records = Array.isArray(detail?.colorImages) ? detail.colorImages : []
      const nextColorImageMap: Record<string, string> = {}
      // 先用整组聚合的图片填充（覆盖整个 SKU 组所有颜色）
      internalGroupColorImages.value.forEach((entry) => {
        const colorName = String(entry?.colorName ?? '').trim()
        const imageUrl = String(entry?.imageUrl ?? '').trim()
        if (colorName && imageUrl) nextColorImageMap[colorName] = imageUrl
      })
      // 再用当前 stock 的图片覆盖（最准确）
      records.forEach((record) => {
        const colorName = String(record?.colorName ?? '').trim()
        const imageUrl = String(record?.imageUrl ?? '').trim()
        if (colorName && imageUrl) nextColorImageMap[colorName] = imageUrl
      })
      colorImageMap.value = nextColorImageMap
      fillEditFormFromStock()
      metaEditing.value = false
      options.onColorImagesSynced(stockId, records)
    } catch (error: unknown) {
      if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
    } finally {
      loading.value = false
    }
  }

  function toggleEditMode() {
    if (!metaEditing.value && data.value?.stock) fillEditFormFromStock()
    metaEditing.value = !metaEditing.value
  }

  async function saveMeta(stockId: number) {
    saving.value = true
    try {
      await updateFinishedStockMeta(stockId, {
        department: editForm.department,
        inventoryTypeId: editForm.inventoryTypeId,
        warehouseId: editForm.warehouseId,
        location: editForm.location,
        unitPrice: editForm.unitPrice?.trim() || '0',
        imageUrl: editForm.imageUrl?.trim() || '',
        remark: editForm.remark || undefined,
      })
      ElMessage.success('保存成功')
      await loadDetail(stockId)
      options.onMetaSaved()
      metaEditing.value = false
    } catch (error: unknown) {
      if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
    } finally {
      saving.value = false
    }
  }

  async function saveColorImage(stockId: number, colorName: string, url: string) {
    const imageUrl = (url ?? '').trim()
    try {
      await upsertFinishedStockColorImage(stockId, { colorName, imageUrl })
      if (imageUrl) colorImageMap.value[colorName] = imageUrl
      else delete colorImageMap.value[colorName]
      ElMessage.success(imageUrl ? '已保存图片' : '已清除图片')
      options.onColorImageSaved({ stockId, colorName, imageUrl })
    } catch (error: unknown) {
      if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
    }
  }

  function openDetail(payload: OpenDetailPayload) {
    internalGroupProductImage.value = payload.groupProductImage
    internalGroupSizeHeaders.value = [...payload.groupSizeHeaders]
    internalGroupColorSizeSnapshot.value = payload.groupColorSizeSnapshot
    internalGroupColorImages.value = Array.isArray(payload.groupColorImages)
      ? [...payload.groupColorImages]
      : []
    selectedColorName.value = payload.initialColorName
    selectedQuantity.value = payload.initialQuantity
    void loadDetail(payload.stockId)
  }

  return {
    loading,
    saving,
    data,
    editForm,
    metaEditing,
    colorImageMap,
    adjustLogs,
    displayProductImage,
    displaySizeHeaders,
    displayColorSizeRows,
    tableUnitPrice,
    rowTotalPrice,
    getColorSizeSummary,
    findInventoryTypeLabel,
    findWarehouseLabel,
    toggleEditMode,
    saveMeta,
    saveColorImage,
    openDetail,
  }
}

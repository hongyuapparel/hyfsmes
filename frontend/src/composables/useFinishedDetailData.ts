import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  type FinishedStockDetailRes,
  getFinishedStockDetail,
  updateFinishedStockMeta,
  upsertFinishedStockColorImage,
} from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import {
  allocateByWeight,
  createAdjustLogSummaryBuilder,
  formatPrice,
  formatTotalPrice,
  mergeSizeHeaders,
  normalizeColorName,
  normalizeStoredSnapshot,
  remapValuesByHeaders,
  snapshotRowTotal,
  sumRowQty,
} from '@/composables/useFinishedDetailHelpers'

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
  initialColorName: string | null
  initialQuantity: number | null
}

type FinishedDetailData = FinishedStockDetailRes & {
  groupSizeHeaders?: string[]
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

  const getAdjustLogSummary = createAdjustLogSummaryBuilder({
    findInventoryTypeLabel,
    findWarehouseLabel,
  })

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
    const stockImage =
      data.value?.stock && typeof data.value.stock === 'object'
        ? (data.value.stock as { imageUrl?: string }).imageUrl
        : ''
    return String(stockImage || internalGroupProductImage.value || data.value?.productImageUrl || '')
  })

  const displayColorSizeData = computed(() => {
    const detail = data.value
    const colorSize = detail?.colorSize as
      | { headers?: string[]; rows?: Array<{ colorName?: string; quantities?: number[] }> }
      | undefined
    const headers = Array.isArray(colorSize?.headers) ? colorSize.headers : []
    const rows = Array.isArray(colorSize?.rows) ? colorSize.rows : []
    const targetHeaders = mergeSizeHeaders(internalGroupSizeHeaders.value, headers)

    const hasSelectedColor = selectedColorName.value !== null
    const selectedName = hasSelectedColor ? normalizeColorName(selectedColorName.value) : ''
    const filteredRows = hasSelectedColor
      ? rows.filter((row) => normalizeColorName(row.colorName) === selectedName)
      : rows
    const stockQuantity = Math.max(
      0,
      Math.trunc(
        selectedQuantity.value != null
          ? Number(selectedQuantity.value)
          : Number((detail?.stock as { quantity?: number } | undefined)?.quantity) || 0,
      ),
    )

    if (!targetHeaders.length || !rows.length) {
      return { headers: [], rows: [] as Array<{ colorName: string; quantities: number[] }> }
    }

    const normalizedSnapshot = normalizeStoredSnapshot({
      headers,
      rows: rows.map((row) => ({
        colorName: row.colorName,
        values: Array.isArray(row.quantities) ? [...row.quantities] : [],
      })),
    })

    if (normalizedSnapshot) {
      const visibleRows = hasSelectedColor
        ? normalizedSnapshot.rows.filter((row) => normalizeColorName(row.colorName) === selectedName)
        : normalizedSnapshot.rows
      if (!visibleRows.length) return { headers: [], rows: [] }
      const displayHeaders = mergeSizeHeaders(targetHeaders, normalizedSnapshot.headers)
      const displayRows = visibleRows
        .map((row) => ({
          colorName: row.colorName,
          quantities: remapValuesByHeaders(normalizedSnapshot.headers, row.values, displayHeaders),
        }))
        .filter((row) => snapshotRowTotal(row.quantities) > 0)
      return displayRows.length ? { headers: displayHeaders, rows: displayRows } : { headers: [], rows: [] }
    }

    if (!filteredRows.length) return { headers: [], rows: [] }
    const orderTotal = filteredRows.reduce((sum, row) => {
      const rowSum = Array.isArray(row.quantities)
        ? row.quantities.reduce((rowTotal, quantity) => rowTotal + (Number(quantity) || 0), 0)
        : 0
      return sum + rowSum
    }, 0)

    if (orderTotal === stockQuantity) {
      return {
        headers: [...targetHeaders],
        rows: filteredRows
          .map((row) => ({
            colorName: String(row.colorName ?? ''),
            quantities: remapValuesByHeaders(headers, row.quantities ?? [], targetHeaders),
          }))
          .filter((row) => snapshotRowTotal(row.quantities) > 0),
      }
    }

    const weights: number[] = []
    filteredRows.forEach((row) => {
      for (let index = 0; index < headers.length; index += 1) {
        weights.push(Math.max(0, Number(row.quantities?.[index]) || 0))
      }
    })
    const allocated = allocateByWeight(weights, stockQuantity)
    let cursor = 0
    const scaledRows = filteredRows.map((row) => {
      const quantities: number[] = []
      for (let index = 0; index < headers.length; index += 1) {
        quantities.push(allocated[cursor] ?? 0)
        cursor += 1
      }
      return { colorName: String(row.colorName ?? ''), quantities }
    })

    return {
      headers: [...targetHeaders],
      rows: scaledRows
        .map((row) => ({
          colorName: row.colorName,
          quantities: remapValuesByHeaders(headers, row.quantities, targetHeaders),
        }))
        .filter((row) => snapshotRowTotal(row.quantities) > 0),
    }
  })

  const displaySizeHeaders = computed(() => displayColorSizeData.value.headers)
  const displayColorSizeRows = computed(() => displayColorSizeData.value.rows)
  const totalQty = computed(() =>
    displayColorSizeRows.value.reduce((sum, row) => sum + sumRowQty(row.quantities), 0),
  )
  const unitPriceValue = computed(() =>
    metaEditing.value
      ? editForm.unitPrice
      : String((data.value?.stock as { unitPrice?: string } | undefined)?.unitPrice ?? ''),
  )
  const tableUnitPrice = computed(() => formatPrice(unitPriceValue.value))
  const tableTotalPrice = computed(() => formatTotalPrice(totalQty.value, unitPriceValue.value))

  function rowTotalPrice(quantities: unknown[]): string {
    return formatTotalPrice(sumRowQty(quantities), unitPriceValue.value)
  }

  function getColorSizeSummary({ columns }: { columns: Array<{ label?: string }> }) {
    const headerLength = displaySizeHeaders.value.length
    return columns.map((_, index) => {
      if (index === 0) return '汇总'
      if (index === 2 + headerLength) return String(totalQty.value)
      if (index === 3 + headerLength) return tableUnitPrice.value
      if (index === 4 + headerLength) return tableTotalPrice.value
      return ''
    })
  }

  function fillEditFormFromStock() {
    const stock = data.value?.stock as
      | {
          department?: string
          inventoryTypeId?: number | null
          warehouseId?: number | null
          location?: string
          unitPrice?: number | string | null
          imageUrl?: string
        }
      | undefined
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
      const result = await getFinishedStockDetail(stockId)
      const detail = result.data as FinishedDetailData
      data.value = detail
      internalGroupSizeHeaders.value = mergeSizeHeaders(
        internalGroupSizeHeaders.value,
        Array.isArray(detail?.groupSizeHeaders) ? (detail.groupSizeHeaders as string[]) : [],
        Array.isArray((detail?.colorSize as { headers?: string[] } | undefined)?.headers)
          ? ((detail?.colorSize as { headers: string[] }).headers ?? [])
          : [],
      )

      const colorImageRecords = Array.isArray(detail?.colorImages) ? detail.colorImages : []
      const nextColorImageMap: Record<string, string> = {}
      colorImageRecords.forEach((record) => {
        const imageRecord = (record ?? {}) as { colorName?: string; imageUrl?: string }
        if (!imageRecord.colorName) return
        nextColorImageMap[String(imageRecord.colorName)] = String(imageRecord.imageUrl ?? '')
      })
      colorImageMap.value = nextColorImageMap
      fillEditFormFromStock()
      metaEditing.value = false
      options.onColorImagesSynced(stockId, colorImageRecords)
    } catch (error: unknown) {
      if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
    } finally {
      loading.value = false
    }
  }

  function toggleEditMode() {
    if (!metaEditing.value && data.value?.stock) {
      fillEditFormFromStock()
    }
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
      if (imageUrl) {
        colorImageMap.value[colorName] = imageUrl
        ElMessage.success('已保存图片')
      } else {
        delete colorImageMap.value[colorName]
        ElMessage.success('已清除图片')
      }
      options.onColorImageSaved({ stockId, colorName, imageUrl })
    } catch (error: unknown) {
      if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
    }
  }

  function openDetail(payload: OpenDetailPayload) {
    internalGroupProductImage.value = payload.groupProductImage
    internalGroupSizeHeaders.value = [...payload.groupSizeHeaders]
    selectedColorName.value = payload.initialColorName
    selectedQuantity.value = payload.initialQuantity
    loadDetail(payload.stockId)
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

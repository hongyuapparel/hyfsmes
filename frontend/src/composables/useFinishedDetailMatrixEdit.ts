import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FinishedCreateRowMetaField } from '@/composables/useFinishedCreateForm'

export type FinishedDetailMatrixRow = {
  _key: string
  stockId: number | null
  colorName: string
  imageUrl: string
  quantities: number[]
  unitPrice: string
  department: string
  inventoryTypeId: number | null
  warehouseId: number | null
  location: string
  _overrides: Partial<Record<FinishedCreateRowMetaField, boolean>>
  _priceOverride?: boolean
}

export type FinishedDetailColorMeta = {
  stockId: number
  colorName: string
  department: string
  inventoryTypeId: number | null
  warehouseId: number | null
  location: string
  unitPrice: string
  quantities: number[]
}

type DetailSourceRow = {
  colorName: string
  imageUrl?: string
  stockId?: number
  unitPrice?: string
  quantities: number[]
  department?: string
  inventoryTypeId?: number | null
  warehouseId?: number | null
  location?: string
}
type DetailRowMeta = {
  department: string
  inventoryTypeId: number | null
  warehouseId: number | null
  location: string
}

function rowQty(row: { quantities: unknown[] }): number {
  return row.quantities.reduce<number>((sum, value) => sum + Math.max(0, Math.trunc(Number(value) || 0)), 0)
}

function emptyOverrides(): FinishedDetailMatrixRow['_overrides'] {
  return { department: false, inventoryTypeId: false, warehouseId: false, location: false }
}

export function useFinishedDetailMatrixEdit() {
  const editSizeHeaders = ref<string[]>([])
  const editSizeRows = ref<FinishedDetailMatrixRow[]>([])

  function resetEditMatrix(
    headers: string[],
    rows: DetailSourceRow[],
    colorImageMap: Record<string, string>,
    meta: DetailRowMeta,
  ) {
    editSizeHeaders.value = [...headers]
    editSizeRows.value = rows.map((row, index) => ({
      _key: `${row.stockId ?? 'na'}-${row.colorName || 'color'}-${index}`,
      stockId: row.stockId ?? null,
      unitPrice: row.unitPrice ?? '',
      colorName: row.colorName,
      imageUrl: String(row.imageUrl ?? '').trim() || colorImageMap[row.colorName] || '',
      quantities: [...row.quantities],
      department: row.department ?? meta.department,
      inventoryTypeId: row.inventoryTypeId ?? meta.inventoryTypeId,
      warehouseId: row.warehouseId ?? meta.warehouseId,
      location: row.location ?? meta.location,
      _overrides: emptyOverrides(),
    }))
  }

  function syncRowsFromBasicInfo(meta: DetailRowMeta) {
    editSizeRows.value.forEach((row) => {
      row.department = meta.department
      row.inventoryTypeId = meta.inventoryTypeId
      row.warehouseId = meta.warehouseId
      row.location = meta.location
      row._overrides = emptyOverrides()
    })
  }

  function addDetailColorRow(meta: DetailRowMeta) {
    editSizeRows.value.push({
      _key: `new-${Date.now()}`,
      stockId: null,
      colorName: '新颜色',
      imageUrl: '',
      unitPrice: '',
      quantities: editSizeHeaders.value.map(() => 0),
      ...meta,
      _overrides: emptyOverrides(),
    })
  }

  function addDetailSizeColumn() {
    editSizeHeaders.value.push('新尺码')
    editSizeRows.value.forEach((row) => row.quantities.push(0))
  }

  function removeDetailColorRow(index: number) {
    const row = editSizeRows.value[index]
    if (!row) return
    if (rowQty(row) > 0) {
      ElMessage.warning('该颜色还有库存数量，不能删除颜色行')
      return
    }
    editSizeRows.value.splice(index, 1)
  }

  function removeDetailSizeColumn(index: number) {
    const hasQty = editSizeRows.value.some((row) => Math.max(0, Math.trunc(Number(row.quantities[index]) || 0)) > 0)
    if (hasQty) {
      ElMessage.warning('该尺码还有库存数量，不能删除尺码列')
      return
    }
    editSizeHeaders.value.splice(index, 1)
    editSizeRows.value.forEach((row) => row.quantities.splice(index, 1))
  }

  function setDetailRowMetaField(rowKey: string, field: FinishedCreateRowMetaField, value: string | number | null) {
    const row = editSizeRows.value.find((item) => item._key === rowKey)
    if (!row) return
    if (field === 'department') row.department = String(value ?? '')
    else if (field === 'inventoryTypeId') row.inventoryTypeId = value == null ? null : Number(value)
    else if (field === 'warehouseId') row.warehouseId = value == null ? null : Number(value)
    else row.location = String(value ?? '')
    row._overrides[field] = true
  }

  function setDetailRowUnitPrice(rowKey: string, value: string) {
    const row = editSizeRows.value.find((item) => item._key === rowKey)
    if (!row) return
    row.unitPrice = String(value ?? '')
    row._priceOverride = true
  }

  function buildColorMeta(): FinishedDetailColorMeta[] {
    return editSizeRows.value
      .filter((row) => row.stockId != null && row.colorName.trim())
      .map((row) => ({
        stockId: row.stockId as number,
        colorName: row.colorName.trim(),
        department: row.department,
        inventoryTypeId: row.inventoryTypeId,
        warehouseId: row.warehouseId,
        location: row.location,
        unitPrice: row.unitPrice,
        quantities: row.quantities.map((q) => Math.max(0, Math.trunc(Number(q) || 0))),
      }))
  }

  function buildColorMetaHeaders(): string[] {
    return [...editSizeHeaders.value]
  }

  return {
    editSizeHeaders,
    editSizeRows,
    resetEditMatrix,
    syncRowsFromBasicInfo,
    addDetailColorRow,
    addDetailSizeColumn,
    removeDetailColorRow,
    removeDetailSizeColumn,
    setDetailRowMetaField,
    setDetailRowUnitPrice,
    buildColorMeta,
    buildColorMetaHeaders,
  }
}

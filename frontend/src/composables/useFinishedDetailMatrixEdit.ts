import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FinishedCreateRowMetaField } from '@/composables/useFinishedCreateForm'

export type FinishedDetailMatrixRow = {
  _key: string
  colorName: string
  imageUrl: string
  quantities: number[]
  department: string
  inventoryTypeId: number | null
  warehouseId: number | null
  location: string
  _overrides: Partial<Record<FinishedCreateRowMetaField, boolean>>
}

type DetailSourceRow = { colorName: string; quantities: number[] }
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
      _key: `${row.colorName || 'color'}-${index}`,
      colorName: row.colorName,
      imageUrl: colorImageMap[row.colorName] || '',
      quantities: [...row.quantities],
      ...meta,
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
      colorName: '新颜色',
      imageUrl: '',
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

  function setDetailRowMetaField(field: FinishedCreateRowMetaField, value: string | number | null) {
    editSizeRows.value.forEach((row) => {
      if (field === 'department') row.department = String(value ?? '')
      else if (field === 'inventoryTypeId') row.inventoryTypeId = value == null ? null : Number(value)
      else if (field === 'warehouseId') row.warehouseId = value == null ? null : Number(value)
      else row.location = String(value ?? '')
      row._overrides[field] = false
    })
  }

  function buildEditColorSize() {
    return {
      headers: [...editSizeHeaders.value],
      rows: editSizeRows.value.map((row) => ({
        colorName: row.colorName,
        imageUrl: row.imageUrl,
        quantities: row.quantities.map((value) => Math.max(0, Math.trunc(Number(value) || 0))),
      })),
    }
  }

  function buildEditColorImages() {
    return editSizeRows.value
      .map((row) => ({ colorName: row.colorName.trim(), imageUrl: row.imageUrl.trim() }))
      .filter((row) => row.colorName)
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
    buildEditColorSize,
    buildEditColorImages,
  }
}

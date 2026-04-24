import { nextTick, ref } from 'vue'
import { getDictItems } from '@/api/dicts'
import request, { getErrorMessage, isErrorHandled } from '@/api/request'

type InputComponentInstance = HTMLElement | { focus?: () => void } | null

export interface MaterialRow {
  materialSourceId?: number | null
  materialSource?: string
  materialTypeId?: number | null
  materialType?: string
  supplierName?: string
  materialName?: string
  color?: string
  fabricWidth?: string
  usagePerPiece?: number | null
  lossPercent?: number | null
  orderPieces?: number | null
  purchaseQuantity?: number | null
  cuttingQuantity?: number | null
  remark?: string
}

export function useOrderMaterials() {
  const materials = ref<MaterialRow[]>([])
  const materialSourceOptions = ref<{ id: number; label: string }[]>([])
  const materialTypeOptions = ref<{ id: number; label: string }[]>([])
  const materialCellRefs = ref<InputComponentInstance[][]>([])
  const supplierOptions = ref<{ id: number; name: string }[]>([])
  const supplierLoading = ref(false)

  function setMaterialCellRef(el: unknown, rowIndex: number, colIndex: number) {
    if (!materialCellRefs.value[rowIndex]) materialCellRefs.value[rowIndex] = []
    let target: InputComponentInstance = null
    if (el && typeof el === 'object') {
      const anyEl = el as any
      if (anyEl.$el) {
        target = (anyEl.$el.querySelector('input') as HTMLElement | null) ?? (anyEl.$el as HTMLElement)
      } else {
        target = anyEl as InputComponentInstance
      }
    }
    materialCellRefs.value[rowIndex][colIndex] = target
  }

  function focusMaterialCell(rowIndex: number, colIndex: number) {
    if (rowIndex < 0 || colIndex < 0) return
    const row = materialCellRefs.value[rowIndex]
    const cell = row?.[colIndex]
    if (cell && typeof cell.focus === 'function') {
      nextTick(() => {
        cell.focus && cell.focus()
      })
    }
  }

  function onMaterialCellKeydown(e: KeyboardEvent, rowIndex: number, colIndex: number) {
    const rowsCount = materials.value.length
    const colsCount = 10
    let targetRow = rowIndex
    let targetCol = colIndex

    if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
      targetCol = colIndex + 1
      if (targetCol >= colsCount) {
        targetCol = 0
        targetRow = rowIndex + 1
      }
    } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
      targetCol = colIndex - 1
      if (targetCol < 0) {
        targetCol = colsCount - 1
        targetRow = rowIndex - 1
      }
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      targetRow = rowIndex + 1
    } else if (e.key === 'ArrowUp') {
      targetRow = rowIndex - 1
    } else {
      return
    }

    e.preventDefault()

    if (targetRow < 0 || targetRow >= rowsCount || targetCol < 0 || targetCol >= colsCount) {
      return
    }

    focusMaterialCell(targetRow, targetCol)
  }

  function addMaterialRow() {
    materials.value.push({})
  }

  function removeMaterialRow(index: number) {
    materials.value.splice(index, 1)
  }

  async function loadMaterialTypes() {
    try {
      const res = await getDictItems('material_types')
      const list = res.data ?? []
      materialTypeOptions.value = list.map((item: any) => ({
        id: item.id,
        label: item.value,
      }))
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('物料类型加载失败', getErrorMessage(e))
    }
  }

  async function loadMaterialSources() {
    try {
      const res = await getDictItems('material_sources')
      const list = res.data ?? []
      materialSourceOptions.value = list.map((item: any) => ({
        id: item.id,
        label: item.value,
      }))
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('物料来源加载失败', getErrorMessage(e))
    }
  }

  function syncMaterialTypeIdsFromLabel() {
    if (!materialTypeOptions.value.length || !materials.value.length) return
    const map = new Map<string, number>()
    materialTypeOptions.value.forEach((opt) => {
      if (opt.label) map.set(String(opt.label), opt.id)
    })
    materials.value.forEach((row) => {
      if ((row.materialTypeId == null || Number.isNaN(row.materialTypeId as any)) && row.materialType) {
        const id = map.get(String(row.materialType))
        if (id) {
          row.materialTypeId = id
        }
      }
    })
  }

  function syncMaterialSourceIdsFromLabel() {
    if (!materialSourceOptions.value.length || !materials.value.length) return
    const map = new Map<string, number>()
    materialSourceOptions.value.forEach((opt) => {
      if (opt.label) map.set(String(opt.label), opt.id)
    })
    materials.value.forEach((row) => {
      if ((row.materialSourceId == null || Number.isNaN(row.materialSourceId as any)) && row.materialSource) {
        const id = map.get(String(row.materialSource))
        if (id) row.materialSourceId = id
      }
    })
  }

  function roundMaterialQty2(n: number): number {
    if (!Number.isFinite(n)) return 0
    return Number.parseFloat(n.toFixed(2))
  }

  function recalcPurchaseQuantity(row: MaterialRow) {
    const usageRaw = Number(row.usagePerPiece) || 0
    const usage = roundMaterialQty2(usageRaw)
    if (row.usagePerPiece != null) {
      row.usagePerPiece = usage
    }
    const lossPercent = Number(row.lossPercent) || 0
    const pieces = Number(row.orderPieces) || 0
    const lossRate = lossPercent / 100
    const result = usage * pieces * (1 + lossRate)
    row.purchaseQuantity = Number.isFinite(result) ? roundMaterialQty2(result) : 0
  }

  function onSupplierChange(_row: MaterialRow) {
    // Reserved for supplier quick-create behavior.
  }

  async function searchSuppliers(keyword: string) {
    supplierLoading.value = true
    try {
      const res = await request.get('/suppliers', {
        params: { keyword: keyword || undefined, pageSize: 20 },
        skipGlobalErrorHandler: true,
      })
      const data = res.data as { list?: { id: number; name: string }[] }
      supplierOptions.value = data.list ?? []
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('供应商下拉加载失败', getErrorMessage(e))
    } finally {
      supplierLoading.value = false
    }
  }

  async function searchProcessSuppliers(keyword: string) {
    return searchSuppliersByType('工艺供应商', keyword)
  }

  function getMaterialTypeLabel(row: MaterialRow): string {
    if (row.materialTypeId != null) {
      const opt = materialTypeOptions.value.find((x) => x.id === row.materialTypeId)
      if (opt?.label) return String(opt.label)
    }
    return String(row.materialType ?? '')
  }

  function getSupplierTypeForMaterialType(materialTypeLabel: string): string {
    const label = materialTypeLabel.trim()
    if (label === '主布' || label === '里布' || label === '衬布') return '面料供应商'
    if (label === '辅料') return '辅料供应商'
    if (label === '成品') return '成品供应商'
    return ''
  }

  async function searchSuppliersByType(typeValue: string, keyword: string) {
    supplierLoading.value = true
    try {
      const res = await request.get('/suppliers/items', {
        params: {
          type: typeValue || undefined,
          name: keyword || undefined,
          page: 1,
          pageSize: 20,
        },
        skipGlobalErrorHandler: true,
      })
      const data = res.data as { list?: { id: number; name: string }[] }
      supplierOptions.value = data.list ?? []
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('供应商下拉加载失败', getErrorMessage(e))
    } finally {
      supplierLoading.value = false
    }
  }

  function onMaterialTypeChange(row: MaterialRow) {
    row.supplierName = ''
  }

  function onMaterialSupplierVisibleChange(visible: boolean, row: MaterialRow) {
    if (!visible) return
    const typeValue = getSupplierTypeForMaterialType(getMaterialTypeLabel(row))
    void searchSuppliersByType(typeValue, '')
  }

  function searchMaterialSuppliers(keyword: string, row: MaterialRow) {
    const typeValue = getSupplierTypeForMaterialType(getMaterialTypeLabel(row))
    return searchSuppliersByType(typeValue, keyword)
  }

  return {
    materials,
    materialSourceOptions,
    materialTypeOptions,
    materialCellRefs,
    supplierOptions,
    supplierLoading,
    setMaterialCellRef,
    focusMaterialCell,
    onMaterialCellKeydown,
    addMaterialRow,
    removeMaterialRow,
    loadMaterialTypes,
    loadMaterialSources,
    syncMaterialTypeIdsFromLabel,
    syncMaterialSourceIdsFromLabel,
    roundMaterialQty2,
    recalcPurchaseQuantity,
    onSupplierChange,
    searchSuppliers,
    searchProcessSuppliers,
    getMaterialTypeLabel,
    getSupplierTypeForMaterialType,
    searchSuppliersByType,
    onMaterialTypeChange,
    onMaterialSupplierVisibleChange,
    searchMaterialSuppliers,
  }
}

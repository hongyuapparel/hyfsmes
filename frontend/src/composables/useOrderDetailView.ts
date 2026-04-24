import { computed, type Ref } from 'vue'
import type { OrderDetail } from '@/api/orders'
import { formatDisplayNumber } from '@/utils/display-number'

interface DynamicColumn {
  key: string
  label: string
  minWidth: number
  showOverflowTooltip?: boolean
}

function normalizeNumber(n: unknown): number {
  const num = Number(n)
  return Number.isFinite(num) ? num : 0
}

function toLeafOptionLabel(value: string | null | undefined): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const parts = raw
    .split('>')
    .map((item) => item.trim())
    .filter(Boolean)
  return parts.length ? parts[parts.length - 1] : raw
}

function toPrintLabelByKey(key: string): string {
  const labelMap: Record<string, string> = {
    materialTypeLabel: '类型',
    supplierName: '供应商',
    materialName: '名称',
    color: '颜色',
    fabricWidth: '门幅',
    usagePerPiece: '单件用量',
    lossPercent: '损耗%',
    orderPieces: '订单件数',
    purchaseQuantity: '采购总量',
    cuttingQuantity: '裁床用量',
    remark: '备注',
    processName: '工艺项目',
    part: '部位',
  }
  return labelMap[key] || key
}

function buildDynamicColumns(
  rows: Record<string, unknown>[],
  preferredOrder: string[],
  defaultMinWidth = 100,
): DynamicColumn[] {
  const allKeys = new Set<string>()
  rows.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      if (value !== '' && value != null) allKeys.add(key)
    })
  })
  const orderedKeys = [
    ...preferredOrder.filter((key) => allKeys.has(key)),
    ...[...allKeys].filter((key) => !preferredOrder.includes(key)),
  ]
  return orderedKeys.map((key) => ({
    key,
    label: toPrintLabelByKey(key),
    minWidth: key === 'remark' ? 160 : defaultMinWidth,
    showOverflowTooltip: key === 'remark',
  }))
}

const DETAIL_MATERIAL_NUMERIC_KEYS = new Set([
  'usagePerPiece',
  'lossPercent',
  'orderPieces',
  'purchaseQuantity',
  'cuttingQuantity',
])

const DETAIL_PROCESS_TEXT_KEYS = new Set(['processName', 'supplierName', 'part', 'remark'])

function formatDetailMaterialCell(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (value === null || value === undefined || value === '') return ''
  if (DETAIL_MATERIAL_NUMERIC_KEYS.has(key)) return formatDisplayNumber(value)
  return String(value)
}

function formatDetailProcessCell(row: Record<string, unknown>, key: string): string {
  const value = row[key]
  if (value === null || value === undefined || value === '') return ''
  if (DETAIL_PROCESS_TEXT_KEYS.has(key)) return String(value)
  return formatDisplayNumber(value)
}

interface UseOrderDetailViewOptions {
  detail: Ref<OrderDetail | null>
  findOrderTypeLabelById: (id: number | null | undefined) => string
  findCollaborationLabelById: (id: number | null | undefined) => string
  findMaterialTypeLabelById: (id: number | null | undefined) => string
}

export function useOrderDetailView({
  detail,
  findOrderTypeLabelById,
  findCollaborationLabelById,
  findMaterialTypeLabelById,
}: UseOrderDetailViewOptions) {
  const statusLabelMap: Record<string, string> = {
    draft: '草稿',
    pending_review: '待审单',
    pending_purchase: '待采购',
    pending_pattern: '待纸样',
    pending_cutting: '待裁床',
    pending_sewing: '待车缝',
    pending_finishing: '待尾部',
    completed: '订单完成',
  }

  const statusLabel = computed(() => {
    if (!detail.value?.status) return ''
    return statusLabelMap[detail.value.status] ?? detail.value.status
  })

  const orderTypeDisplay = computed(() => {
    const id = (detail.value as any)?.orderTypeId as number | null | undefined
    if (id) {
      const label = findOrderTypeLabelById(id)
      if (label) return label
    }
    const legacy = (detail.value as any)?.orderType ?? detail.value?.label
    return legacy ? String(legacy).trim() : ''
  })

  const collaborationDisplay = computed(() => {
    const id = (detail.value as any)?.collaborationTypeId as number | null | undefined
    if (id) {
      const label = findCollaborationLabelById(id)
      if (label) return label
    }
    const legacy = (detail.value as any)?.collaborationType
    return legacy ? String(legacy).trim() : ''
  })

  const headerMetaValues = computed(() => {
    return [
      toLeafOptionLabel((detail.value as any)?.productGroupName),
      String((detail.value as any)?.applicablePeopleName ?? '').trim(),
    ].filter(Boolean)
  })

  const colorSizeHeadersForView = computed(() => {
    const headers = (detail.value?.colorSizeHeaders ?? []).filter((item) => String(item || '').trim())
    return headers.length ? headers : []
  })

  const colorSizeRowsForView = computed(() => {
    const rows = (detail.value?.colorSizeRows ?? []).map((row) => {
      const quantities = Array.isArray(row.quantities) ? row.quantities : []
      const total = quantities.reduce((sum, n) => sum + normalizeNumber(n), 0)
      return {
        colorName: row.colorName?.trim?.() ?? '',
        quantities,
        remark: row.remark?.trim?.() ?? '',
        total,
      }
    })
    return rows.filter((row) => row.colorName || row.total || row.remark)
  })

  const hasColorSize = computed(() => {
    return colorSizeHeadersForView.value.length > 0 && colorSizeRowsForView.value.length > 0
  })

  const hasColorRemark = computed(() => {
    return colorSizeRowsForView.value.some((row) => !!row.remark)
  })

  const materialsForView = computed(() => {
    const list = (detail.value?.materials ?? []).map((material: any) => {
      const materialTypeId = material.materialTypeId as number | null | undefined
      const labelFromId = materialTypeId ? findMaterialTypeLabelById(materialTypeId) : ''
      const fallback = material.materialType ?? ''
      return {
        materialTypeLabel: labelFromId || fallback || '',
        supplierName: material.supplierName ?? '',
        materialName: material.materialName ?? '',
        color: material.color ?? '',
        fabricWidth: material.fabricWidth ?? '',
        usagePerPiece: material.usagePerPiece ?? '',
        lossPercent: material.lossPercent ?? '',
        orderPieces: material.orderPieces ?? '',
        purchaseQuantity: material.purchaseQuantity ?? '',
        cuttingQuantity: material.cuttingQuantity ?? '',
        remark: material.remark ?? '',
      }
    })
    return list.filter((item) => Object.values(item).some((value) => value !== '' && value != null))
  })

  const hasMaterials = computed(() => materialsForView.value.length > 0)

  const materialColumns = computed(() => {
    return buildDynamicColumns(
      materialsForView.value as Record<string, unknown>[],
      [
        'materialTypeLabel',
        'supplierName',
        'materialName',
        'color',
        'fabricWidth',
        'usagePerPiece',
        'lossPercent',
        'orderPieces',
        'purchaseQuantity',
        'cuttingQuantity',
        'remark',
      ],
      80,
    )
  })

  const sizeMetaHeadersForView = computed(() => {
    const headers = (detail.value?.sizeInfoMetaHeaders ?? []).filter((item) => String(item || '').trim())
    return headers.length ? headers : []
  })

  const sizeHeadersForView = computed(() => {
    const headers = (detail.value?.colorSizeHeaders ?? []).filter((item) => String(item || '').trim())
    return headers.length ? headers : []
  })

  const sizeMetaColWidth = computed(() => {
    const sizeCount = sizeHeadersForView.value.length
    if (sizeCount >= 8) return 56
    if (sizeCount >= 6) return 62
    return 72
  })

  const sizeValueColWidth = computed(() => {
    const sizeCount = sizeHeadersForView.value.length
    if (sizeCount >= 8) return 34
    if (sizeCount >= 6) return 40
    return 52
  })

  const sizeInfoRowsForView = computed(() => {
    const metaLength = sizeMetaHeadersForView.value.length
    const sizeLength = sizeHeadersForView.value.length
    if (!metaLength && !sizeLength) return []
    const rows = (detail.value?.sizeInfoRows ?? []).map((row) => ({
      metaValues: Array.isArray(row.metaValues) ? row.metaValues : [],
      sizeValues: Array.isArray(row.sizeValues) ? row.sizeValues : [],
    }))
    return rows.filter((row) => {
      const hasMeta = row.metaValues.slice(0, metaLength).some((value) => String(value || '').trim())
      const hasSize = row.sizeValues.slice(0, sizeLength).some((value) => String(value || '').trim())
      return hasMeta || hasSize
    })
  })

  const hasSizeInfo = computed(() => sizeInfoRowsForView.value.length > 0)

  const processItemsForView = computed(() => {
    const list = (detail.value?.processItems ?? []).map((processItem: any) => {
      const extras = Object.entries(processItem ?? {}).reduce((acc, [key, value]) => {
        if (['processName', 'supplierName', 'part', 'remark'].includes(key)) return acc
        if (key === 'id' || key.endsWith('Id') || key === 'createdAt' || key === 'updatedAt') return acc
        ;(acc as any)[key] = value
        return acc
      }, {} as Record<string, unknown>)
      return {
        processName: processItem.processName ?? '',
        supplierName: processItem.supplierName ?? '',
        part: processItem.part ?? '',
        remark: processItem.remark ?? '',
        ...extras,
      }
    })
    return list.filter((item) => Object.values(item).some((value) => String(value || '').trim()))
  })

  const hasProcessItems = computed(() => processItemsForView.value.length > 0)

  const processColumns = computed(() => {
    return buildDynamicColumns(
      processItemsForView.value as Record<string, unknown>[],
      ['processName', 'supplierName', 'part', 'remark'],
      100,
    ).map((col) => ({
      ...col,
      showOverflowTooltip: false,
    }))
  })

  const packagingCellsForView = computed(() => {
    const headers = detail.value?.packagingHeaders ?? []
    const cells = detail.value?.packagingCells ?? []
    return headers
      .map((header, index) => {
        const cell = cells[index] ?? ({} as any)
        return {
          header,
          imageUrl: cell.imageUrl ?? '',
          accessoryName: cell.accessoryName ?? '',
          description: cell.description ?? '',
        }
      })
      .filter((item) => {
        const header = String(item.header || '').trim()
        const hasText = header || item.accessoryName || item.description
        const hasImage = !!item.imageUrl
        return hasText || hasImage
      })
  })

  const hasPackaging = computed(() => {
    return packagingCellsForView.value.length > 0 || !!detail.value?.packagingMethod
  })

  const attachmentsForView = computed(() => {
    return (detail.value?.attachments ?? []) as string[]
  })

  const hasAttachments = computed(() => attachmentsForView.value.length > 0)

  return {
    statusLabel,
    orderTypeDisplay,
    collaborationDisplay,
    headerMetaValues,
    colorSizeHeadersForView,
    colorSizeRowsForView,
    hasColorSize,
    hasColorRemark,
    materialsForView,
    hasMaterials,
    materialColumns,
    sizeMetaHeadersForView,
    sizeHeadersForView,
    sizeMetaColWidth,
    sizeValueColWidth,
    sizeInfoRowsForView,
    hasSizeInfo,
    processItemsForView,
    hasProcessItems,
    processColumns,
    packagingCellsForView,
    hasPackaging,
    attachmentsForView,
    hasAttachments,
    formatDetailMaterialCell,
    formatDetailProcessCell,
  }
}

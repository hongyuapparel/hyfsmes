type InventoryOperationLogLike = {
  action?: string
  beforeSnapshot?: Record<string, unknown> | null
  afterSnapshot?: Record<string, unknown> | null
  remark?: string
}

export type InventoryOperationLogSummaryOptions = {
  valueLabels?: Partial<Record<'supplierId' | 'warehouseId' | 'inventoryTypeId', Record<string, string>>>
}

function asSnapshot(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function toFiniteNumber(value: unknown): number | null {
  if (value == null || (typeof value === 'string' && !value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

function withUnit(value: number, unit: string): string {
  return `${formatNumber(value)}${unit}`
}

function buildSizeDeltaSummary(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  unit: string,
): string {
  const beforeHeaders = Array.isArray(before?.sizeHeaders) ? before.sizeHeaders.map((item) => String(item ?? '').trim()) : []
  const afterHeaders = Array.isArray(after?.sizeHeaders) ? after.sizeHeaders.map((item) => String(item ?? '').trim()) : []
  const headers = [...beforeHeaders, ...afterHeaders].filter((header, index, list) => header && list.indexOf(header) === index)
  if (!headers.length) return ''

  const beforeQuantities = Array.isArray(before?.sizeQuantities) ? before.sizeQuantities : []
  const afterQuantities = Array.isArray(after?.sizeQuantities) ? after.sizeQuantities : []
  if (
    (beforeHeaders.length > 0 && beforeQuantities.length < beforeHeaders.length)
    || (afterHeaders.length > 0 && afterQuantities.length < afterHeaders.length)
  ) return '分码明细未完整留存'
  const beforeValues = beforeHeaders.map((_, index) => toFiniteNumber(beforeQuantities[index]))
  const afterValues = afterHeaders.map((_, index) => toFiniteNumber(afterQuantities[index]))
  if (beforeValues.some((value) => value == null) || afterValues.some((value) => value == null)) {
    return '分码明细未完整留存'
  }
  const beforeByHeader = new Map(beforeHeaders.map((header, index) => [header, beforeValues[index] as number]))
  const afterByHeader = new Map(afterHeaders.map((header, index) => [header, afterValues[index] as number]))
  const changes = headers
    .map((header) => ({ header, delta: (afterByHeader.get(header) ?? 0) - (beforeByHeader.get(header) ?? 0) }))
    .filter((item) => item.delta !== 0)
    .map((item) => `${item.header} ${item.delta > 0 ? '+' : ''}${withUnit(item.delta, unit)}`)

  return changes.length ? `分码：${changes.join('、')}` : ''
}

function actionLabel(action: string): string {
  if (action === 'create') return '新增入库'
  if (action === 'inbound') return '入库'
  if (action === 'outbound') return '出库'
  if (action === 'update') return '编辑'
  if (action === 'delete') return '删除'
  return action || '操作'
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function displayText(value: unknown): string {
  return normalizeText(value) || '-'
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(Array.isArray(left) ? left : []) === JSON.stringify(Array.isArray(right) ? right : [])
  }
  return normalizeText(left) === normalizeText(right)
}

function displayOptionValue(
  field: 'supplierId' | 'warehouseId' | 'inventoryTypeId',
  value: unknown,
  options: InventoryOperationLogSummaryOptions,
): string {
  if (value == null || normalizeText(value) === '') return '-'
  const key = normalizeText(value)
  return options.valueLabels?.[field]?.[key] || `#${key}`
}

function buildEditChangeSummaries(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  unit: string,
  options: InventoryOperationLogSummaryOptions,
): string[] {
  const changes: string[] = []
  const addTextChange = (field: string, label: string) => {
    if (!valuesEqual(before[field], after[field])) {
      changes.push(`${label}「${displayText(before[field])}」→「${displayText(after[field])}」`)
    }
  }
  const addOptionChange = (field: 'supplierId' | 'warehouseId' | 'inventoryTypeId', label: string) => {
    if (!valuesEqual(before[field], after[field])) {
      changes.push(`${label}「${displayOptionValue(field, before[field], options)}」→「${displayOptionValue(field, after[field], options)}」`)
    }
  }

  addTextChange('name', '名称')
  addTextChange('category', '类别')
  addTextChange('customerName', '客户')
  addTextChange('salesperson', '业务员')
  addTextChange('unit', '单位')
  addOptionChange('supplierId', '供应商')
  addOptionChange('warehouseId', '仓库')
  addOptionChange('inventoryTypeId', '库存类型')
  addTextChange('location', '存放地址')
  addTextChange('storageLocation', '存放地址')
  addTextChange('remark', '备注')

  if (!!before.isSized !== !!after.isSized) {
    changes.push(`分码「${before.isSized ? '开启' : '关闭'}」→「${after.isSized ? '开启' : '关闭'}」`)
  }
  const sizeSummary = buildSizeDeltaSummary(before, after, unit)
  if (sizeSummary) changes.push(sizeSummary)

  const getImages = (snapshot: Record<string, unknown>): string[] => {
    const imageUrls = Array.isArray(snapshot.imageUrls)
      ? snapshot.imageUrls.map(normalizeText).filter(Boolean)
      : []
    const mainImageUrl = normalizeText(snapshot.imageUrl)
    return imageUrls.length ? imageUrls : [mainImageUrl].filter(Boolean)
  }
  const beforeImages = getImages(before)
  const afterImages = getImages(after)
  if (!valuesEqual(beforeImages, afterImages)) {
    if (!afterImages.length) changes.push('图片已删除')
    else if (!beforeImages.length) changes.push(`图片已添加（${afterImages.length}张）`)
    else changes.push(`图片已更新（${beforeImages.length}张→${afterImages.length}张）`)
  }
  return changes
}

/** 仅根据日志已保存的前后快照生成摘要；缺少事实时明确提示，不估算。 */
export function buildInventoryOperationLogSummary(
  log: InventoryOperationLogLike,
  options: InventoryOperationLogSummaryOptions = {},
): string {
  const action = String(log.action ?? '').trim()
  const before = asSnapshot(log.beforeSnapshot)
  const after = asSnapshot(log.afterSnapshot)
  const unit = String(after?.unit ?? before?.unit ?? '').trim()
  const beforeQuantity = before ? toFiniteNumber(before.quantity) : null
  const afterQuantity = after ? toFiniteNumber(after.quantity) : null
  const label = actionLabel(action)
  const parts: string[] = []

  if (action === 'create' || action === 'inbound' || action === 'outbound') {
    if (beforeQuantity == null || afterQuantity == null) {
      parts.push(`${label}（历史记录未保存数量明细）`)
    } else {
      const delta = afterQuantity - beforeQuantity
      const directionMatches = action === 'outbound' ? delta < 0 : delta > 0
      if (directionMatches) {
        const movedQuantity = action === 'outbound' ? -delta : delta
        parts.push(`${label} ${withUnit(movedQuantity, unit)}，库存 ${withUnit(beforeQuantity, unit)} → ${withUnit(afterQuantity, unit)}`)
      } else {
        parts.push(`${label}记录异常，库存实际 ${withUnit(beforeQuantity, unit)} → ${withUnit(afterQuantity, unit)}`)
      }
      const sizeSummary = buildSizeDeltaSummary(before, after, unit)
      if (sizeSummary) parts.push(sizeSummary)
    }
  } else if (action === 'update' && before && after) {
    if (beforeQuantity != null && afterQuantity != null && beforeQuantity !== afterQuantity) {
      parts.push(`库存 ${withUnit(beforeQuantity, normalizeText(before.unit))} → ${withUnit(afterQuantity, normalizeText(after.unit))}`)
    }
    parts.push(...buildEditChangeSummaries(before, after, unit, options))
    if (!parts.length) parts.push('未修改任何字段')
    parts.unshift(label)
  } else if (action === 'delete' && before) {
    const deletedName = displayText(before.name)
    const deletedQuantity = beforeQuantity == null ? '' : `，删除前库存 ${withUnit(beforeQuantity, unit)}`
    parts.push(`${label}「${deletedName}」${deletedQuantity}`)
  } else if (beforeQuantity != null && afterQuantity != null && beforeQuantity !== afterQuantity) {
    parts.push(`${label}，库存 ${withUnit(beforeQuantity, unit)} → ${withUnit(afterQuantity, unit)}`)
  } else {
    parts.push(label)
  }

  const remarkParts = String(log.remark ?? '').split('；').map((item) => item.trim()).filter(Boolean)
  const pickupPart = remarkParts.find((item) => item.startsWith('领取人：'))
  if (pickupPart) parts.push(pickupPart)
  const detailRemark = remarkParts.filter((item) => item !== pickupPart).join('；').replace(/^备注：/, '').trim()
  if (detailRemark) parts.push(`备注：${detailRemark}`)
  return parts.join('；')
}

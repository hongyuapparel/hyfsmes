import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getDictItems } from '@/api/dicts'
import { getOrderCost, getOrderDetail, type OrderDetail } from '@/api/orders'
import { getProductionProcesses, type ProductionProcessItem } from '@/api/production-processes'
import {
  DEFAULT_PRODUCTION_PROCESS_QTY,
  DEFAULT_PRODUCTION_MULTIPLIER,
  DEFAULT_PROFIT_MARGIN,
  ensureBaseCostRows,
  mergeMaterialRowsFromOrder,
  mergeProcessItemRowsFromOrder,
  normalizeProductionCostMultiplier,
  normalizeProfitMargin,
  type MaterialRow,
  type ProcessItemRow,
  type ProductionRow,
} from '@/utils/order-cost'

interface CostSnapshotPayload {
  materialRows?: unknown
  processItemRows?: unknown
  productionRows?: unknown
  productionCostMultiplier?: unknown
  profitMargin?: unknown
  quoteConfirmedAt?: unknown
  quoteConfirmedBy?: unknown
  quoteNeedsReconfirm?: unknown
  quoteDraftUpdatedAt?: unknown
}

export interface OrderCostLoaderRefs {
  order: ReturnType<typeof ref<OrderDetail | null>>
  materialRows: ReturnType<typeof ref<MaterialRow[]>>
  processItemRows: ReturnType<typeof ref<ProcessItemRow[]>>
  productionRows: ReturnType<typeof ref<ProductionRow[]>>
  productionProcesses: ReturnType<typeof ref<ProductionProcessItem[]>>
  materialTypeOptions: ReturnType<typeof ref<Array<{ id: number; label: string }>>>
  productionCostMultiplier: ReturnType<typeof ref<number>>
  profitMargin: ReturnType<typeof ref<number>>
  quoteConfirmedAt: ReturnType<typeof ref<string>>
  quoteConfirmedBy: ReturnType<typeof ref<string>>
  quoteNeedsReconfirm: ReturnType<typeof ref<boolean>>
}

export function useOrderCostLoader(orderId: number): OrderCostLoaderRefs & {
  loadOrder: () => Promise<void>
  loadCostSnapshot: () => Promise<boolean>
  loadMaterialTypes: () => Promise<void>
  loadProcesses: () => Promise<void>
  reconcileCostRowsFromOrder: (detail: OrderDetail) => void
  ensureCostRowsBase: () => void
  syncMaterialTypeIdsFromLabel: () => void
  syncProductionIdsFromName: () => void
} {
  const order = ref<OrderDetail | null>(null)
  const materialRows = ref<MaterialRow[]>([])
  const processItemRows = ref<ProcessItemRow[]>([])
  const productionRows = ref<ProductionRow[]>([])
  const productionProcesses = ref<ProductionProcessItem[]>([])
  const materialTypeOptions = ref<Array<{ id: number; label: string }>>([])
  const productionCostMultiplier = ref(DEFAULT_PRODUCTION_MULTIPLIER)
  const profitMargin = ref(DEFAULT_PROFIT_MARGIN)
  const quoteConfirmedAt = ref('')
  const quoteConfirmedBy = ref('')
  const quoteNeedsReconfirm = ref(false)

  async function loadMaterialTypes() {
    try {
      const res = await getDictItems('material_types')
      materialTypeOptions.value = (res.data ?? []).map((item) => ({ id: item.id, label: item.value }))
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('物料类型加载失败', getErrorMessage(e))
    }
  }

  function syncMaterialTypeIdsFromLabel() {
    if (!materialTypeOptions.value.length || !materialRows.value.length) return
    const map = new Map<string, number>()
    materialTypeOptions.value.forEach((item) => item.label && map.set(String(item.label), item.id))
    materialRows.value.forEach((row) => {
      if ((row.materialTypeId == null || Number.isNaN(Number(row.materialTypeId))) && row.materialType) {
        const id = map.get(String(row.materialType))
        if (id) row.materialTypeId = id
      }
    })
  }

  function ensureCostRowsBase() {
    const base = ensureBaseCostRows(materialRows.value, processItemRows.value)
    materialRows.value = base.materialRows
    processItemRows.value = base.processItemRows
  }

  function reconcileCostRowsFromOrder(detail: OrderDetail) {
    const orderMaterials = Array.isArray(detail.materials) ? detail.materials : []
    const orderProcessItems = Array.isArray(detail.processItems) ? detail.processItems : []
    if (orderMaterials.length) {
      materialRows.value = mergeMaterialRowsFromOrder(orderMaterials, materialRows.value)
    }
    if (orderProcessItems.length) {
      processItemRows.value = mergeProcessItemRowsFromOrder(orderProcessItems, processItemRows.value)
    }
    ensureCostRowsBase()
  }

  async function loadOrder() {
    if (!orderId) return
    try {
      const res = await getOrderDetail(orderId)
      order.value = res.data
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载订单失败'))
    }
  }

  async function loadCostSnapshot(): Promise<boolean> {
    if (!orderId) return false
    try {
      const res = await getOrderCost(orderId)
      const snapshot = res.data?.snapshot
      const hasSnapshot = !!snapshot && typeof snapshot === 'object'
      const s = (hasSnapshot ? snapshot : {}) as CostSnapshotPayload
      const snapshotMaterialRows = Array.isArray(s.materialRows) ? (s.materialRows as MaterialRow[]) : []
      const snapshotProcessItemRows = Array.isArray(s.processItemRows) ? (s.processItemRows as ProcessItemRow[]) : []
      const snapshotProductionRows = Array.isArray(s.productionRows) ? (s.productionRows as ProductionRow[]) : []
      if (snapshotMaterialRows.length) {
        materialRows.value = snapshotMaterialRows.map((item) => ({ ...item, includeInCost: item.includeInCost !== false }))
      }
      if (snapshotProcessItemRows.length) processItemRows.value = snapshotProcessItemRows
      if (snapshotProductionRows.length) {
        productionRows.value = snapshotProductionRows.map((item) => {
          const n = Number(item.quantity)
          return { ...item, quantity: Number.isFinite(n) && n >= 0 ? n : DEFAULT_PRODUCTION_PROCESS_QTY }
        })
      }
      if (s.productionCostMultiplier !== undefined) productionCostMultiplier.value = normalizeProductionCostMultiplier(s.productionCostMultiplier)
      if (s.profitMargin !== undefined) profitMargin.value = normalizeProfitMargin(s.profitMargin)
      quoteConfirmedAt.value = typeof s.quoteConfirmedAt === 'string' ? s.quoteConfirmedAt : ''
      quoteConfirmedBy.value = typeof s.quoteConfirmedBy === 'string' ? s.quoteConfirmedBy : ''
      quoteNeedsReconfirm.value = Boolean(s.quoteNeedsReconfirm)
      const draftUpdatedAt = typeof s.quoteDraftUpdatedAt === 'string' ? s.quoteDraftUpdatedAt : ''
      const isUserSavedSnapshot = hasSnapshot && (!!draftUpdatedAt || !!quoteConfirmedAt.value)
      return isUserSavedSnapshot
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载成本快照失败'))
      return false
    }
  }

  async function loadProcesses() {
    try {
      const res = await getProductionProcesses()
      productionProcesses.value = res.data ?? []
      if (!productionRows.value.length) {
        const first = productionProcesses.value[0]
        productionRows.value = [{
          processId: first?.id ?? null,
          department: first?.department ?? '',
          jobType: first?.jobType ?? '',
          processName: first?.name ?? '',
          remark: '',
          unitPrice: first ? Number(first.unitPrice) || 0 : 0,
          quantity: DEFAULT_PRODUCTION_PROCESS_QTY,
        }]
      }
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载生产工序失败'))
    }
  }

  function syncProductionIdsFromName() {
    if (!productionProcesses.value.length || !productionRows.value.length) return
    const map = new Map<string, ProductionProcessItem>()
    productionProcesses.value.forEach((item) => item.name && map.set(item.name, item))
    productionRows.value.forEach((row) => {
      if ((row.processId == null || Number.isNaN(Number(row.processId))) && row.processName) {
        const found = map.get(row.processName)
        if (!found) return
        row.processId = found.id
        row.department = found.department || row.department
        row.jobType = found.jobType || row.jobType
        row.unitPrice = Number(found.unitPrice) || row.unitPrice
      }
    })
  }

  return {
    order,
    materialRows,
    processItemRows,
    productionRows,
    productionProcesses,
    materialTypeOptions,
    productionCostMultiplier,
    profitMargin,
    quoteConfirmedAt,
    quoteConfirmedBy,
    quoteNeedsReconfirm,
    loadOrder,
    loadCostSnapshot,
    loadMaterialTypes,
    loadProcesses,
    reconcileCostRowsFromOrder,
    ensureCostRowsBase,
    syncMaterialTypeIdsFromLabel,
    syncProductionIdsFromName,
  }
}

import { reactive, ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { registerPurchaseBatch, type PurchaseItemRow } from '@/api/production-purchase'
import { searchSuppliers as searchSupplierOptions } from '@/api/suppliers'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { formatDisplayNumber } from '@/utils/display-number'

export interface PurchaseRegisterDraftRow {
  key: string
  orderId: number
  materialIndex: number
  orderNo: string
  skuCode: string
  materialName: string
  materialType?: string | null
  color?: string | null
  supplierName: string
  planQuantity: number | null
  actualPurchaseQuantity: number
  unitPrice: string
  otherCost: string
  remark: string
  imageUrl: string
}

export interface PurchaseRegisterDialogState {
  visible: boolean
  submitting: boolean
  rows: PurchaseRegisterDraftRow[]
}

export interface PurchaseSupplierOption {
  id: number
  name: string
}

type UsePurchaseRegisterDialogOptions = {
  selectedRows: Ref<PurchaseItemRow[]>
  reload: () => Promise<void>
  reloadTabCounts: () => Promise<void>
  clearSelection: () => void
}

function normalizeText(value: string | null | undefined): string {
  const text = (value ?? '').trim()
  return text && text !== '-' ? text : ''
}

function parseMoney(value: string): number {
  const cleaned = (value ?? '').replace(/[^\d.-]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

export function calcPurchaseRegisterRowAmount(
  row: Pick<PurchaseRegisterDraftRow, 'actualPurchaseQuantity' | 'unitPrice' | 'otherCost'>,
): string {
  const qty = Number(row.actualPurchaseQuantity) || 0
  const total = qty * parseMoney(row.unitPrice) + parseMoney(row.otherCost)
  return Number.isFinite(total) ? formatDisplayNumber(total) : formatDisplayNumber(0)
}

export function isRegisterablePurchaseRow(row: PurchaseItemRow): boolean {
  return row.processRoute === 'purchase' && row.purchaseStatus !== 'completed'
}

function toRegisterDraftRow(row: PurchaseItemRow): PurchaseRegisterDraftRow {
  return {
    key: `${row.orderId}:${row.materialIndex}`,
    orderId: row.orderId,
    materialIndex: row.materialIndex,
    orderNo: row.orderNo,
    skuCode: row.skuCode,
    materialName: row.materialName,
    materialType: row.materialType,
    color: row.color,
    supplierName: normalizeText(row.supplierName),
    planQuantity: row.planQuantity,
    actualPurchaseQuantity: row.actualPurchaseQuantity ?? row.planQuantity ?? 0,
    unitPrice: row.purchaseUnitPrice ?? '',
    otherCost: row.purchaseOtherCost ?? '',
    remark: normalizeText(row.purchaseRemark),
    imageUrl: normalizeText(row.purchaseImageUrl),
  }
}

export function usePurchaseRegisterDialog(options: UsePurchaseRegisterDialogOptions) {
  const registerDialog = reactive<PurchaseRegisterDialogState>({
    visible: false,
    submitting: false,
    rows: [],
  })
  const registerSupplierOptions = ref<PurchaseSupplierOption[]>([])
  const registerSupplierLoading = ref(false)
  let supplierSearchReqId = 0

  async function searchRegisterSuppliers(keyword = '') {
    const reqId = supplierSearchReqId + 1
    supplierSearchReqId = reqId
    registerSupplierLoading.value = true
    try {
      const res = await searchSupplierOptions(keyword.trim() || undefined, 1, 20)
      if (reqId === supplierSearchReqId) {
        registerSupplierOptions.value = res.data?.list ?? []
      }
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '供应商列表加载失败'))
    } finally {
      if (reqId === supplierSearchReqId) registerSupplierLoading.value = false
    }
  }

  function onRegisterSupplierVisibleChange(visible: boolean) {
    if (!visible) return
    void searchRegisterSuppliers('')
  }

  function openRegisterDialog() {
    const rows = options.selectedRows.value.filter(isRegisterablePurchaseRow)
    if (!rows.length) {
      ElMessage.warning('请选择等待采购的物料')
      return
    }
    if (rows.length !== options.selectedRows.value.length) {
      ElMessage.warning('已自动排除非等待采购的记录')
    }
    registerDialog.rows = rows.map(toRegisterDraftRow)
    registerDialog.visible = true
  }

  function resetRegisterForm() {
    registerDialog.rows = []
  }

  async function submitRegister() {
    if (!registerDialog.rows.length) return
    const missingSupplier = registerDialog.rows.find((row) => !normalizeText(row.supplierName))
    if (missingSupplier) {
      ElMessage.warning(`请补充供应商：${missingSupplier.orderNo} / ${missingSupplier.materialName}`)
      return
    }
    const invalidQuantity = registerDialog.rows.find((row) => {
      const quantity = Number(row.actualPurchaseQuantity)
      return !Number.isFinite(quantity) || quantity < 0
    })
    if (invalidQuantity) {
      ElMessage.warning(`实际采购数量无效：${invalidQuantity.orderNo} / ${invalidQuantity.materialName}`)
      return
    }
    registerDialog.submitting = true
    try {
      await registerPurchaseBatch({
        items: registerDialog.rows.map((row) => ({
          orderId: row.orderId,
          materialIndex: row.materialIndex,
          supplierName: normalizeText(row.supplierName),
          actualPurchaseQuantity: Number(row.actualPurchaseQuantity) || 0,
          unitPrice: row.unitPrice.trim() || '0',
          otherCost: row.otherCost.trim() || '0',
          remark: row.remark.trim() || undefined,
          imageUrl: row.imageUrl.trim() || undefined,
        })),
      })
      ElMessage.success(`已登记 ${registerDialog.rows.length} 条采购`)
      registerDialog.visible = false
      await options.reload()
      await options.reloadTabCounts()
      options.clearSelection()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '登记失败'))
    } finally {
      registerDialog.submitting = false
    }
  }

  return {
    registerDialog,
    registerSupplierOptions,
    registerSupplierLoading,
    onRegisterSupplierVisibleChange,
    openRegisterDialog,
    resetRegisterForm,
    searchRegisterSuppliers,
    submitRegister,
  }
}

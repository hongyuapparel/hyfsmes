import type { Ref } from 'vue'
import type { SavePackingListPayload } from '@/api/packing-lists'
import { packingItemTotal, type PackingBoxDraft, type PackingItemDraft } from './usePackingGridRows'

/** 装箱单表头表单（usePackingListEdit 内 reactive 的形状） */
export interface PackingForm {
  customerId: number | null
  customerName: string
  serviceManager: string
  poNo: string
  country: string
  postalCode: string
  xiaomanOrderNo: string
  xiaomanOrderId: string
  packDate: string | null
  remark: string
  showCompany: boolean
}

interface PackingGridState {
  sizeHeaders: Ref<string[]>
  boxes: Ref<PackingBoxDraft[]>
}

export function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** 纯手工且完全空白的行：保存时过滤掉，避免存入无意义空行 */
export function isEmptyManualRow(item: PackingItemDraft): boolean {
  return (
    item.sourceType === 'manual' &&
    !item.styleNo &&
    !item.colorName &&
    !item.imageUrl &&
    packingItemTotal(item) === 0
  )
}

/** 把表单 + 网格组装成保存载荷：表头去空格、码列去空、空白手工行过滤、合计按尺码重算 */
export function buildPayload(form: PackingForm, grid: PackingGridState): SavePackingListPayload {
  return {
    customerId: form.customerId,
    customerName: form.customerName.trim(),
    serviceManager: form.serviceManager.trim(),
    poNo: form.poNo.trim(),
    country: form.country.trim(),
    postalCode: form.postalCode.trim(),
    xiaomanOrderNo: form.xiaomanOrderNo.trim(),
    xiaomanOrderId: form.xiaomanOrderId.trim(),
    packDate: form.packDate || null,
    remark: form.remark.trim(),
    showCompany: form.showCompany,
    sizeHeaders: grid.sizeHeaders.value.map((h) => h.trim()).filter(Boolean),
    boxes: grid.boxes.value.map((box) => ({
      weightKg: box.weightKg,
      cartonSize: box.cartonSize,
      remark: box.remark,
      items: box.items
        .filter((item) => !isEmptyManualRow(item))
        .map((item) => ({
          styleNo: item.styleNo,
          styleName: item.styleName,
          colorName: item.colorName,
          imageUrl: item.imageUrl,
          sizeQuantities: item.sizeQuantities,
          totalQty: packingItemTotal(item),
          sourceType: item.sourceType,
          sourceId: item.sourceId,
        })),
    })),
  }
}

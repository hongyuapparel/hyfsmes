import type { Ref } from 'vue'
import type { OrderFormPayload } from '@/api/orders'

interface UseOrderDetailHydrationParams {
  form: OrderFormPayload
  orderNo: Ref<string>
  orderStatus: Ref<string>
  skuProductGroupName: Ref<string>
  skuApplicablePeopleName: Ref<string>
  ensureCustomerById: (customerId: number | null | undefined) => Promise<void>
  defaultSizeHeaders: string[]
  sizeHeaders: Ref<string[]>
  colorRows: Ref<any[]>
  normalizeColorRows: () => void
  ensureAtLeastOneColorRow: () => void
  materials: Ref<any[]>
  roundMaterialQty2: (n: number) => number
  recalcPurchaseQuantity: (row: any) => void
  defaultSizeMetaHeaders: string[]
  sizeMetaHeaders: Ref<string[]>
  sizeInfoRows: Ref<any[]>
  nextSizeInfoRowKey: () => string
  normalizeSizeInfoRows: () => void
  processItems: Ref<any[]>
  productionRequirement: Ref<string>
  defaultPackagingHeaders: string[]
  packagingHeaders: Ref<string[]>
  packagingCells: Ref<any[]>
  normalizePackagingCells: () => void
  packagingMethod: Ref<string>
  attachments: Ref<string[]>
}

export function useOrderDetailHydration(params: UseOrderDetailHydrationParams) {
  async function hydrateOrderDetail(d: any) {
    params.orderNo.value = d.orderNo
    params.orderStatus.value = d.status ?? 'draft'
    params.form.skuCode = d.skuCode
    params.skuProductGroupName.value = d.productGroupName ?? ''
    params.skuApplicablePeopleName.value = d.applicablePeopleName ?? ''
    params.form.xiaomanOrderNo = d.xiaomanOrderNo ?? ''
    params.form.customerId = d.customerId ?? null
    params.form.customerName = d.customerName ?? ''
    params.form.salesperson = d.salesperson ?? ''
    params.form.merchandiser = d.merchandiser ?? ''
    params.form.merchandiserPhone = d.merchandiserPhone ?? ''
    ;(params.form as any).collaborationTypeId = d.collaborationTypeId ?? null
    ;(params.form as any).orderTypeId = d.orderTypeId ?? null
    await params.ensureCustomerById(params.form.customerId)
    params.form.secondaryProcess = d.processItem ?? ''
    params.form.quantity = d.quantity ?? 0
    params.form.exFactoryPrice = d.exFactoryPrice ?? ''
    params.form.salePrice = d.salePrice ?? ''
    params.form.orderDate = d.orderDate ?? ''
    params.form.customerDueDate = d.customerDueDate ?? ''
    params.form.imageUrl = d.imageUrl ?? ''

    params.sizeHeaders.value = d.colorSizeHeaders && Array.isArray(d.colorSizeHeaders)
      ? [...d.colorSizeHeaders]
      : [...params.defaultSizeHeaders]
    params.colorRows.value = (d.colorSizeRows ?? []).map((row: any) => ({
      colorName: row.colorName ?? '',
      quantities: Array.isArray(row.quantities) ? [...row.quantities] : Array(params.sizeHeaders.value.length).fill(0),
      remark: row.remark ?? '',
    }))
    params.normalizeColorRows()
    params.ensureAtLeastOneColorRow()

    params.materials.value = (d.materials ?? []).map((m: any) => ({
      materialSourceId: m.materialSourceId ?? null,
      materialSource: m.materialSource ?? '',
      materialTypeId: m.materialTypeId ?? null,
      materialType: m.materialType ?? '',
      supplierName: m.supplierName ?? '',
      materialName: m.materialName ?? '',
      color: m.color ?? '',
      fabricWidth: m.fabricWidth ?? '',
      usagePerPiece:
        m.usagePerPiece != null && m.usagePerPiece !== ''
          ? params.roundMaterialQty2(Number(m.usagePerPiece))
          : null,
      lossPercent: m.lossPercent ?? null,
      orderPieces: m.orderPieces ?? null,
      purchaseQuantity:
        m.purchaseQuantity != null && m.purchaseQuantity !== ''
          ? params.roundMaterialQty2(Number(m.purchaseQuantity))
          : null,
      cuttingQuantity: m.cuttingQuantity ?? null,
      remark: m.remark ?? '',
    }))
    params.materials.value.forEach((row) => params.recalcPurchaseQuantity(row))

    params.sizeMetaHeaders.value = d.sizeInfoMetaHeaders && Array.isArray(d.sizeInfoMetaHeaders)
      ? [...d.sizeInfoMetaHeaders]
      : [...params.defaultSizeMetaHeaders]
    params.sizeInfoRows.value = (d.sizeInfoRows ?? []).map((r: any) => ({
      __rowKey: params.nextSizeInfoRowKey(),
      metaValues: Array.isArray(r.metaValues) ? [...r.metaValues] : Array(params.sizeMetaHeaders.value.length).fill(''),
      sizeValues: Array.isArray(r.sizeValues)
        ? r.sizeValues.map((v: unknown) => (v == null ? '' : String(v)))
        : Array(params.sizeHeaders.value.length).fill(''),
    }))
    params.normalizeSizeInfoRows()

    params.processItems.value = (d.processItems ?? []).map((p: any) => ({
      processName: p.processName ?? '',
      supplierName: p.supplierName ?? '',
      part: p.part ?? '',
      remark: p.remark ?? '',
    }))
    params.productionRequirement.value = d.productionRequirement ?? ''
    params.packagingHeaders.value = d.packagingHeaders && Array.isArray(d.packagingHeaders)
      ? [...d.packagingHeaders]
      : [...params.defaultPackagingHeaders]
    params.packagingCells.value = (d.packagingCells ?? []).map((c: any) => ({
      imageUrl: c.imageUrl ?? '',
      accessoryId: c.accessoryId ?? null,
      accessoryName: c.accessoryName ?? '',
      description: c.description ?? '',
    }))
    params.normalizePackagingCells()
    params.packagingMethod.value = d.packagingMethod ?? ''
    params.attachments.value = (d.attachments ?? []) as string[]
  }

  return {
    hydrateOrderDetail,
  }
}

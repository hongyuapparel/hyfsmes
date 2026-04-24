import type { Ref } from 'vue'
import type { FormInstance } from 'element-plus'
import { ElMessage } from 'element-plus'
import type { OrderFormPayload } from '@/api/orders'
import type { ColorRow } from '@/composables/useOrderColorSizeMatrix'
import type { MaterialRow } from '@/composables/useOrderMaterials'
import type { SizeInfoRow } from '@/composables/useOrderSizeInfo'

interface ProcessItemInputRow {
  processName?: string
  supplierName?: string
  part?: string
  remark?: string
}

interface PackagingCellInputRow {
  imageUrl?: string
  accessoryId?: number | null
  accessoryName?: string
  description?: string
}

interface UseOrderEditPayloadParams {
  form: OrderFormPayload
  formRef: Ref<FormInstance | undefined>
  grandTotal: Ref<number>
  colorRows: Ref<ColorRow[]>
  sizeHeaders: Ref<string[]>
  materials: Ref<MaterialRow[]>
  sizeMetaHeaders: Ref<string[]>
  sizeInfoRows: Ref<SizeInfoRow[]>
  processItems: Ref<ProcessItemInputRow[]>
  productionRequirement: Ref<string>
  packagingHeaders: Ref<string[]>
  packagingCells: Ref<PackagingCellInputRow[]>
  packagingMethod: Ref<string>
  attachments: Ref<string[]>
}

export function useOrderEditPayload(params: UseOrderEditPayloadParams) {
  const {
    form,
    formRef,
    grandTotal,
    colorRows,
    sizeHeaders,
    materials,
    sizeMetaHeaders,
    sizeInfoRows,
    processItems,
    productionRequirement,
    packagingHeaders,
    packagingCells,
    packagingMethod,
    attachments,
  } = params

  function checkRequiredFields(): boolean {
    const missing: string[] = []
    if (!form.skuCode || !String(form.skuCode).trim()) missing.push('SKU')
    if (form.customerId == null || form.customerId === undefined) missing.push('客户')
    if (form.collaborationTypeId == null || form.collaborationTypeId === undefined) missing.push('合作方式')
    if (form.orderTypeId == null || form.orderTypeId === undefined) missing.push('订单类型')
    if (!form.customerDueDate) missing.push('客户交期')
    if (!String(form.merchandiser ?? '').trim()) missing.push('跟单员')
    {
      const str = String(form.salePrice ?? '').trim()
      const num = Number(str)
      if (!str || !Number.isFinite(num) || num <= 0) missing.push('销售价')
    }

    if (missing.length) {
      ElMessage.warning(`请先填写必填项：${missing.join('、')}`)
      void formRef.value?.validate().catch(() => {})
      return false
    }
    return true
  }

  async function collectPayload(): Promise<OrderFormPayload> {
    if (!checkRequiredFields()) {
      throw new Error('invalid form')
    }
    await formRef.value?.validate()
    const selectedCustomerName = form.customerName ?? ''
    const processItemSummary = processItems.value
      .map((p) => (p.processName ?? '').trim())
      .filter((name, idx, arr) => name && arr.indexOf(name) === idx)
      .join('、')
    return {
      ...form,
      customerName: selectedCustomerName,
      orderTypeId: form.orderTypeId ?? null,
      collaborationTypeId: form.collaborationTypeId ?? null,
      quantity: grandTotal.value,
      processItem: processItemSummary,
      colorSizeRows: colorRows.value.map((row) => ({
        colorName: row.colorName,
        quantities: [...row.quantities],
        remark: row.remark,
      })),
      colorSizeHeaders: [...sizeHeaders.value],
      materials: materials.value.map(({ materialType: _t, materialSource: _s, ...m }) => ({ ...m })),
      sizeInfoMetaHeaders: [...sizeMetaHeaders.value],
      sizeInfoRows: sizeInfoRows.value.map((r) => ({
        metaValues: [...r.metaValues],
        sizeValues: [...r.sizeValues],
      })),
      processItems: processItems.value.map((p) => ({ ...p })),
      productionRequirement: productionRequirement.value,
      packagingHeaders: [...packagingHeaders.value],
      packagingCells: packagingCells.value.map((c, idx) => ({
        header: packagingHeaders.value[idx],
        ...c,
      })),
      packagingMethod: packagingMethod.value,
      attachments: [...attachments.value],
    }
  }

  return {
    checkRequiredFields,
    collectPayload,
  }
}

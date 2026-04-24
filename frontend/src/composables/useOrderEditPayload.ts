import type { Ref } from 'vue'
import type { FormInstance } from 'element-plus'
import { ElMessage } from 'element-plus'
import type { OrderFormPayload } from '@/api/orders'

interface UseOrderEditPayloadParams {
  form: OrderFormPayload
  formRef: Ref<FormInstance | undefined>
  grandTotal: Ref<number>
  colorRows: Ref<any[]>
  sizeHeaders: Ref<string[]>
  materials: Ref<any[]>
  sizeMetaHeaders: Ref<string[]>
  sizeInfoRows: Ref<any[]>
  processItems: Ref<any[]>
  productionRequirement: Ref<string>
  packagingHeaders: Ref<string[]>
  packagingCells: Ref<any[]>
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
    if ((form as any).orderTypeId == null || (form as any).orderTypeId === undefined) missing.push('订单类型')
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
      orderTypeId: (form as any).orderTypeId ?? null,
      collaborationTypeId: (form as any).collaborationTypeId ?? null,
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

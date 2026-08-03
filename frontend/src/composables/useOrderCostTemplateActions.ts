import { ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { OrderDetail } from '@/api/orders'
import { createProcessQuoteTemplate, setProcessQuoteTemplateItems } from '@/api/process-quote-templates'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import type { ProductionRow } from '@/utils/order-cost'

interface SaveTemplateDialogState {
  visible: boolean
  name: string
  submitting: boolean
}

interface UseOrderCostTemplateActionsParams {
  order: Ref<OrderDetail | null>
  productionRows: Ref<ProductionRow[]>
  productionRowsSorted: Readonly<Ref<ProductionRow[]>>
  loadImportTemplateOptions: () => Promise<void>
}

/** 将当前有效生产工序保存为报价模板。 */
export function useOrderCostTemplateActions(params: UseOrderCostTemplateActionsParams) {
  const saveTemplateDialog = ref<SaveTemplateDialogState>({
    visible: false,
    name: '',
    submitting: false,
  })

  function openSaveTemplateDialog() {
    const hasValid = params.productionRows.value.some((row) => Number(row.processId) > 0)
    if (!hasValid) return ElMessage.warning('请先至少选择一条有效工序，再保存为模板')
    const orderNo = (params.order.value?.orderNo ?? '').trim()
    const skuCode = (params.order.value?.skuCode ?? '').trim()
    const fallback = [orderNo, skuCode].filter(Boolean).join('-')
    saveTemplateDialog.value = { visible: true, name: fallback ? `${fallback}-报价模板` : '', submitting: false }
  }

  async function saveCurrentProcessesAsTemplate() {
    const name = saveTemplateDialog.value.name.trim()
    if (!name) return ElMessage.warning('请填写模板名称')
    const processIds = Array.from(new Set(
      params.productionRowsSorted.value
        .map((row) => Number(row.processId))
        .filter((id) => Number.isInteger(id) && id > 0),
    ))
    if (!processIds.length) return ElMessage.warning('当前没有可保存的工序')
    saveTemplateDialog.value.submitting = true
    try {
      const created = await createProcessQuoteTemplate({ name })
      const templateId = created.data?.id
      if (!templateId) throw new Error('模板创建失败')
      await setProcessQuoteTemplateItems(templateId, processIds)
      saveTemplateDialog.value.visible = false
      saveTemplateDialog.value.name = ''
      await params.loadImportTemplateOptions()
      ElMessage.success(`已保存模板：${name}`)
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '保存模板失败'))
    } finally {
      saveTemplateDialog.value.submitting = false
    }
  }

  return { saveTemplateDialog, openSaveTemplateDialog, saveCurrentProcessesAsTemplate }
}

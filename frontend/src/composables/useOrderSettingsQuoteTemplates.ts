import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getProductionProcesses,
  type ProductionProcessItem,
} from '@/api/production-processes'
import {
  getProcessQuoteTemplates,
  getProcessQuoteTemplateItems,
  createProcessQuoteTemplate,
  updateProcessQuoteTemplate,
  deleteProcessQuoteTemplate,
  setProcessQuoteTemplateItems,
  type ProcessQuoteTemplate,
  type ProcessQuoteTemplateItem,
} from '@/api/process-quote-templates'

export function useOrderSettingsQuoteTemplates() {
  const quoteTemplateList = ref<ProcessQuoteTemplate[]>([])
  const quoteTemplateDialog = ref<{ visible: boolean; id?: number }>({ visible: false })
  const quoteTemplateForm = ref({ name: '' })
  const quoteTemplateItemsDialog = ref<{ visible: boolean; templateId?: number; name?: string }>({ visible: false })
  const quoteTemplateItemsEdit = ref<Array<{ processId: number; department: string; jobType: string; processName: string; unitPrice: string }>>([])
  const quoteTemplateProcessOptions = ref<ProductionProcessItem[]>([])
  const quoteTemplateItemToAdd = ref<number[]>([])
  const activeQuoteTemplateIds = ref<string[]>([])
  const quoteTemplateItemsMap = ref<Record<number, ProcessQuoteTemplateItem[]>>({})
  const quoteTemplateItemsLoadingMap = ref<Record<number, boolean>>({})

  async function loadQuoteTemplates() {
    try {
      const res = await getProcessQuoteTemplates()
      quoteTemplateList.value = res.data ?? []
      activeQuoteTemplateIds.value = []
      quoteTemplateItemsMap.value = {}
      quoteTemplateItemsLoadingMap.value = {}
    } catch {
      quoteTemplateList.value = []
      activeQuoteTemplateIds.value = []
      quoteTemplateItemsMap.value = {}
      quoteTemplateItemsLoadingMap.value = {}
    }
  }

  async function ensureQuoteTemplateItemsLoaded(templateId: number) {
    if (quoteTemplateItemsMap.value[templateId]) return
    quoteTemplateItemsLoadingMap.value[templateId] = true
    try {
      const res = await getProcessQuoteTemplateItems(templateId)
      quoteTemplateItemsMap.value[templateId] = (res.data ?? []) as ProcessQuoteTemplateItem[]
    } catch {
      quoteTemplateItemsMap.value[templateId] = []
    } finally {
      quoteTemplateItemsLoadingMap.value[templateId] = false
    }
  }

  function onQuoteTemplateCollapseChange(names: string[] | string) {
    const values = Array.isArray(names) ? names : [names]
    values.forEach((name) => {
      const id = Number(name)
      if (!Number.isNaN(id) && id > 0) void ensureQuoteTemplateItemsLoaded(id)
    })
  }

  function isQuoteTemplateExpanded(templateId: number) {
    return activeQuoteTemplateIds.value.includes(String(templateId))
  }

  function openQuoteTemplateDialog(row?: ProcessQuoteTemplate) {
    if (row) {
      quoteTemplateDialog.value = { visible: true, id: row.id }
      quoteTemplateForm.value = { name: row.name }
      return
    }
    quoteTemplateDialog.value = { visible: true }
    quoteTemplateForm.value = { name: '' }
  }

  async function submitQuoteTemplate() {
    const name = quoteTemplateForm.value.name?.trim()
    if (!name) {
      ElMessage.warning('请填写模板名称')
      return
    }
    try {
      if (quoteTemplateDialog.value.id) {
        await updateProcessQuoteTemplate(quoteTemplateDialog.value.id, { name })
      } else {
        await createProcessQuoteTemplate({ name })
      }
      quoteTemplateDialog.value.visible = false
      await loadQuoteTemplates()
    } catch (e: unknown) {
      ElMessage.error((e as { message?: string })?.message ?? '操作失败')
    }
  }

  async function removeQuoteTemplate(row: ProcessQuoteTemplate) {
    try {
      await ElMessageBox.confirm(`确定删除模板「${row.name}」？`, '删除确认', { type: 'warning' })
      await deleteProcessQuoteTemplate(row.id)
      ElMessage.success('已删除')
      await loadQuoteTemplates()
    } catch (e) {
      if ((e as string) !== 'cancel') ElMessage.error('删除失败')
    }
  }

  async function openQuoteTemplateItemsDialog(row: ProcessQuoteTemplate) {
    quoteTemplateItemsDialog.value = { visible: true, templateId: row.id, name: row.name }
    quoteTemplateItemToAdd.value = []
    try {
      const [itemsRes, processesRes] = await Promise.all([getProcessQuoteTemplateItems(row.id), getProductionProcesses()])
      const items = (itemsRes.data ?? []) as ProcessQuoteTemplateItem[]
      quoteTemplateItemsEdit.value = items.map((item) => ({
        processId: item.processId,
        department: item.department,
        jobType: item.jobType,
        processName: item.processName,
        unitPrice: item.unitPrice,
      }))
      quoteTemplateProcessOptions.value = processesRes.data ?? []
    } catch {
      quoteTemplateItemsEdit.value = []
      quoteTemplateProcessOptions.value = []
    }
  }

  function addQuoteTemplateItem() {
    const ids = quoteTemplateItemToAdd.value
    if (!ids?.length) return
    const existingIds = new Set(quoteTemplateItemsEdit.value.map((item) => item.processId))
    let added = 0
    for (const id of ids) {
      if (existingIds.has(id)) continue
      const process = quoteTemplateProcessOptions.value.find((item) => item.id === id)
      if (!process) continue
      quoteTemplateItemsEdit.value.push({
        processId: process.id,
        department: process.department ?? '',
        jobType: process.jobType ?? '',
        processName: process.name ?? '',
        unitPrice: process.unitPrice ?? '0.00',
      })
      existingIds.add(process.id)
      added += 1
    }
    quoteTemplateItemToAdd.value = []
    if (added > 0) ElMessage.success(`已添加 ${added} 条工序`)
  }

  function removeQuoteTemplateItem(row: { processId: number }) {
    quoteTemplateItemsEdit.value = quoteTemplateItemsEdit.value.filter((item) => item.processId !== row.processId)
  }

  async function submitQuoteTemplateItems() {
    const templateId = quoteTemplateItemsDialog.value.templateId
    if (templateId == null) return
    try {
      await setProcessQuoteTemplateItems(templateId, quoteTemplateItemsEdit.value.map((item) => item.processId))
      quoteTemplateItemsMap.value[templateId] = quoteTemplateItemsEdit.value.map((item) => ({
        id: item.processId,
        templateId,
        processId: item.processId,
        sortOrder: 0,
        department: item.department,
        jobType: item.jobType,
        processName: item.processName,
        unitPrice: item.unitPrice,
      }))
      quoteTemplateItemsDialog.value.visible = false
      ElMessage.success('已保存')
    } catch (e: unknown) {
      ElMessage.error((e as { message?: string })?.message ?? '操作失败')
    }
  }

  return {
    quoteTemplateList,
    quoteTemplateDialog,
    quoteTemplateForm,
    quoteTemplateItemsDialog,
    quoteTemplateItemsEdit,
    quoteTemplateProcessOptions,
    quoteTemplateItemToAdd,
    activeQuoteTemplateIds,
    quoteTemplateItemsMap,
    quoteTemplateItemsLoadingMap,
    loadQuoteTemplates,
    onQuoteTemplateCollapseChange,
    isQuoteTemplateExpanded,
    openQuoteTemplateDialog,
    submitQuoteTemplate,
    removeQuoteTemplate,
    openQuoteTemplateItemsDialog,
    addQuoteTemplateItem,
    removeQuoteTemplateItem,
    submitQuoteTemplateItems,
  }
}

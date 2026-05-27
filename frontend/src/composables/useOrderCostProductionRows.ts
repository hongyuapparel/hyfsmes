import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { type ProductionProcessItem } from '@/api/production-processes'
import {
  DEFAULT_PRODUCTION_PROCESS_QTY,
  formatProductionProcessSelectLabel,
  type ProductionRow,
} from '@/utils/order-cost'

export function useOrderCostProductionRows(
  productionRows: { value: ProductionRow[] },
  productionProcesses: { value: ProductionProcessItem[] },
  loadProcesses: () => Promise<void>,
) {
  const productionPickerVisible = ref(false)
  const selectedProductionRows = ref<ProductionRow[]>([])

  const productionAddedIdsSignature = computed(() => {
    const ids = productionRows.value.map((row) => Number(row.processId)).filter((id) => Number.isInteger(id) && id > 0)
    return [...new Set(ids)].sort((a, b) => a - b).join(',')
  })

  const departmentOptions = computed(() => {
    const values = productionProcesses.value.map((item) => item.department).filter((item): item is string => !!item)
    return Array.from(new Set(values))
  })

  function getJobTypeOptions(row: ProductionRow): string[] {
    const dept = (row.department ?? '').trim()
    const values = productionProcesses.value
      .filter((item) => !dept || (item.department ?? '').trim() === dept)
      .map((item) => item.jobType)
      .filter((item): item is string => !!item)
    return Array.from(new Set(values))
  }

  function getProductionProcessSelectOptions(row: ProductionRow): Array<{ value: number; label: string }> {
    const dept = (row.department ?? '').trim()
    const job = (row.jobType ?? '').trim()
    return productionProcesses.value
      .filter((item) => (!dept || (item.department ?? '').trim() === dept) && (!job || (item.jobType ?? '').trim() === job))
      .map((item) => ({ value: item.id, label: formatProductionProcessSelectLabel(item.name ?? '') }))
  }

  async function openProductionPickerDialog() {
    await loadProcesses()
    productionPickerVisible.value = true
  }

  function onProductionPickerAppend(items: ProductionProcessItem[]) {
    const existing = new Set(
      productionRows.value.map((row) => Number(row.processId)).filter((id) => Number.isInteger(id) && id > 0),
    )
    const appended = items
      .map((item) => ({
        processId: item.id,
        department: item.department ?? '',
        jobType: item.jobType ?? '',
        processName: item.name ?? '',
        remark: '',
        unitPrice: Number(item.unitPrice) || 0,
        quantity: DEFAULT_PRODUCTION_PROCESS_QTY,
      }))
      .filter((row) => !existing.has(Number(row.processId)))
    if (!appended.length) return
    productionRows.value = [...productionRows.value, ...appended]
  }

  function removeProductionRow(row: ProductionRow) {
    productionRows.value = productionRows.value.filter((item) => item !== row)
    selectedProductionRows.value = selectedProductionRows.value.filter((item) => item !== row)
  }

  function onProductionSelectionChange(rows: ProductionRow[]) {
    selectedProductionRows.value = rows
  }

  async function batchRemoveProductionRows() {
    if (!selectedProductionRows.value.length) return
    try {
      await ElMessageBox.confirm(`确认删除已选 ${selectedProductionRows.value.length} 条工序吗？`, '批量删除', { type: 'warning' })
    } catch {
      return
    }
    const selected = new Set(selectedProductionRows.value)
    productionRows.value = productionRows.value.filter((item) => !selected.has(item))
    selectedProductionRows.value = []
    ElMessage.success('已批量删除工序')
  }

  function onProductionProcessChange(row: ProductionRow) {
    if (!row.processId) return
    const found = productionProcesses.value.find((item) => item.id === row.processId)
    if (!found) return
    row.department = found.department || row.department
    row.jobType = found.jobType || row.jobType
    row.unitPrice = Number(found.unitPrice) || 0
    row.processName = found.name
  }

  function onProductionDepartmentChange(row: ProductionRow) {
    const jobs = getJobTypeOptions(row)
    if (row.jobType && !jobs.includes(row.jobType)) {
      row.jobType = ''
      row.processId = null
      row.processName = ''
      row.unitPrice = 0
      return
    }
    if (!getProductionProcessSelectOptions(row).some((item) => item.value === row.processId)) {
      row.processId = null
      row.processName = ''
      row.unitPrice = 0
    }
  }

  function onProductionJobTypeChange(row: ProductionRow) {
    if (!getProductionProcessSelectOptions(row).some((item) => item.value === row.processId)) {
      row.processId = null
      row.processName = ''
      row.unitPrice = 0
    }
  }

  return {
    productionPickerVisible,
    selectedProductionRows,
    productionAddedIdsSignature,
    departmentOptions,
    getJobTypeOptions,
    getProductionProcessSelectOptions,
    openProductionPickerDialog,
    onProductionPickerAppend,
    removeProductionRow,
    onProductionSelectionChange,
    batchRemoveProductionRows,
    onProductionProcessChange,
    onProductionDepartmentChange,
    onProductionJobTypeChange,
  }
}

import { ref } from 'vue'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import request from '@/api/request'
import { getSupplierBusinessScopeTreeOptions, type SupplierBusinessScopeTreeNode } from '@/api/suppliers'
import {
  DEFAULT_PROCESS_ITEM_QTY,
  type MaterialRow,
  type ProcessItemRow,
} from '@/utils/order-cost'

interface ProcessOptionNode {
  label: string
  value: string
  children?: ProcessOptionNode[]
}

export function useOrderCostMaterialRows(materialRows: { value: MaterialRow[] }, processItemRows: { value: ProcessItemRow[] }) {
  const supplierOptions = ref<Array<{ id: number; name: string }>>([])
  const supplierLoading = ref(false)
  const processOptions = ref<ProcessOptionNode[]>([])
  const hasPreloadedSuppliers = ref(false)
  const hasLoadedProcessOptions = ref(false)

  async function searchSuppliers(keyword: string) {
    supplierLoading.value = true
    try {
      const res = await request.get('/suppliers', {
        params: { keyword: keyword || undefined, pageSize: 20 },
        skipGlobalErrorHandler: true,
      })
      supplierOptions.value = (res.data as { list?: { id: number; name: string }[] }).list ?? []
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('供应商下拉加载失败', getErrorMessage(e))
    } finally {
      supplierLoading.value = false
    }
  }

  function onSupplierSelectVisibleChange(visible: boolean) {
    if (!visible || hasPreloadedSuppliers.value) return
    hasPreloadedSuppliers.value = true
    void searchSuppliers('')
  }

  async function loadProcessOptions() {
    if (hasLoadedProcessOptions.value) return
    try {
      const res = await getSupplierBusinessScopeTreeOptions('工艺供应商')
      const toTree = (nodes: SupplierBusinessScopeTreeNode[], parentPath = ''): ProcessOptionNode[] =>
        nodes.map((item) => {
          const path = parentPath ? `${parentPath} / ${item.value}` : item.value
          return { label: item.value, value: path, children: item.children?.length ? toTree(item.children, path) : undefined }
        })
      processOptions.value = toTree(res.data ?? [])
      hasLoadedProcessOptions.value = true
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('工艺项目选项加载失败', getErrorMessage(e))
    }
  }

  function onProcessOptionsVisibleChange(visible: boolean) {
    if (!visible) return
    void loadProcessOptions()
  }

  function addMaterialRow() {
    materialRows.value.push({ unitPrice: 0, includeInCost: true } as MaterialRow)
  }

  function removeMaterialRow(row: MaterialRow) {
    materialRows.value = materialRows.value.filter((item) => item !== row)
  }

  function addProcessItemRow() {
    processItemRows.value.push({ unitPrice: 0, quantity: DEFAULT_PROCESS_ITEM_QTY } as ProcessItemRow)
  }

  function removeProcessItemRow(index: number) {
    processItemRows.value.splice(index, 1)
  }

  return {
    supplierOptions,
    supplierLoading,
    processOptions,
    searchSuppliers,
    onSupplierSelectVisibleChange,
    onProcessOptionsVisibleChange,
    addMaterialRow,
    removeMaterialRow,
    addProcessItemRow,
    removeProcessItemRow,
  }
}

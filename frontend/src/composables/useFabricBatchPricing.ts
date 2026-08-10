import { reactive, ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { batchUpdateFabricPrices, type FabricItem } from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'

export interface FabricBatchPriceRow {
  id: number
  name: string
  quantity: number
  unit: string
  unitPrice: number | null
}

export function useFabricBatchPricing(options: {
  selectedRows: Ref<FabricItem[]>
  reload: () => Promise<void> | void
  clearSelection: () => void
}) {
  const visible = ref(false)
  const submitting = ref(false)
  const rows = reactive<FabricBatchPriceRow[]>([])

  function open() {
    if (!options.selectedRows.value.length) {
      ElMessage.warning('请先选择需要补价的面料')
      return
    }
    rows.splice(0, rows.length, ...options.selectedRows.value.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: Number(item.quantity) || 0,
      unit: item.unit || '',
      unitPrice: item.unitPrice == null ? null : Number(item.unitPrice),
    })))
    visible.value = true
  }

  async function submit() {
    if (rows.some((row) => row.unitPrice == null || !Number.isFinite(Number(row.unitPrice)) || Number(row.unitPrice) < 0)) {
      ElMessage.warning('请为每一行填写大于或等于 0 的实际成本单价')
      return
    }
    submitting.value = true
    try {
      await batchUpdateFabricPrices(rows.map((row) => ({ id: row.id, unitPrice: Number(row.unitPrice) })))
      ElMessage.success(`已更新 ${rows.length} 条面料价格`)
      visible.value = false
      options.clearSelection()
      await options.reload()
    } catch (error: unknown) {
      if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
    } finally {
      submitting.value = false
    }
  }

  return { visible, submitting, rows, open, submit }
}

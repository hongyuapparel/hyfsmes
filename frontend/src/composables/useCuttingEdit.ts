import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  editCutting,
  type CuttingCompletedDetailRes,
  type CuttingListItem,
} from '@/api/production-cutting'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useCuttingFormState } from '@/composables/useCuttingFormState'

interface UseCuttingEditParams {
  reloadList: () => Promise<void>
  reloadTabCounts: () => Promise<void>
}

export function useCuttingEdit(params: UseCuttingEditParams) {
  const { reloadList, reloadTabCounts } = params

  const fs = useCuttingFormState()

  const editDialog = reactive<{
    visible: boolean
    submitting: boolean
    row: CuttingListItem | null
  }>({ visible: false, submitting: false, row: null })

  // 打开时若下游车缝已登记，外层已弹窗确认，此处记录以便提交时带上确认标记
  const confirmDownstream = ref(false)

  function openEditDialog(row: CuttingListItem, detail: CuttingCompletedDetailRes) {
    editDialog.row = row
    confirmDownstream.value = detail.downstream?.sewingStarted === true
    fs.form.orderBrief = { ...detail.orderBrief }
    fs.form.colorSizeHeaders = detail.colorSizeHeaders ?? []
    const rows = detail.actualCutRows ?? []
    fs.form.actualCutRows = rows.map((r) => ({
      colorName: r.colorName ?? '',
      quantities: Array.isArray(r.quantities) ? [...r.quantities] : [],
      remark: r.remark ?? '',
    }))
    if (fs.form.actualCutRows.length === 0) {
      fs.form.actualCutRows = [{ colorName: '', quantities: [], remark: '' }]
    }
    const len = fs.form.colorSizeHeaders.length
    fs.form.actualCutRows.forEach((r) => {
      while (r.quantities.length < len) r.quantities.push(0)
    })
    fs.form.materialUsageRows = JSON.parse(JSON.stringify(detail.materialUsageRows ?? []))
    fs.form.cuttingDepartment = (detail.cuttingDepartment ?? '').trim()
    fs.form.cutterName = (detail.cutterName ?? '').trim()
    fs.cuttingUnitPriceText.value =
      detail.cuttingUnitPrice != null && String(detail.cuttingUnitPrice).trim() !== ''
        ? String(Number(detail.cuttingUnitPrice))
        : ''
    editDialog.visible = true
  }

  function resetEditForm() {
    editDialog.row = null
    confirmDownstream.value = false
    fs.resetForm()
  }

  async function submitEdit() {
    if (!editDialog.row) return
    const err = fs.validateBasics()
    if (err) {
      ElMessage.warning(err)
      return
    }
    editDialog.submitting = true
    try {
      const core = fs.buildSubmitCore()
      await editCutting({
        orderId: editDialog.row.orderId,
        ...core,
        confirmDownstream: confirmDownstream.value,
      })
      ElMessage.success('裁床数据已更新')
      editDialog.visible = false
      await reloadList()
      await reloadTabCounts()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '操作失败'))
    } finally {
      editDialog.submitting = false
    }
  }

  return {
    editDialog,
    editForm: fs.form,
    isSelfCutting: fs.isSelfCutting,
    actualCutGrandTotal: fs.actualCutGrandTotal,
    cuttingUnitPriceNum: fs.cuttingUnitPriceNum,
    cuttingTotalCostDisplay: fs.cuttingTotalCostDisplay,
    fabricNetGrandTotal: fs.fabricNetGrandTotal,
    formatFabricGrand: fs.formatFabricGrand,
    onCuttingDepartmentChange: fs.onCuttingDepartmentChange,
    openEditDialog,
    resetEditForm,
    submitEdit,
  }
}

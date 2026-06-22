import { reactive, ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  completeCutting,
  getCuttingRegisterForm,
  type ColorSizeRow,
  type CuttingListItem,
} from '@/api/production-cutting'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getSupplierList, type SupplierItem } from '@/api/suppliers'
import { getStaffOptions } from '@/api/hr'
import { useCuttingFormState, SELF_DEPARTMENT_LABEL } from '@/composables/useCuttingFormState'

interface UseCuttingRegisterParams {
  selectedRows: Ref<CuttingListItem[]>
  reloadList: () => Promise<void>
  reloadTabCounts: () => Promise<void>
}

export function useCuttingRegister(params: UseCuttingRegisterParams) {
  const { selectedRows, reloadList, reloadTabCounts } = params

  const fs = useCuttingFormState()

  const registerDialog = reactive<{
    visible: boolean
    submitting: boolean
    row: CuttingListItem | null
  }>({ visible: false, submitting: false, row: null })

  const cuttingDepartmentOptions = ref<string[]>([])
  const cutterOptions = ref<string[]>([])

  async function openRegisterDialog() {
    const pending = selectedRows.value.filter((r) => r.cuttingStatus !== 'completed')
    if (pending.length === 0) return
    const row = pending[0]
    registerDialog.row = row
    registerDialog.visible = true
    try {
      const res = await getCuttingRegisterForm(row.orderId)
      const data = res.data
      if (!data) {
        registerDialog.visible = false
        return
      }
      fs.form.orderBrief = { ...data.orderBrief }
      fs.form.colorSizeHeaders = data.colorSizeHeaders ?? []
      const rows = data.colorSizeRows ?? []
      fs.form.actualCutRows = rows.map((r: ColorSizeRow) => ({
        colorName: r.colorName ?? '',
        quantities: Array.isArray(r.quantities) ? [...r.quantities] : [],
        remark: r.remark ?? '',
        imageUrl: r.imageUrl ?? '',
      }))
      if (fs.form.actualCutRows.length === 0) {
        fs.form.actualCutRows = [{ colorName: '', quantities: [], remark: '' }]
      }
      const len = fs.form.colorSizeHeaders.length
      fs.form.actualCutRows.forEach((r) => {
        while (r.quantities.length < len) r.quantities.push(0)
      })
      fs.form.materialUsageRows = JSON.parse(JSON.stringify(data.materialUsageRows ?? []))
      fs.cuttingUnitPriceText.value = ''
      fs.form.cuttingDepartment = SELF_DEPARTMENT_LABEL
      fs.form.cutterName = ''
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
      registerDialog.visible = false
    }
  }

  function resetRegisterForm() {
    registerDialog.row = null
    fs.resetForm()
  }

  async function submitRegister() {
    if (!registerDialog.row) return
    const err = fs.validateBasics()
    if (err) {
      ElMessage.warning(err)
      return
    }
    registerDialog.submitting = true
    try {
      const core = fs.buildSubmitCore()
      await completeCutting({ orderId: registerDialog.row.orderId, ...core })
      ElMessage.success('裁床登记完成，订单已进入待车缝')
      registerDialog.visible = false
      await reloadList()
      await reloadTabCounts()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '操作失败'))
    } finally {
      registerDialog.submitting = false
    }
  }

  async function loadCuttingDepartments() {
    try {
      const res = await getSupplierList({ type: '加工供应商', page: 1, pageSize: 200 })
      const list: SupplierItem[] = res.data?.list ?? []
      const names = list.map((s) => (s.name ?? '').trim()).filter((v) => !!v)
      const uniq = Array.from(new Set(names)).filter((n) => n !== SELF_DEPARTMENT_LABEL)
      cuttingDepartmentOptions.value = uniq
    } catch {
      cuttingDepartmentOptions.value = []
    }
  }

  async function loadCutterOptions() {
    try {
      const res = await getStaffOptions()
      const list = res.data ?? []
      const names = list
        .filter((e) => {
          const dept = (e.departmentName ?? '').trim()
          const job = (e.jobTitleName ?? '').trim()
          const status = (e.status ?? '').toLowerCase()
          return dept.includes('裁床') && job.includes('电剪') && status !== 'left'
        })
        .map((e) => (e.name ?? '').trim())
        .filter((v) => !!v)
      const uniq = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'zh-CN'))
      cutterOptions.value = uniq
    } catch {
      cutterOptions.value = []
    }
  }

  return {
    SELF_DEPARTMENT_LABEL,
    registerDialog,
    registerForm: fs.form,
    cuttingDepartmentOptions,
    isSelfCutting: fs.isSelfCutting,
    cutterOptions,
    actualCutGrandTotal: fs.actualCutGrandTotal,
    cuttingUnitPriceNum: fs.cuttingUnitPriceNum,
    cuttingTotalCostDisplay: fs.cuttingTotalCostDisplay,
    fabricNetGrandTotal: fs.fabricNetGrandTotal,
    formatFabricGrand: fs.formatFabricGrand,
    openRegisterDialog,
    resetRegisterForm,
    submitRegister,
    loadCuttingDepartments,
    loadCutterOptions,
    onCuttingDepartmentChange: fs.onCuttingDepartmentChange,
  }
}

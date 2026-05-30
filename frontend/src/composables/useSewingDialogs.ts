import { ref, reactive, computed, type Ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  assignSewing,
  getCompleteFormData,
  completeSewing,
  type SewingListItem,
} from '@/api/production-sewing'
import { getSupplierList, type SupplierItem } from '@/api/suppliers'
import { getErrorMessage, isErrorHandled } from '@/api/request'

type RefreshCallback = () => Promise<void>

function nowDatetimeStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}:${s}`
}

export function useSewingDialogs(selectedRows: Ref<SewingListItem[]>, refreshAfterMutation: RefreshCallback) {
  const factorySuppliers = ref<SupplierItem[]>([])

  const assignDialog = reactive<{ visible: boolean; submitting: boolean }>({
    visible: false,
    submitting: false,
  })
  const assignFormRef = ref<FormInstance>()
  const assignForm = reactive({
    distributedAt: '',
    factoryDueDate: '',
    factoryName: '',
    sewingFee: '',
  })
  const assignRules: FormRules = {
    factoryName: [{ required: true, message: '请选择加工供应商', trigger: 'change' }],
  }

  const registerDialog = reactive<{
    visible: boolean
    submitting: boolean
    row: SewingListItem | null
  }>({ visible: false, submitting: false, row: null })
  const registerFormCompleteLoading = ref(false)
  const registerFormRef = ref<FormInstance>()
  const registerForm = reactive<{
    headers: string[]
    sizeHeaders: string[]
    orderRow: (number | null)[]
    cutRow: (number | null)[]
    orderColorRows: Array<{ colorName: string; quantities: number[] }>
    cutColorRows: Array<{ colorName: string; quantities: number[] }>
    sewingQuantitiesByColor: Array<{ colorName: string; quantities: number[] }>
    defectQuantity: number
    defectReason: string
  }>({
    headers: [],
    sizeHeaders: [],
    orderRow: [],
    cutRow: [],
    orderColorRows: [],
    cutColorRows: [],
    sewingQuantitiesByColor: [],
    defectQuantity: 0,
    defectReason: '',
  })
  const registerSizeTableRows = computed(() => {
    const h = registerForm.headers
    if (!h.length) return []
    return [
      { key: 'order', label: '订单数量', values: registerForm.orderRow },
      { key: 'cut', label: '裁床数量', values: registerForm.cutRow },
    ]
  })
  const registerSewingTotal = computed(() =>
    registerForm.sewingQuantitiesByColor.reduce(
      (sum, r) => sum + (Array.isArray(r.quantities) ? r.quantities.reduce((s, n) => s + (Number(n) || 0), 0) : 0),
      0,
    ),
  )
  /** 每个颜色×尺码的车缝上限 = 对应裁床数量 */
  function registerSewingCellMax(rowIdx: number, colIdx: number): number | undefined {
    const cut = registerForm.cutColorRows?.[rowIdx]?.quantities?.[colIdx]
    return cut != null && Number.isFinite(Number(cut)) ? Number(cut) : undefined
  }
  const registerRules: FormRules = {
    defectQuantity: [],
    defectReason: [],
  }

  async function loadFactorySuppliers() {
    try {
      const res = await getSupplierList({ type: '加工供应商', pageSize: 500 })
      factorySuppliers.value = res.data?.list ?? []
    } catch {
      factorySuppliers.value = []
    }
  }

  function openAssignDialog() {
    if (selectedRows.value.length === 0) return
    assignForm.distributedAt = nowDatetimeStr()
    assignForm.factoryDueDate = ''
    assignForm.factoryName = selectedRows.value[0]?.factoryName ?? ''
    assignForm.sewingFee = ''
    assignDialog.visible = true
  }

  function resetAssignForm() {
    assignFormRef.value?.clearValidate()
  }

  async function submitAssign() {
    await assignFormRef.value?.validate().catch(() => {})
    if (selectedRows.value.length === 0) return
    assignDialog.submitting = true
    try {
      for (const row of selectedRows.value) {
        await assignSewing({
          orderId: row.orderId,
          distributedAt: assignForm.distributedAt || nowDatetimeStr(),
          factoryDueDate: assignForm.factoryDueDate || '',
          factoryName: assignForm.factoryName,
          sewingFee: assignForm.sewingFee?.trim() || '0',
        })
      }
      ElMessage.success('分单成功')
      assignDialog.visible = false
      await refreshAfterMutation()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '分单失败'))
    } finally {
      assignDialog.submitting = false
    }
  }

  async function openRegisterDialog() {
    const pending = selectedRows.value.filter((r) => r.sewingStatus !== 'completed')
    if (pending.length === 0) return
    const row = pending[0]
    registerDialog.row = row
    registerForm.headers = []
    registerForm.sizeHeaders = []
    registerForm.orderRow = []
    registerForm.cutRow = []
    registerForm.orderColorRows = []
    registerForm.cutColorRows = []
    registerForm.sewingQuantitiesByColor = []
    registerForm.defectQuantity = 0
    registerForm.defectReason = ''
    registerDialog.visible = true
    registerFormCompleteLoading.value = true
    try {
      const res = await getCompleteFormData(row.orderId)
      const data = res.data
      const headers = data?.headers ?? []
      const sizeHeaders = data?.sizeHeaders ?? []
      const orderRow = data?.orderRow ?? []
      const cutRow = data?.cutRow ?? []
      const orderColorRows = Array.isArray(data?.orderColorRows) ? data.orderColorRows : []
      const cutColorRows = Array.isArray(data?.cutColorRows) ? data.cutColorRows : []
      registerForm.headers = headers
      registerForm.sizeHeaders = sizeHeaders
      registerForm.orderRow = orderRow
      registerForm.cutRow = cutRow
      registerForm.orderColorRows = orderColorRows
      registerForm.cutColorRows = cutColorRows
      // 默认：把"裁床按颜色×尺码"作为车缝默认值（用户大概率沿用），可逐格修改
      const sizeLen = sizeHeaders.length
      registerForm.sewingQuantitiesByColor = orderColorRows.map((plan, ri) => {
        const cutQ = cutColorRows[ri]?.quantities ?? []
        const orderQ = plan.quantities ?? []
        const quantities = Array.from({ length: sizeLen }, (_, ci) => {
          const c = Number(cutQ[ci])
          if (Number.isFinite(c) && c > 0) return c
          const o = Number(orderQ[ci])
          return Number.isFinite(o) && o > 0 ? o : 0
        })
        return { colorName: plan.colorName, quantities }
      })
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载尺寸细数失败'))
      registerDialog.visible = false
    } finally {
      registerFormCompleteLoading.value = false
    }
  }

  function resetRegisterForm() {
    registerDialog.row = null
    registerForm.headers = []
    registerForm.sizeHeaders = []
    registerForm.orderRow = []
    registerForm.cutRow = []
    registerForm.orderColorRows = []
    registerForm.cutColorRows = []
    registerForm.sewingQuantitiesByColor = []
    registerForm.defectQuantity = 0
    registerForm.defectReason = ''
    registerFormRef.value?.clearValidate()
  }

  async function submitRegister() {
    if (!registerDialog.row) return
    const total = registerSewingTotal.value
    if (total <= 0) {
      ElMessage.warning('请填写车缝数量')
      return
    }
    await registerFormRef.value?.validate().catch(() => {})
    registerDialog.submitting = true
    try {
      await completeSewing({
        orderId: registerDialog.row.orderId,
        sewingQuantity: total,
        defectQuantity: registerForm.defectQuantity,
        defectReason: registerForm.defectReason.trim(),
        sewingQuantitiesByColor: registerForm.sewingQuantitiesByColor,
      })
      ElMessage.success('车缝登记完成，订单已进入待尾部')
      registerDialog.visible = false
      await refreshAfterMutation()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '操作失败'))
    } finally {
      registerDialog.submitting = false
    }
  }

  return {
    factorySuppliers,
    assignDialog,
    assignFormRef,
    assignForm,
    assignRules,
    registerDialog,
    registerFormCompleteLoading,
    registerFormRef,
    registerForm,
    registerSizeTableRows,
    registerSewingTotal,
    registerSewingCellMax,
    registerRules,
    loadFactorySuppliers,
    openAssignDialog,
    resetAssignForm,
    submitAssign,
    openRegisterDialog,
    resetRegisterForm,
    submitRegister,
  }
}

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
    orderRow: (number | null)[]
    cutRow: (number | null)[]
    sewingQuantities: number[]
    defectQuantity: number
    defectReason: string
  }>({
    headers: [],
    orderRow: [],
    cutRow: [],
    sewingQuantities: [],
    defectQuantity: 0,
    defectReason: '',
  })
  const registerSizeTableRows = computed(() => {
    const h = registerForm.headers
    if (!h.length) return []
    return [
      { key: 'order', label: '订单数量', values: registerForm.orderRow },
      { key: 'cut', label: '裁床数量', values: registerForm.cutRow },
      { key: 'sewing', label: '车缝数量', values: registerForm.sewingQuantities },
    ]
  })
  const registerSewingTotal = computed(() =>
    registerForm.sewingQuantities.reduce((a, b) => a + (Number(b) || 0), 0),
  )
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
    registerForm.orderRow = []
    registerForm.cutRow = []
    registerForm.sewingQuantities = []
    registerForm.defectQuantity = 0
    registerForm.defectReason = ''
    registerDialog.visible = true
    registerFormCompleteLoading.value = true
    try {
      const res = await getCompleteFormData(row.orderId)
      const data = res.data
      const headers = data?.headers ?? []
      const orderRow = data?.orderRow ?? []
      const cutRow = data?.cutRow ?? []
      registerForm.headers = headers
      registerForm.orderRow = orderRow
      registerForm.cutRow = cutRow
      const len = headers.length
      const sizeCount = len > 1 ? len - 1 : 1
      const cutSizeValues = cutRow.slice(0, sizeCount)
      const hasAnyCutValue = cutSizeValues.some((v) => v != null && !Number.isNaN(Number(v)))
      const defaultSource = hasAnyCutValue ? cutRow : orderRow
      registerForm.sewingQuantities = defaultSource
        .slice(0, sizeCount)
        .map((v) => (v != null ? Number(v) : 0))
      while (registerForm.sewingQuantities.length < sizeCount) {
        registerForm.sewingQuantities.push(0)
      }
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
    registerForm.orderRow = []
    registerForm.cutRow = []
    registerForm.sewingQuantities = []
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
        sewingQuantities: registerForm.headers.length ? registerForm.sewingQuantities : undefined,
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

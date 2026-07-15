import { ref, reactive, computed, type Ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  assignSewing,
  getCompleteFormData,
  completeSewing,
  editSewing,
  type SewingListItem,
} from '@/api/production-sewing'
import { getOrderColorSizeBreakdown } from '@/api/orders'
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
    mode: 'complete' | 'edit'
    row: SewingListItem | null
  }>({ visible: false, submitting: false, mode: 'complete', row: null })
  const registerFormCompleteLoading = ref(false)
  const registerFormRef = ref<FormInstance>()
  const registerForm = reactive<{
    headers: string[]
    sizeHeaders: string[]
    orderRow: (number | null)[]
    cutRow: (number | null)[]
    orderColorRows: Array<{ colorName: string; quantities: number[]; imageUrl?: string }>
    cutColorRows: Array<{ colorName: string; quantities: number[] }>
    sewingQuantitiesByColor: Array<{ colorName: string; quantities: number[] }>
    defectQuantity: number
    defectReason: string
    /** 编辑模式可改分单信息（原「补录分单」） */
    distributedAt: string
    factoryDueDate: string
    factoryName: string
    sewingFee: string
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
    distributedAt: '',
    factoryDueDate: '',
    factoryName: '',
    sewingFee: '',
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
  /** 整张裁床矩阵是否全为 0（"未过裁床"——小订单/补单不裁直接车） */
  const registerCutSkipped = computed(() => {
    const rows = registerForm.cutColorRows
    if (!rows.length) return true
    return rows.every((r) => {
      const qs = Array.isArray(r?.quantities) ? r.quantities : []
      return qs.every((q) => !(Number(q) > 0))
    })
  })
  /**
   * 每个颜色×尺码的车缝上限：
   * - 已过裁床（矩阵有非 0）→ 严格用对应裁床数（含 0：该色该码确实没裁，不让超）
   * - 未过裁床（矩阵全 0）→ 用订单数兜底（让"不裁直接车"的订单能正常登记）
   */
  function registerSewingCellMax(rowIdx: number, colIdx: number): number | undefined {
    if (registerCutSkipped.value) {
      const order = registerForm.orderColorRows?.[rowIdx]?.quantities?.[colIdx]
      const orderN = Number(order)
      return Number.isFinite(orderN) && orderN > 0 ? orderN : undefined
    }
    const cut = registerForm.cutColorRows?.[rowIdx]?.quantities?.[colIdx]
    return cut != null && Number.isFinite(Number(cut)) ? Number(cut) : undefined
  }
  const registerRules: FormRules = {
    defectQuantity: [],
    defectReason: [],
    factoryName: [
      {
        validator: (_rule, value, callback) => {
          if (registerDialog.mode !== 'edit') return callback()
          if (String(value ?? '').trim()) return callback()
          callback(new Error('请选择加工供应商'))
        },
        trigger: 'change',
      },
    ],
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

  async function fillRegisterFormFromApi(row: SewingListItem, mode: 'complete' | 'edit') {
    registerDialog.mode = mode
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
    registerForm.distributedAt = mode === 'edit'
      ? (row.distributedAt?.trim() || nowDatetimeStr())
      : ''
    registerForm.factoryDueDate = mode === 'edit' ? (row.factoryDueDate?.trim() || '') : ''
    registerForm.factoryName = mode === 'edit' ? (row.factoryName?.trim() || '') : ''
    registerForm.sewingFee = mode === 'edit' ? (row.sewingFee != null ? String(row.sewingFee) : '') : ''
    // 先拉齐供应商选项再打开，避免 el-select 选项未到位时显示空白（值看似丢了）
    if (mode === 'edit') {
      await loadFactorySuppliers()
      const name = registerForm.factoryName
      if (name && !factorySuppliers.value.some((s) => s.name === name)) {
        factorySuppliers.value = [
          {
            id: -1,
            name,
            supplierTypeId: null,
            businessScopeId: null,
            businessScopeIds: null,
            lastActiveAt: null,
            contactPerson: '',
            contactInfo: '',
            factoryAddress: '',
            settlementTime: '',
            remark: '',
            createdAt: '',
            updatedAt: '',
          },
          ...factorySuppliers.value,
        ]
      }
    }
    registerDialog.visible = true
    registerFormCompleteLoading.value = true
    try {
      const res = await getCompleteFormData(row.orderId)
      const data = res.data
      const headers = data?.headers ?? []
      let sizeHeaders = Array.isArray(data?.sizeHeaders) ? data.sizeHeaders : []
      if (sizeHeaders.length === 0 && headers.length > 0) {
        sizeHeaders = headers[headers.length - 1] === '合计' ? headers.slice(0, -1) : [...headers]
      }
      const orderRow = data?.orderRow ?? []
      const cutRow = data?.cutRow ?? []
      let orderColorRows = Array.isArray(data?.orderColorRows) ? data.orderColorRows : []
      let cutColorRows = Array.isArray(data?.cutColorRows) ? data.cutColorRows : []
      if (sizeHeaders.length > 0 && orderColorRows.length === 0) {
        try {
          const cs = await getOrderColorSizeBreakdown(row.orderId)
          const csHeaders = Array.isArray(cs.data?.headers) ? cs.data.headers : []
          const stripTotal = csHeaders[csHeaders.length - 1] === '合计'
          const sLen = stripTotal ? csHeaders.length - 1 : csHeaders.length
          const csRows = Array.isArray(cs.data?.rows) ? cs.data.rows : []
          orderColorRows = csRows.map((r) => {
            const vals = Array.isArray(r.values) ? r.values : []
            const quantities = Array.from({ length: sLen }, (_, ci) => {
              const n = Number(vals[ci])
              return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
            })
            return { colorName: String(r.colorName ?? ''), quantities }
          })
          if (cutColorRows.length === 0) {
            cutColorRows = orderColorRows.map((r) => ({ colorName: r.colorName, quantities: [...r.quantities] }))
          }
        } catch {
          /* keep empty */
        }
      }
      registerForm.headers = headers
      registerForm.sizeHeaders = sizeHeaders
      registerForm.orderRow = orderRow
      registerForm.cutRow = cutRow
      registerForm.orderColorRows = orderColorRows
      registerForm.cutColorRows = cutColorRows
      const sizeLen = sizeHeaders.length
      const existingByColor = Array.isArray(data?.sewingQuantitiesByColor) ? data.sewingQuantitiesByColor : []
      if (mode === 'edit' && existingByColor.length > 0) {
        const byName = new Map(existingByColor.map((r) => [String(r.colorName ?? '').trim(), r.quantities ?? []]))
        registerForm.sewingQuantitiesByColor = orderColorRows.map((plan) => {
          const prev = byName.get(plan.colorName) ?? []
          const quantities = Array.from({ length: sizeLen }, (_, ci) => {
            const n = Number(prev[ci])
            return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
          })
          return { colorName: plan.colorName, quantities }
        })
        registerForm.defectQuantity = Number(data?.defectQuantity) || 0
        registerForm.defectReason = String(data?.defectReason ?? '')
      } else {
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
      }
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载尺寸细数失败'))
      registerDialog.visible = false
    } finally {
      registerFormCompleteLoading.value = false
    }
  }

  async function openRegisterDialog() {
    const pending = selectedRows.value.filter((r) => r.sewingStatus !== 'completed')
    if (pending.length === 0) return
    await fillRegisterFormFromApi(pending[0], 'complete')
  }

  async function openEditCompletedDialog() {
    const completed = selectedRows.value.filter((r) => r.sewingStatus === 'completed')
    if (completed.length === 0) return
    await fillRegisterFormFromApi(completed[0], 'edit')
  }

  async function openEditCompletedForRow(row: SewingListItem) {
    if (row.sewingStatus !== 'completed') {
      ElMessage.warning('仅已车缝完成的订单可纠错编辑')
      return
    }
    await fillRegisterFormFromApi(row, 'edit')
  }

  function resetRegisterForm() {
    registerDialog.row = null
    registerDialog.mode = 'complete'
    registerForm.headers = []
    registerForm.sizeHeaders = []
    registerForm.orderRow = []
    registerForm.cutRow = []
    registerForm.orderColorRows = []
    registerForm.cutColorRows = []
    registerForm.sewingQuantitiesByColor = []
    registerForm.defectQuantity = 0
    registerForm.defectReason = ''
    registerForm.distributedAt = ''
    registerForm.factoryDueDate = ''
    registerForm.factoryName = ''
    registerForm.sewingFee = ''
    registerFormRef.value?.clearValidate()
  }

  async function submitRegister() {
    if (!registerDialog.row) return
    const total = registerSewingTotal.value
    if (total <= 0) {
      ElMessage.warning('请填写车缝数量')
      return
    }
    try {
      await registerFormRef.value?.validate()
    } catch {
      return
    }
    registerDialog.submitting = true
    try {
      const sizeLen = registerForm.sizeHeaders.length
      const perSize = sizeLen > 0
        ? Array.from({ length: sizeLen }, (_, ci) =>
            registerForm.sewingQuantitiesByColor.reduce(
              (sum, color) => sum + (Number(color.quantities?.[ci]) || 0),
              0,
            ),
          )
        : []
      const payload = {
        orderId: registerDialog.row.orderId,
        sewingQuantity: total,
        defectQuantity: registerForm.defectQuantity,
        defectReason: registerForm.defectReason.trim(),
        sewingQuantities: perSize.length > 0 ? perSize : undefined,
        sewingQuantitiesByColor: registerForm.sewingQuantitiesByColor,
      }
      if (registerDialog.mode === 'edit') {
        if (!registerForm.factoryName.trim()) {
          ElMessage.warning('请选择加工供应商')
          return
        }
        await editSewing({
          ...payload,
          distributedAt: registerForm.distributedAt || nowDatetimeStr(),
          factoryDueDate: registerForm.factoryDueDate || '',
          factoryName: registerForm.factoryName.trim(),
          sewingFee: registerForm.sewingFee?.trim() || '0',
        })
        ElMessage.success('已保存分单与车缝数量（订单主状态未改）')
      } else {
        await completeSewing(payload)
        ElMessage.success('车缝登记完成，订单已进入待尾部')
      }
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
    registerCutSkipped,
    registerRules,
    loadFactorySuppliers,
    openAssignDialog,
    resetAssignForm,
    submitAssign,
    openRegisterDialog,
    openEditCompletedDialog,
    openEditCompletedForRow,
    resetRegisterForm,
    submitRegister,
  }
}

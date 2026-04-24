import { computed, reactive, ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  completeCutting,
  getCuttingRegisterForm,
  type ColorSizeRow,
  type CuttingListItem,
  type CuttingMaterialUsagePayloadRow,
  type CuttingRegisterOrderBrief,
} from '@/api/production-cutting'
import { CUTTING_ABNORMAL_REASONS } from '@/constants/cutting-register'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getSupplierList, type SupplierItem } from '@/api/suppliers'
import { getEmployeeList, type EmployeeItem } from '@/api/hr'
import { formatDisplayNumber } from '@/utils/display-number'

interface UseCuttingRegisterParams {
  selectedRows: Ref<CuttingListItem[]>
  reloadList: () => Promise<void>
  reloadTabCounts: () => Promise<void>
}

const SELF_DEPARTMENT_LABEL = '本厂'

export function useCuttingRegister(params: UseCuttingRegisterParams) {
  const { selectedRows, reloadList, reloadTabCounts } = params

  const registerDialog = reactive<{
    visible: boolean
    submitting: boolean
    row: CuttingListItem | null
  }>({ visible: false, submitting: false, row: null })

  const defaultOrderBrief = (): CuttingRegisterOrderBrief => ({
    orderNo: '',
    skuCode: '',
    quantity: 0,
    customerName: '',
    orderDate: null,
  })

  const registerForm = reactive<{
    orderBrief: CuttingRegisterOrderBrief
    colorSizeHeaders: string[]
    actualCutRows: { colorName: string; quantities: number[]; remark?: string }[]
    materialUsageRows: CuttingMaterialUsagePayloadRow[]
    cuttingDepartment: string
    cutterName: string
  }>({
    orderBrief: defaultOrderBrief(),
    colorSizeHeaders: [],
    actualCutRows: [],
    materialUsageRows: [],
    cuttingDepartment: '',
    cutterName: '',
  })

  const cuttingDepartmentOptions = ref<string[]>([])
  const isSelfCutting = computed(() => (registerForm.cuttingDepartment ?? '').trim() === SELF_DEPARTMENT_LABEL)
  const cutterOptions = ref<string[]>([])

  function actualCutRowTotal(row: { quantities: number[] }): number {
    const qs = Array.isArray(row?.quantities) ? row.quantities : []
    return qs.reduce((sum, v) => sum + (Number(v) || 0), 0)
  }

  const actualCutGrandTotal = computed(() =>
    registerForm.actualCutRows.reduce((sum, r) => sum + actualCutRowTotal(r), 0),
  )

  const registerFormCuttingUnitPrice = ref('')

  const cuttingUnitPriceNum = computed({
    get() {
      const t = registerFormCuttingUnitPrice.value.trim()
      if (t === '') return undefined
      const n = Number(t)
      return Number.isFinite(n) ? n : undefined
    },
    set(v: number | undefined) {
      registerFormCuttingUnitPrice.value = v == null || !Number.isFinite(v) ? '' : String(v)
    },
  })

  const cuttingTotalCostDisplay = computed(() => {
    const u = Number(registerFormCuttingUnitPrice.value.trim())
    const g = actualCutGrandTotal.value
    if (!Number.isFinite(u) || u < 0) return 0
    if (!Number.isFinite(g) || g <= 0) return 0
    return Math.round(u * g * 100) / 100
  })

  function fabricNetForRow(r: CuttingMaterialUsagePayloadRow): number {
    const a = Number(r.issuedMeters)
    const b = Number(r.returnedMeters)
    const x = (Number.isFinite(a) ? a : 0) - (Number.isFinite(b) ? b : 0)
    return x > 0 ? x : 0
  }

  const fabricNetGrandTotal = computed(() =>
    registerForm.materialUsageRows.reduce((s, r) => s + fabricNetForRow(r), 0),
  )

  function formatFabricGrand(v: number) {
    if (!Number.isFinite(v)) return '—'
    return formatDisplayNumber(v)
  }

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
      registerForm.orderBrief = { ...data.orderBrief }
      registerForm.colorSizeHeaders = data.colorSizeHeaders ?? []
      const rows = data.colorSizeRows ?? []
      registerForm.actualCutRows = rows.map((r: ColorSizeRow) => ({
        colorName: r.colorName ?? '',
        quantities: Array.isArray(r.quantities) ? [...r.quantities] : [],
        remark: r.remark ?? '',
      }))
      if (registerForm.actualCutRows.length === 0) {
        registerForm.actualCutRows = [{ colorName: '', quantities: [], remark: '' }]
      }
      const len = registerForm.colorSizeHeaders.length
      registerForm.actualCutRows.forEach((r) => {
        while (r.quantities.length < len) r.quantities.push(0)
      })
      registerForm.materialUsageRows = JSON.parse(JSON.stringify(data.materialUsageRows ?? []))
      registerFormCuttingUnitPrice.value = ''
      registerForm.cuttingDepartment = SELF_DEPARTMENT_LABEL
      registerForm.cutterName = ''
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
      registerDialog.visible = false
    }
  }

  function resetRegisterForm() {
    registerDialog.row = null
    registerForm.orderBrief = defaultOrderBrief()
    registerForm.colorSizeHeaders = []
    registerForm.actualCutRows = []
    registerForm.materialUsageRows = []
    registerFormCuttingUnitPrice.value = ''
    registerForm.cuttingDepartment = ''
    registerForm.cutterName = ''
  }

  const abnormalReasonSet = new Set<string>(CUTTING_ABNORMAL_REASONS as unknown as string[])

  function validateMaterialUsageClient(): string | null {
    for (const r of registerForm.materialUsageRows) {
      const issued = Number(r.issuedMeters)
      const returned = Number(r.returnedMeters)
      const abnormal = Number(r.abnormalLossMeters)
      if (!Number.isFinite(issued) || issued < 0) return `「${r.materialName}」本次领用米数须为非负数`
      if (!Number.isFinite(returned) || returned < 0) return `「${r.materialName}」退回米数须为非负数`
      if (!Number.isFinite(abnormal) || abnormal < 0) return `「${r.materialName}」异常损耗须为非负数`
      if (returned > issued) return `「${r.materialName}」退回不能大于领用`
      const net = issued - returned
      if (abnormal > net + 1e-9) return `「${r.materialName}」异常损耗不能大于实际净耗`
      if (abnormal > 0) {
        const reason = (r.abnormalReason ?? '').trim()
        if (!reason || !abnormalReasonSet.has(reason)) return `「${r.materialName}」有异常损耗时请填写异常原因`
        if (reason === '其他' && !(r.remark ?? '').trim()) return `「${r.materialName}」原因为「其他」时请填写备注`
      }
    }
    return null
  }

  async function submitRegister() {
    if (!registerDialog.row) return
    const dep = (registerForm.cuttingDepartment ?? '').trim()
    if (!dep) {
      ElMessage.warning('请选择裁剪部门')
      return
    }
    if (dep === SELF_DEPARTMENT_LABEL && !(registerForm.cutterName ?? '').trim()) {
      ElMessage.warning('本厂裁床请填写裁剪人')
      return
    }
    const unitTrim = registerFormCuttingUnitPrice.value.trim()
    const unitNum = unitTrim === '' ? 0 : Number(unitTrim)
    if (!Number.isFinite(unitNum) || unitNum < 0) {
      ElMessage.warning('裁剪单价须为非负数')
      return
    }
    const matErr = validateMaterialUsageClient()
    if (matErr) {
      ElMessage.warning(matErr)
      return
    }
    registerDialog.submitting = true
    try {
      const actualCutRows = registerForm.actualCutRows.map((r) => ({
        colorName: r.colorName,
        quantities: r.quantities,
        remark: r.remark,
      }))
      const g = actualCutGrandTotal.value
      const totalCost = Math.round(unitNum * g * 100) / 100
      const materialUsage: CuttingMaterialUsagePayloadRow[] = registerForm.materialUsageRows.map((r) => ({
        rowKey: r.rowKey,
        materialTypeId: r.materialTypeId,
        categoryLabel: r.categoryLabel,
        materialName: r.materialName,
        colorSpec: r.colorSpec,
        expectedUsagePerPiece: r.expectedUsagePerPiece,
        issuedMeters: Number(r.issuedMeters) || 0,
        returnedMeters: Number(r.returnedMeters) || 0,
        abnormalLossMeters: Number(r.abnormalLossMeters) || 0,
        abnormalReason: r.abnormalReason,
        remark: r.remark ?? '',
      }))
      await completeCutting({
        orderId: registerDialog.row.orderId,
        actualCutRows,
        cuttingDepartment: dep,
        cutterName: dep === SELF_DEPARTMENT_LABEL ? (registerForm.cutterName ?? '').trim() : null,
        cuttingUnitPrice: unitTrim === '' ? '0' : unitTrim,
        cuttingTotalCost: totalCost.toFixed(2),
        materialUsage,
      })
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
      const res = await getEmployeeList({ status: 'active', page: 1, pageSize: 500 })
      const list: EmployeeItem[] = res.data?.list ?? []
      const names = list
        .filter((e) => {
          const dept = (e.departmentName ?? '').trim()
          const job = (e.jobTitleName ?? '').trim()
          const status = (e.status ?? '').toLowerCase()
          return dept === '裁床' && job === '电剪' && status === 'active'
        })
        .map((e) => (e.name ?? '').trim())
        .filter((v) => !!v)
      const uniq = Array.from(new Set(names))
      cutterOptions.value = uniq.length ? uniq : ['电剪刀']
    } catch {
      cutterOptions.value = ['电剪刀']
    }
  }

  function onCuttingDepartmentChange() {
    const dep = (registerForm.cuttingDepartment ?? '').trim()
    if (dep !== SELF_DEPARTMENT_LABEL) {
      registerForm.cutterName = ''
    }
  }

  return {
    SELF_DEPARTMENT_LABEL,
    registerDialog,
    registerForm,
    cuttingDepartmentOptions,
    isSelfCutting,
    cutterOptions,
    actualCutGrandTotal,
    cuttingUnitPriceNum,
    cuttingTotalCostDisplay,
    fabricNetGrandTotal,
    formatFabricGrand,
    openRegisterDialog,
    resetRegisterForm,
    submitRegister,
    loadCuttingDepartments,
    loadCutterOptions,
    onCuttingDepartmentChange,
  }
}

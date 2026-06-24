import { computed, reactive, ref } from 'vue'
import type {
  CuttingMaterialUsagePayloadRow,
  CuttingRegisterOrderBrief,
} from '@/api/production-cutting'
import { CUTTING_ABNORMAL_REASONS } from '@/constants/cutting-register'
import { formatDisplayNumber } from '@/utils/display-number'

export const SELF_DEPARTMENT_LABEL = '本厂'

export interface CuttingForm {
  orderBrief: CuttingRegisterOrderBrief
  colorSizeHeaders: string[]
  actualCutRows: { colorName: string; quantities: number[]; remark?: string; imageUrl?: string }[]
  materialUsageRows: CuttingMaterialUsagePayloadRow[]
  cuttingDepartment: string
  cutterName: string
}

export interface CuttingSubmitCore {
  actualCutRows: { colorName: string; quantities: number[]; remark?: string }[]
  cuttingDepartment: string
  cutterName: string | null
  cuttingUnitPrice: string
  cuttingTotalCost: string
  materialUsage: CuttingMaterialUsagePayloadRow[]
}

export function defaultOrderBrief(): CuttingRegisterOrderBrief {
  return { orderNo: '', skuCode: '', quantity: 0, customerName: '', orderDate: null }
}

/** 裁床登记/编辑共用的表单状态、计算与校验 */
export function useCuttingFormState() {
  const form = reactive<CuttingForm>({
    orderBrief: defaultOrderBrief(),
    colorSizeHeaders: [],
    actualCutRows: [],
    materialUsageRows: [],
    cuttingDepartment: '',
    cutterName: '',
  })

  const cuttingUnitPriceText = ref('')

  const isSelfCutting = computed(() => (form.cuttingDepartment ?? '').trim() === SELF_DEPARTMENT_LABEL)

  function actualCutRowTotal(row: { quantities: number[] }): number {
    const qs = Array.isArray(row?.quantities) ? row.quantities : []
    return qs.reduce((sum, v) => sum + (Number(v) || 0), 0)
  }

  const actualCutGrandTotal = computed(() =>
    form.actualCutRows.reduce((sum, r) => sum + actualCutRowTotal(r), 0),
  )

  const cuttingUnitPriceNum = computed({
    get() {
      const t = cuttingUnitPriceText.value.trim()
      if (t === '') return undefined
      const n = Number(t)
      return Number.isFinite(n) ? n : undefined
    },
    set(v: number | undefined) {
      cuttingUnitPriceText.value = v == null || !Number.isFinite(v) ? '' : String(v)
    },
  })

  const cuttingTotalCostDisplay = computed(() => {
    const u = Number(cuttingUnitPriceText.value.trim())
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
    form.materialUsageRows.reduce((s, r) => s + fabricNetForRow(r), 0),
  )

  function formatFabricGrand(v: number) {
    if (!Number.isFinite(v)) return '—'
    return formatDisplayNumber(v)
  }

  const abnormalReasonSet = new Set<string>(CUTTING_ABNORMAL_REASONS as unknown as string[])

  function validateMaterialUsageClient(): string | null {
    for (const r of form.materialUsageRows) {
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

  /** 校验部门/裁剪人/单价；返回错误文案或 null */
  function validateBasics(): string | null {
    const dep = (form.cuttingDepartment ?? '').trim()
    if (!dep) return '请选择裁剪部门'
    if (dep === SELF_DEPARTMENT_LABEL && !(form.cutterName ?? '').trim()) return '本厂裁床请填写裁剪人'
    const unitTrim = cuttingUnitPriceText.value.trim()
    const unitNum = unitTrim === '' ? 0 : Number(unitTrim)
    if (!Number.isFinite(unitNum) || unitNum < 0) return '裁剪单价须为非负数'
    return validateMaterialUsageClient()
  }

  function buildSubmitCore(): CuttingSubmitCore {
    const dep = (form.cuttingDepartment ?? '').trim()
    const unitTrim = cuttingUnitPriceText.value.trim()
    const unitNum = unitTrim === '' ? 0 : Number(unitTrim)
    const g = actualCutGrandTotal.value
    const totalCost = Math.round(unitNum * g * 100) / 100
    return {
      actualCutRows: form.actualCutRows.map((r) => ({
        colorName: r.colorName,
        quantities: r.quantities,
        remark: r.remark,
      })),
      cuttingDepartment: dep,
      cutterName: dep === SELF_DEPARTMENT_LABEL ? (form.cutterName ?? '').trim() : null,
      cuttingUnitPrice: unitTrim === '' ? '0' : unitTrim,
      cuttingTotalCost: totalCost.toFixed(2),
      materialUsage: form.materialUsageRows.map((r) => ({
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
      })),
    }
  }

  function resetForm() {
    form.orderBrief = defaultOrderBrief()
    form.colorSizeHeaders = []
    form.actualCutRows = []
    form.materialUsageRows = []
    form.cuttingDepartment = ''
    form.cutterName = ''
    cuttingUnitPriceText.value = ''
  }

  function onCuttingDepartmentChange() {
    if ((form.cuttingDepartment ?? '').trim() !== SELF_DEPARTMENT_LABEL) {
      form.cutterName = ''
    }
  }

  return {
    SELF_DEPARTMENT_LABEL,
    form,
    cuttingUnitPriceText,
    isSelfCutting,
    actualCutGrandTotal,
    cuttingUnitPriceNum,
    cuttingTotalCostDisplay,
    fabricNetGrandTotal,
    formatFabricGrand,
    validateMaterialUsageClient,
    validateBasics,
    buildSubmitCore,
    resetForm,
    onCuttingDepartmentChange,
  }
}

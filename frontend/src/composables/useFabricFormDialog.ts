import { nextTick, reactive, ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormRules } from 'element-plus'
import {
  createFabric,
  updateFabric,
  getFabricOperationLogs,
  type FabricItem,
  type FabricOperationLog,
} from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'

export interface FabricFormDialogExpose {
  validate: () => Promise<unknown> | undefined
  clearValidate: () => void
}

export type FabricFormMode = 'create' | 'edit' | 'view'

export interface FabricFormModel {
  name: string
  quantity: number
  unit: string
  customerName: string
  supplierId: number | null
  warehouseId: number | null
  inventoryTypeId: number | null
  storageLocation: string
  imageUrl: string
  remark: string
  unitPrice: number | null
  otherCost: number
  isUnpriced: boolean
}

function emptyFabricForm(): FabricFormModel {
  return {
    name: '', quantity: 0, unit: '米', customerName: '', supplierId: null,
    warehouseId: null, inventoryTypeId: null, storageLocation: '', imageUrl: '', remark: '',
    unitPrice: null, otherCost: 0, isUnpriced: false,
  }
}

type LoadHandler = () => Promise<void> | void

export function useFabricFormDialog(
  selectedRows: Ref<FabricItem[]>,
  reloadList: LoadHandler,
  dialogRef: Ref<FabricFormDialogExpose | undefined>,
  loadSuppliers: () => Promise<void> | void,
) {
  const formDialog = reactive<{ visible: boolean; submitting: boolean; mode: FabricFormMode; logsLoading: boolean }>({
    visible: false,
    submitting: false,
    mode: 'create',
    logsLoading: false,
  })
  const quickAddSource = ref<FabricItem | null>(null)
  const editId = ref<number | null>(null)
  const detailRow = ref<FabricItem | null>(null)
  const logs = ref<FabricOperationLog[]>([])
  let formVersion = 0
  /** 每次打开表单递增，重置供应商下拉内部筛选关键字 */
  const fabricSupplierSelectKey = ref(0)
  const form = reactive<FabricFormModel>(emptyFabricForm())
  const formRules: FormRules = {
    name: [{ required: true, message: '请输入面料名称', trigger: 'blur' }],
  }

  function formatLogAction(action: string): string {
    if (action === 'create') return '新建'
    if (action === 'inbound') return '新增入库'
    if (action === 'update') return '编辑'
    if (action === 'reprice') return '补价'
    if (action === 'outbound') return '出库'
    if (action === 'delete') return '删除'
    return action || '操作'
  }

  async function fetchLogs(id: number): Promise<void> {
    const version = formVersion
    const isCurrent = () => version === formVersion && formDialog.visible
    formDialog.logsLoading = true
    try {
      const res = await getFabricOperationLogs(id)
      if (!isCurrent()) return
      logs.value = res.data ?? []
    } catch (e: unknown) {
      if (!isCurrent()) return
      logs.value = []
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      if (isCurrent()) formDialog.logsLoading = false
    }
  }

  function applyRowToForm(seed: FabricItem) {
    form.name = seed.name
    form.unit = seed.unit ?? '米'
    form.customerName = seed.customerName ?? ''
    form.supplierId = seed.supplierId != null && seed.supplierId > 0 ? seed.supplierId : null
    form.warehouseId = seed.warehouseId != null && seed.warehouseId > 0 ? seed.warehouseId : null
    form.inventoryTypeId = seed.inventoryTypeId != null && seed.inventoryTypeId > 0 ? seed.inventoryTypeId : null
    form.storageLocation = seed.storageLocation ?? ''
    form.imageUrl = seed.imageUrl ?? ''
    form.remark = seed.remark ?? ''
    form.quantity = parseFloat(String(seed.quantity)) || 0
    form.unitPrice = seed.unitPrice == null ? null : Number(seed.unitPrice)
    form.otherCost = 0
    form.isUnpriced = seed.unitPrice == null
  }

  async function openForm(row: FabricItem | null, mode: FabricFormMode = row ? 'edit' : 'create') {
    if (formDialog.submitting) return
    formVersion += 1
    formDialog.logsLoading = false
    formDialog.mode = mode
    quickAddSource.value = null
    logs.value = []
    editId.value = row ? row.id : null
    const isRowMode = mode === 'edit' || mode === 'view'
    detailRow.value = isRowMode ? row : null
    if (isRowMode && row) {
      applyRowToForm(row)
    } else if (mode === 'create' && selectedRows.value.length === 1) {
      // 增量入库：沿用源记录字段，数量从 0 开始
      applyRowToForm(selectedRows.value[0]!)
      quickAddSource.value = selectedRows.value[0]!
      form.quantity = 0
      form.unitPrice = null
      form.otherCost = 0
      form.isUnpriced = false
    } else {
      Object.assign(form, emptyFabricForm())
    }
    fabricSupplierSelectKey.value += 1
    formDialog.visible = true
    if (mode === 'view' && row) void fetchLogs(row.id)
    await nextTick()
    await loadSuppliers()
  }

  function enterEdit() {
    if (formDialog.submitting) return
    formDialog.mode = 'edit'
  }

  function exitEdit() {
    if (formDialog.submitting) return
    if (detailRow.value) applyRowToForm(detailRow.value)
    dialogRef.value?.clearValidate()
    formDialog.mode = 'view'
  }

  function resetForm() {
    if (formDialog.visible) return
    formVersion += 1
    formDialog.logsLoading = false
    dialogRef.value?.clearValidate()
  }

  function buildPayload() {
    return {
      name: form.name,
      unit: form.unit,
      customerName: form.customerName ?? '',
      imageUrl: form.imageUrl,
      remark: form.remark,
      supplierId: form.supplierId ?? null,
      warehouseId: form.warehouseId ?? null,
      inventoryTypeId: form.inventoryTypeId ?? null,
      storageLocation: form.storageLocation,
      unitPrice: form.isUnpriced ? null : form.unitPrice,
    }
  }

  async function submitForm() {
    if (formDialog.submitting || !formDialog.visible || formDialog.mode === 'view') return
    const version = formVersion
    const mode = formDialog.mode
    try {
      await dialogRef.value?.validate?.()
    } catch {
      return
    }
    if (formDialog.submitting || !formDialog.visible || version !== formVersion || mode !== formDialog.mode) return
    if (!form.name.trim()) {
      ElMessage.warning('请输入面料名称')
      return
    }
    if (formDialog.mode !== 'edit' && (!Number.isFinite(Number(form.quantity)) || Number(form.quantity) <= 0)) {
      ElMessage.warning('请输入大于 0 的新增数量')
      return
    }
    if (!form.isUnpriced && (form.unitPrice == null || !Number.isFinite(Number(form.unitPrice)) || Number(form.unitPrice) < 0)) {
      ElMessage.warning('请输入大于或等于 0 的实际采购单价，或选择暂未计价')
      return
    }
    if (!form.isUnpriced && (!Number.isFinite(Number(form.otherCost)) || Number(form.otherCost) < 0)) {
      ElMessage.warning('其他费用不能小于 0')
      return
    }
    formDialog.submitting = true
    try {
      if (formDialog.mode === 'edit' && editId.value != null) {
        await updateFabric(editId.value, buildPayload())
        ElMessage.success('保存成功')
      } else if (quickAddSource.value) {
        const inputQty = Number(form.quantity) || 0
        if (inputQty <= 0) {
          ElMessage.warning('请输入大于 0 的新增数量')
          return
        }
        await createFabric({ ...buildPayload(), quantity: inputQty, otherCost: form.isUnpriced ? 0 : form.otherCost })
        ElMessage.success('库存增加成功')
      } else {
        await createFabric({ ...buildPayload(), quantity: form.quantity, otherCost: form.isUnpriced ? 0 : form.otherCost })
        ElMessage.success('新增成功')
      }
      formDialog.visible = false
      await reloadList()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      formDialog.submitting = false
    }
  }

  return {
    formDialog,
    quickAddSource,
    fabricSupplierSelectKey,
    form,
    formRules,
    logs,
    openForm,
    enterEdit,
    exitEdit,
    resetForm,
    submitForm,
    formatLogAction,
  }
}
